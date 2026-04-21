# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # start with nodemon (auto-restart on changes)
npm start            # start without nodemon
npm run seed:task17  # seed task17 data into the DB
npm run export:figma # export tokens to Figma
```

No build step — the project uses plain JS on the client (no bundler), plus React via CDN for `/task17`.

## Architecture

**Stack:** Node.js + Express (ESM, `"type": "module"`), EJS templates, SQLite via `better-sqlite3`, vanilla JS on the client.

**Entry point:** `server/index.js` — mounts all routers and starts the server on port 3000 (or `process.env.PORT`).

**Database:** `data/app.sqlite`. Schema and seed SQL in `server/sql/`. Database connection singleton in `server/db.js`. Task17 has a separate seed script: `server/db/seeds/task17.seed.js`.

**Routing split:**
- `server/routes/pages.js` — all server-rendered EJS pages (`GET /`, `/subtopics`, `/tasks`, `/assignment/:id`, `/task17`, `/task17/:id`, `/admin/*`, `/login`)
- `server/routes/api.js` — public REST API for EGE content (subtopics, assignments, answer checking)
- `server/routes/auth.js` — mounted at `/api/auth` (login, register, logout, `/me`)
- `server/routes/admin.js` — mounted at `/api/admin` — CRUD for task types, subtopics, assignments; **currently not protected by auth middleware**
- `server/routes/task17.js` — mounted at `/api/task17` — full CRUD + `/play` + `/check` for task 17

**Views:** EJS in `views/pages/`. All pages share `views/pages/layout.ejs`, which includes `views/partials/header.ejs`. Layout fetches `/api/auth/me` client-side to show login/user state.

**Client JS:** `public/js/app.js` — shared nav/theme logic. `public/js/editor-renderer.js` — `EditorRenderer` class that renders Editor.js JSON stored in `prompt`, `context`, `explanation` fields. Task17 uses React (CDN) via `.tsx` source files in `public/js/task17/` (served as static, not compiled — these are reference/development copies).

**Content fields:** `assignments.prompt`, `context`, `explanation` are stored as Editor.js JSON strings (TEXT). When reading them from the API, parse with `JSON.parse`; when writing, `JSON.stringify` if the value is already an object. The admin UI uses Editor.js loaded from CDN to edit these fields.

**Answer checking (`POST /api/check/by-id`):** Normalizes both user answer and stored answer via trim + lowercase. Also checks `alt_answers` (JSON array). Logs to `answers_log`.

**Task 17 specifics:** Uses `SPANS_IOU_THRESHOLD` env var (default 0.9) for span matching. Source text uses `(1)(2)...` digit markers. Two play modes: `digits` (user picks which digits are comma positions) and `commas` (user places commas in commaless text). The `/check` endpoint returns partial scoring for digits, commas, and span selections separately.

**Auth:** Cookie-based (`session_id`, httpOnly, 30-day maxAge). Password hashing via SHA-256 (in `auth.js`). Telegram login is demo-only (signature not verified). Auth middleware lives in `server/middleware/auth.js` but is **not applied** to admin routes.

## Key notes

- `admin.js` routes have no auth protection — anyone can call `/api/admin/*`.
- Telegram auth (`POST /api/auth/telegram`) skips signature verification — do not use in production as-is.
- `alt_answers` and `extra_data` on assignments are JSON stored as TEXT — always serialize/deserialize explicitly.
