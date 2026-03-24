# gpt-chatbot Backend

Express backend repo for the gpt-chatbot demo.

This repo contains:

- `Express` REST API
- Postgres access through `pg`
- proper migration history via `sequelize-cli`
- Supabase Auth token verification on the backend
- guest limit logic
- chat persistence
- image/document upload handling
- Gemini integration with multi-key fallback

## Stack

- `Node.js + Express`
- `PostgreSQL`
- `pg`
- `sequelize-cli` migrations
- `@supabase/supabase-js`
- `multer`
- `@google/generative-ai`

## Project structure

```text
config/          sequelize-cli DB config
migrations/      schema history
src/
  app.js
  index.js
  config/
  constants/
  db/
  middleware/
  modules/
    auth/
    chats/
    uploads/
    health/
  services/
  utils/
storage/uploads/ local file storage
```

## Environment

Copy `.env.example` to `.env` and fill it:

```bash
cp .env.example .env
```

Main variables:

```env
BACKEND_PORT=4000
FRONTEND_URL=http://localhost:3000

PG_HOST=127.0.0.1
PG_PORT=5432
PG_DATABASE=gpt_chatbot
PG_USER=postgres
PG_PASSWORD=postgres

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx

GEMINI_API_KEYS=key1,key2
GEMINI_MODEL=gemini-2.5-flash
```

## Database setup

This repo intentionally uses explicit Postgres connection variables and migration files instead of hiding everything behind a single `DATABASE_URL`.

You can run only Postgres via Docker:

```bash
docker compose up -d postgres
```

Then apply migrations:

```bash
npm install
npm run migrate
```

You can also run the backend itself in Docker:

```bash
docker compose up -d --build
```

## Run

```bash
npm run dev
```

Backend will be available at:

```text
http://localhost:4000
```

Healthcheck:

```text
GET /health
```

## Main API

- `GET /api/auth/session`
- `POST /api/auth/logout`
- `GET /api/chats`
- `POST /api/chats`
- `GET /api/chats/:chatId`
- `POST /api/chats/:chatId/messages`
- `POST /api/attachments`
- `POST /api/documents`

## Notes

- Uploads are stored locally in `storage/uploads`.
- Frontend auth uses Supabase client auth; backend accepts Supabase bearer tokens and syncs users into `app_users`.
- Domain logic is split into `routes -> controller -> service -> repository`, and SQL lives in per-domain `queries/*.sql`.
- Migrations are in `migrations/` and are intended to be the source of truth for schema setup.
- Frontend is expected to call this backend with cookies enabled for guest mode and bearer tokens for authenticated users.
