# MaryAnnStories Backend (Zig)

This backend uses the Horizon web framework, Nullclaw as the AI agent gateway, and the native `pg.zig` driver for PostgreSQL.

## Requirements
- Zig 0.14.1 or newer (tested on 0.14.1)
- `pcre2-8` development library available to the linker
- A running Nullclaw gateway

## Environment
The backend reads environment variables and also tries to load `.env` from the repo root or from `backend/.env`.

Required or common variables:
- `NULLCLAW_GATEWAY_URL` (default: `http://127.0.0.1:3000`)
- `NULLCLAW_BEARER_TOKEN` (only if Nullclaw gateway pairing is enabled)
- `OPENAI_API_KEY`
- `OPENAI_BASE_URL` (default: `https://api.openai.com/v1`)
- `OPENAI_STORY_MODEL` (default: `gpt-5.2`)
- `OPENAI_IMAGE_MODEL` (default: `dall-e-3`)
- `SEAWEED_FILER_ENDPOINT` (example: `http://localhost:8888`)
- `SEAWEED_PUBLIC_URL` (public base URL for stored images)
- `DATABASE_URL` or `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`
- `PORT` (default: `4000`)

If the `.env` file contains a single raw OpenAI key (for example a line starting with `sk-`), it is treated as `OPENAI_API_KEY`.

## Run
```bash
cd backend
ZIG_GLOBAL_CACHE_DIR=./.zig-cache zig build run
```

If your global Zig cache is writable, you can omit `ZIG_GLOBAL_CACHE_DIR`:
```bash
cd backend
zig build run
```

## Endpoints
- `GET /api/health`
- `POST /api/agent` with JSON body: `{"message":"Hello"}` (or `{"input":"Hello"}`)
- `POST /api/auth/register` with JSON body: `{"username":"name","password":"secret"}`
- `POST /api/auth/login` with JSON body: `{"username":"name","password":"secret"}`
- `POST /api/story/generate` with JSON body: `{"prompt":"Tell a story about..."}` (or `{"input":"..."}`)
- `POST /api/images/generate` with JSON body: `{"prompt":"A watercolor cover of..."}` (optional: `{"size":"1024x1024"}`)
- `POST /api/images/accept` with JSON body: `{"story_id":"...", "image":"<url or data url>", "kind":"cover|page", "page_index":0}` to store in Seaweed

## Docker Compose
From the repo root:
```bash
docker compose up --build
```
