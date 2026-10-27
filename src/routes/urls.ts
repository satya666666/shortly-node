import { Router } from "express";
import type { UrlRepository } from "../repositories/urlRepository.js";
import { generateCode, normalizeUrl } from "../utils/codes.js";

export function urlsRouter(deps: {
  repository: UrlRepository;
  now?: () => Date;
  randomBytes?: (n: number) => Uint8Array;
}): Router {
  const router = Router();
  const now = deps.now ?? (() => new Date());
  const randomBytes = deps.randomBytes ?? ((n: number) => crypto.getRandomValues(new Uint8Array(n)));

  /** Create a short link. Idempotent: the same long URL returns the same code. */
  router.post("/urls", async (req, res, next) => {
    try {
      const longUrl = normalizeUrl(String(req.body?.url ?? ""));
      if (!longUrl) {
        return res.status(400).json({ error: "invalid_url", message: "Provide a valid http(s) URL." });
      }
      const existing = await deps.repository.findByLongUrl(longUrl);
      if (existing) return res.status(200).json(existing); // idempotent replay

      const code = generateCode(randomBytes);
      const created = await deps.repository.create({ code, longUrl, createdAt: now() });
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  });

  /** Stats for a short link. */
  router.get("/urls/:code/stats", async (req, res, next) => {
    try {
      const row = await deps.repository.findByCode(req.params.code);
      if (!row) return res.status(404).json({ error: "not_found", message: `No link for code ${req.params.code}` });
      res.json(row);
    } catch (err) {
      next(err);
    }
  });

  /** Resolve + count a click atomically in the repository. */
  router.get("/r/:code", async (req, res, next) => {
    try {
      const row = await deps.repository.recordClick(req.params.code, now());
      if (!row) return res.status(404).json({ error: "not_found", message: `No link for code ${req.params.code}` });
      res.redirect(301, row.longUrl);
    } catch (err) {
      next(err);
    }
  });

  /** Delete a short link. */
  router.delete("/urls/:code", async (req, res, next) => {
    try {
      const deleted = await deps.repository.remove(req.params.code);
      if (!deleted) return res.status(404).json({ error: "not_found", message: `No link for code ${req.params.code}` });
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
