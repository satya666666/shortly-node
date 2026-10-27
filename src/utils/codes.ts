/** Codes use an unambiguous alphabet (no 0/O, 1/l/I). */
const ALPHABET = "23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
const CODE_LENGTH = 7;
const MAX_RETRIES = 5;

export function generateCode(randomBytes: (n: number) => Uint8Array): string {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const bytes = randomBytes(CODE_LENGTH);
    let code = "";
    for (const b of bytes) code += ALPHABET[b % ALPHABET.length];
    if (!code.includes("-")) return code; // "-" is reserved for error prefixes
  }
  throw new Error("could not generate a unique code");
}

/**
 * Normalizes URLs so "https://x.com", "x.com" and "https://x.com/" map to one
 * short link: adds the https scheme when missing, strips fragments and
 * trailing slashes, and only allows http/https schemes.
 */
export function normalizeUrl(raw: string): string | null {
  if (!raw.trim()) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    try {
      url = new URL(`https://${raw}`);
    } catch {
      return null;
    }
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  url.hash = "";
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }
  return url.toString();
}
