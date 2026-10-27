# shortly-node

A compact **URL shortener REST API** built with **Node.js, Express and TypeScript**, backed by
PostgreSQL (with a swappable in-memory repository for deterministic tests).

Built to demonstrate Node backend fundamentals end to end: typed Express app, layered
architecture (routes → service → repository), REST contract design, data modeling with
constraints and indexes, atomic SQL updates, and a fully offline test suite.

## API

| Method | Path                    | Description                                          |
|--------|-------------------------|------------------------------------------------------|
| POST   | `/api/urls`             | Create a short link (idempotent per long URL → 201/200) |
| GET    | `/api/r/:code`          | Resolve and count a click (301 redirect)              |
| GET    | `/api/urls/:code/stats` | Click stats for a link                                |
| DELETE | `/api/urls/:code`       | Delete a link                                         |

## Design decisions

- **Layered architecture with dependency injection** — the router receives a `UrlRepository`
  interface; `InMemoryUrlRepository` (tests/demo) and `PostgresUrlRepository` (production) are
  interchangeable. Tests run fully offline and deterministically with an injected fixed clock.
- **Idempotent creation** — the same long URL returns the same short code (200 on replay, 201 on
  first creation), so client retries can never create duplicates.
- **Atomic click counting in SQL** — `UPDATE ... SET clicks = clicks + 1 ... RETURNING *` so
  concurrent redirects never lose a click (a read-modify-write in app code would).
- **Input hardening** — URLs are normalized (scheme added, fragments stripped), non-http(s)
  schemes like `javascript:` are rejected, and codes use an unambiguous alphabet.
- **Collision handling** — a unique-primary-key insert with `ON CONFLICT` surfaces a clean
  `409 code_taken` instead of a 500.

## Run

```bash
npm install
npm run dev            # in-memory store on :3000

# with PostgreSQL (docker compose up -d)
STORE=postgres DATABASE_URL=postgres://postgres:postgres@localhost:5432/shortly npm run dev
```

```bash
curl -X POST localhost:3000/api/urls -H 'content-type: application/json' -d '{"url":"https://example.com"}'
curl -i localhost:3000/api/r/<code>
curl localhost:3000/api/urls/<code>/stats
```

## Test

```bash
npm test     # vitest: unit tests for code generation/normalization + API integration tests via supertest
```
