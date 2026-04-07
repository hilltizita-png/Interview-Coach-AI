# Setup Guide

Everything you need to run AI Interview Coach locally — from prerequisites to a fully working development environment.

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

This installs dependencies for every package in `artifacts/` and `lib/`, including `pdfjs-dist` for client-side PDF parsing.

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
cp .env.example .env
```

Fill in the following values:

```env
# PostgreSQL connection string
DATABASE_URL=postgres://ic_user:your_password@localhost:5432/interview_coach

# Session signing secret — any long random string
SESSION_SECRET=replace_this_with_a_long_random_secret_string

# OpenAI API credentials
AI_INTEGRATIONS_OPENAI_API_KEY=sk-...your-openai-api-key...
AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1

# Server port (API server)
PORT=8080

# Frontend base path (usually /)
BASE_PATH=/
```

> **Replit users:** All of the above are automatically injected — no `.env` file needed. `DATABASE_URL` is provisioned by the built-in PostgreSQL integration and the AI keys come from Replit AI Integrations.

### Getting an OpenAI API key

1. Go to https://platform.openai.com/api-keys
2. Create a new secret key
3. Set it as `AI_INTEGRATIONS_OPENAI_API_KEY`

The app uses **GPT-4o** for interview chat and feedback, and **GPT-4o-mini** for job analysis and role research.

---

## 5. Run the Database Schema

Drizzle ORM syncs your schema automatically:

```bash
cd lib/db
pnpm run push
cd ../..
```

On a fresh database, Drizzle creates all three tables (`conversations`, `messages`, `interview_sessions`). On an existing database it applies only the changes.

---

## 6. Build Shared Libraries

The shared `lib/` packages must be compiled before the apps can import them:

```bash
pnpm run -r build
```

This builds `api-zod`, `api-client-react`, `db`, and the AI integration packages in dependency order.

---

## 7. Start Development Servers

You need two processes running at the same time.

### API Server

```bash
pnpm --filter @workspace/api-server run dev
```

Starts at **http://localhost:8080**. You'll see:

```
Server listening  port: 8080
```

### Frontend

```bash
pnpm --filter @workspace/interview-coach run dev
```

Vite starts the React app. Open **http://localhost:3000** (or the port Vite picks) in your browser.

The frontend automatically proxies `/api` requests to the API server — no CORS configuration needed.

---

## 8. Verify Everything Works

1. Open the browser — you should see the **"Pass the Filter"** challenge dashboard.
2. Navigate to **Profile** via the sidebar and upload or paste your resume.
3. Click a challenge mode (Quick Round, Full Session, Answer Lab, Boss Round).
4. Select a role or paste a job posting and click **Begin**.
5. The interview screen opens in Zoom-style layout: Sarah's avatar fills the left panel, the chat panel slides in from the right.
6. Type a message and press Enter — the AI streams a reply and Sarah's mouth animates.
7. Click **Feedback** in the bottom-left control bar at any time to get your readiness score.

---

## Troubleshooting

### "PORT environment variable is required"

Set it explicitly when starting the frontend:

```bash
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/interview-coach run dev
```

### Database connection errors

Confirm PostgreSQL is running and your connection string is correct:

```bash
psql "$DATABASE_URL" -c "SELECT 1;"
```

### "Cannot find module @workspace/..."

The shared libraries haven't been built. Run:

```bash
pnpm run -r build
```

### Schema out of sync

After pulling changes that include schema modifications, re-run:

```bash
cd lib/db && pnpm run push
```

### AI responses not streaming

Check that `AI_INTEGRATIONS_OPENAI_API_KEY` and `AI_INTEGRATIONS_OPENAI_BASE_URL` are set correctly and that your key has access to `gpt-4o`.

### PDF upload extracts no text

Only text-based PDFs (where you can highlight/copy text) are supported. Scanned image PDFs require OCR and are not supported client-side. Ask the candidate to export from Word or Google Docs as a PDF.

---

## Updating the API

If you add or change API routes:

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
# Build the API server
pnpm --filter @workspace/api-server run build
node artifacts/api-server/dist/index.mjs

# Build the frontend
pnpm --filter @workspace/interview-coach run build
# Serve artifacts/interview-coach/dist/public/ with nginx, Caddy, or any static file server
```

Set `DATABASE_URL`, `SESSION_SECRET`, and the AI keys in your production environment before deploying.
