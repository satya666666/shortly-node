import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { InMemoryUrlRepository } from "../src/repositories/urlRepository.js";

/** Fixed clock so timestamps in responses are deterministic. */
const FIXED_NOW = new Date("2026-10-27T10:00:00Z");
const now = () => FIXED_NOW;

function appWith() {
  const repository = new InMemoryUrlRepository();
  return { app: createApp({ repository, now }), repository };
}

describe("POST /api/urls", () => {
  it("creates a short link and returns 201 with a 7-char code", async () => {
    const { app } = appWith();
    const res = await request(app).post("/api/urls").send({ url: "https://example.com/docs" });
    expect(res.status).toBe(201);
    expect(res.body.longUrl).toBe("https://example.com/docs");
    expect(res.body.code).toMatch(/^[23456789a-z]{7}$/i);
    expect(res.body.clicks).toBe(0);
  });

  it("is idempotent: the same URL returns the same code with 200", async () => {
    const { app } = appWith();
    const first = await request(app).post("/api/urls").send({ url: "https://example.com/docs" });
    const second = await request(app).post("/api/urls").send({ url: "https://example.com/docs/" });
    expect(second.status).toBe(200);
    expect(second.body.code).toBe(first.body.code);
  });

  it("normalizes missing scheme and strips fragments", async () => {
    const { app } = appWith();
    const res = await request(app).post("/api/urls").send({ url: "example.com/docs#section" });
    expect(res.body.longUrl).toBe("https://example.com/docs");
  });

  it("rejects invalid URLs with 400", async () => {
    const { app } = appWith();
    const res = await request(app).post("/api/urls").send({ url: "not a url at all ???" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_url");
  });

  it("rejects non-http(s) schemes like javascript:", async () => {
    const { app } = appWith();
    const res = await request(app).post("/api/urls").send({ url: "javascript:alert(1)" });
    expect(res.status).toBe(400);
  });

  it("surfaces 409 when the repository reports a code collision", async () => {
    const repository = new InMemoryUrlRepository();
    vi.spyOn(repository, "create").mockRejectedValue(new Error("CODE_TAKEN"));
    const app = createApp({ repository, now });
    const res = await request(app).post("/api/urls").send({ url: "https://example.com" });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("code_taken");
  });
});

describe("GET /api/r/:code", () => {
  it("redirects 301 to the long URL and records the click", async () => {
    const { app, repository } = appWith();
    const created = await request(app).post("/api/urls").send({ url: "https://example.com/docs" });
    const code = created.body.code as string;

    const res = await request(app).get(`/api/r/${code}`);
    expect(res.status).toBe(301);
    expect(res.headers.location).toBe("https://example.com/docs");

    const stats = await repository.findByCode(code);
    expect(stats?.clicks).toBe(1);
    expect(stats?.lastClickedAt).toEqual(FIXED_NOW);
  });

  it("counts multiple clicks atomically per redirect", async () => {
    const { app, repository } = appWith();
    const created = await request(app).post("/api/urls").send({ url: "https://example.com" });
    const code = created.body.code as string;
    await request(app).get(`/api/r/${code}`);
    await request(app).get(`/api/r/${code}`);
    const stats = await repository.findByCode(code);
    expect(stats?.clicks).toBe(2);
  });

  it("returns 404 for unknown codes", async () => {
    const { app } = appWith();
    const res = await request(app).get("/api/r/zzzzzzz");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("not_found");
  });
});

describe("GET /api/urls/:code/stats and DELETE", () => {
  it("exposes stats and deletes the link", async () => {
    const { app, repository } = appWith();
    const created = await request(app).post("/api/urls").send({ url: "https://example.com/stats" });
    const code = created.body.code as string;

    await request(app).get(`/api/r/${code}`);
    const stats = await request(app).get(`/api/urls/${code}/stats`);
    expect(stats.body.clicks).toBe(1);
    expect(stats.body.lastClickedAt).toBe(FIXED_NOW.toISOString());

    const del = await request(app).delete(`/api/urls/${code}`);
    expect(del.status).toBe(204);
    expect(await repository.findByCode(code)).toBeNull();

    const statsAfter = await request(app).get(`/api/urls/${code}/stats`);
    expect(statsAfter.status).toBe(404);
  });
});
