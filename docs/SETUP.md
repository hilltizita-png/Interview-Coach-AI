# Setup Guide

This guide covers everything you need to run the AI Interview Coach locally, from prerequisites through to a working development environment.

---

## Prerequisites

| Requirement | Minimum Version | Install |
|---|---|---|
| Node.js | 24.x | https://nodejs.org |
| pnpm | 9.x | `npm install -g pnpm` |
| PostgreSQL | 15.x | https://www.postgresql.org/download/ |
| Git | any | https://git-scm.com |

Verify your versions:

```bash
node --version    # v24.x.x
pnpm --version    # 9.x.x
psql --version    # psql (PostgreSQL) 15.x
```

---

## 1. Clone the Repository

```bash
git clone <your-repo-url>
cd <repo-directory>
```

---

## 2. Install Dependencies

pnpm handles all packages across the monorepo in one command:

```bash
pnpm install
```

This installs dependencies for every package in `artifacts/` and `lib/`.

---

## 3. Create a PostgreSQL Database

```bash
psql -U postgres
```

```sql
CREATE DATABASE interview_coach;
CREATE USER ic_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE interview_coach TO ic_user;
\q
```

Your connection string will be:
```
postgres://ic_user:your_password@localhost:5432/interview_coach
```

---

## 4. Environment Variables

Create a `.env` file in the project root:

```bash
cp .env.example .env   # if the example exists
# or create it manually:
touch .env
```

Add the following to `.env`:

```env
# Database
DATABASE_URL=postgres://ic_user:your_password@localhost:5432/interview_coach

# Session signing secret — any long random string
SESSION_SECRET=replace_this_with_a_long_random_secret_string

# OpenAI API
AI_INTEGRATIONS_OPENAI_API_KEY=sk-...your-openai-api-key...
AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1

# Server port (API)
PORT=8080

# Frontend base path (usually /)
BASE_PATH=/
```

> **Replit users:** These are all automatically injected — you do not need a `.env` file.

### Getting an OpenAI API key

1. Go to https://platform.openai.com/api-keys
2. Create a new secret key
3. Paste it as `AI_INTEGRATIONS_OPENAI_API_KEY`

The app uses `gpt-5.2` for interview chat and feedback, and `gpt-4o-mini` for job analysis and role research.

---

## 5. Run the Database Schema

Drizzle ORM syncs your schema automatically:

```bash
cd lib/db
pnpm run push
cd ../..
```

You should see output similar to:

```
[✓] Pulling schema from database...
[i] No changes detected
```

If it's a fresh database, Drizzle will create all tables.

---

## 6. Build Shared Libraries

The shared `lib/` packages need to be built before the apps can use them:

```bash
pnpm run -r build
```

This compiles `api-zod`, `api-client-react`, `db`, and the AI integration packages in the correct order.

---

## 7. Start Development Servers

You need two processes running simultaneously. Open two terminal tabs or use a process manager.

### API Server

```bash
pnpm --filter @workspace/api-server run dev
```

The API builds with esbuild and starts at **http://localhost:8080**.  
You'll see:

```
Server listening  port: 8080
```

### Frontend

```bash
pnpm --filter @workspace/interview-coach run dev
```

Vite starts the React app at **http://localhost:3000** (or whichever port Vite picks).

Open http://localhost:3000 in your browser.

---

## 8. Verify Everything Works

1. Open the browser — you should see the "Pass the Filter" dashboard.
2. Click a challenge or role to navigate to the interview screen.
3. The header shows the role name; the avatar panel appears on the left.
4. Type a message and press Enter — the AI should reply with streamed text.
5. Check the API server terminal for request logs.

---

## Troubleshooting

### "PORT environment variable is required"
The frontend Vite config reads `PORT` and `BASE_PATH` at startup. Set them explicitly:

```bash
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/interview-coach run dev
```

### Database connection errors
Ensure PostgreSQL is running and the `DATABASE_URL` is correct:

```bash
psql "$DATABASE_URL" -c "SELECT 1;"
```

### "Cannot find module @workspace/..."
The shared libraries haven't been built yet. Run:

```bash
pnpm run -r build
```

### Schema out of sync
If you pull new changes that include schema modifications, re-run:

```bash
cd lib/db && pnpm run push
```

### AI responses not streaming
Check that `AI_INTEGRATIONS_OPENAI_API_KEY` and `AI_INTEGRATIONS_OPENAI_BASE_URL` are set correctly and that your key has access to `gpt-5.2`.

---

## Running Tests

End-to-end tests use Playwright:

```bash
pnpm --filter @workspace/interview-coach run test
```

---

## Updating the API

If you add or change routes, regenerate the client and schemas:

1. Edit `lib/api-spec/openapi.yaml`
2. Run codegen:
   ```bash
   pnpm --filter @workspace/api-spec run codegen
   ```
3. Rebuild:
   ```bash
   pnpm run -r build
   ```

---

## Production Build

```bash
# API
pnpm --filter @workspace/api-server run build
# Binary is at artifacts/api-server/dist/index.mjs

# Frontend
pnpm --filter @workspace/interview-coach run build
# Static files are at artifacts/interview-coach/dist/public/
```

Serve the frontend with any static file server (nginx, Caddy, serve, etc.) and point `/api` to the API server.
