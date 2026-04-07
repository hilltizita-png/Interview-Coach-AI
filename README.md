# AI Interview Coach

A full-stack AI-powered interview preparation platform. Practice with a real-time streaming AI interviewer, receive detailed feedback, and track your readiness score — all presented in a Zoom-style interface with an animated SVG avatar.

---

## Features

- **AI Interviewer** — Streaming, real-time conversation powered by GPT-5 via Server-Sent Events
- **Animated Talking Avatar** — SVG character "Sarah" with blinking eyes, breathing, head nods, and mouth sync to speech
- **Text-to-Speech (TTS)** — Interviewer narrates every question aloud with browser speech synthesis
- **Speech-to-Text (STT)** — Answer by speaking using the Web Speech API microphone button
- **Job Analysis** — Paste any job posting and the AI extracts key skills and tailors questions to match
- **12 Built-in Roles** — Engineering, Data, Product, Design, and Business categories
- **Per-Question Timer** — Countdown pressure (15s / 30s / 60s / off) to simulate real interviews
- **Session Timer** — 30-minute or 1-hour total interview session with automatic feedback at expiry
- **Job Readiness Score** — Color-coded 1–100 score with specific improvement steps
- **In-chat Feedback** — Strengths and areas to improve after every session
- **Interview History** — Past sessions are persisted and browsable
- **Zoom/Teams Layout** — Dark avatar panel on the left, chat on the right for a real call feel
- **Dark Game-style Dashboard** — "Pass the Filter" challenge hub with streak tracking and achievements

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 7, TypeScript, Tailwind CSS 4 |
| Routing | Wouter |
| Data Fetching | TanStack Query v5 |
| UI Components | Radix UI, Lucide React |
| Backend | Node.js 24, Express 5, TypeScript |
| Database | PostgreSQL + Drizzle ORM |
| Validation | Zod v4, drizzle-zod |
| AI | OpenAI GPT-5.2 (chat/feedback), GPT-4o-mini (analysis) via Replit AI Integrations |
| API Codegen | Orval (OpenAPI → React Query hooks + Zod schemas) |
| Build | esbuild (API), Vite (frontend) |
| Package Manager | pnpm Workspaces (monorepo) |

---

## Repository Structure

```
.
├── artifacts/
│   ├── api-server/              # Express 5 REST + SSE API
│   │   └── src/
│   │       ├── index.ts         # Server entry point
│   │       └── routes/
│   │           ├── interview.ts # All interview endpoints
│   │           └── openai.ts    # Conversation management
│   └── interview-coach/         # React + Vite frontend
│       └── src/
│           ├── pages/
│           │   ├── home.tsx     # "Pass the Filter" dashboard
│           │   ├── interview.tsx# Zoom-style interview screen
│           │   └── feedback.tsx # Post-session feedback & score
│           ├── components/
│           │   └── TalkingAvatar.tsx # Animated SVG interviewer
│           └── services/
│               └── ai.ts        # Streaming chat client
├── lib/
│   ├── api-spec/                # OpenAPI 3.0 spec (source of truth)
│   │   └── openapi.yaml
│   ├── api-client-react/        # Generated React Query hooks (do not edit)
│   ├── api-zod/                 # Generated Zod schemas (do not edit)
│   ├── db/                      # Drizzle ORM schema + DB connection
│   │   └── src/schema.ts
│   ├── integrations-openai-ai-server/  # OpenAI server-side client
│   └── integrations-openai-ai-react/   # OpenAI React hooks
├── scripts/
│   └── post-merge.sh            # Runs DB migrations after task merges
├── docs/
│   ├── SETUP.md                 # Detailed local setup guide
│   └── API.md                   # Full API reference
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── package.json
```

---

## Quick Start

### Prerequisites

- **Node.js** 24 or later
- **pnpm** 9 or later (`npm install -g pnpm`)
- **PostgreSQL** 15 or later

### 1. Clone and install

```bash
git clone <your-repo-url>
cd <repo-directory>
pnpm install
```

### 2. Configure environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (e.g. `postgres://user:pass@localhost:5432/interview_coach`) |
| `SESSION_SECRET` | Random secret used to sign session cookies |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | Your OpenAI API key (or Replit AI Integrations key) |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | OpenAI-compatible base URL (default: `https://api.openai.com/v1`) |

> **On Replit:** All of the above are managed for you automatically. `DATABASE_URL` is provisioned by the built-in PostgreSQL integration, and the AI keys are injected by Replit AI Integrations — no manual setup needed.

### 3. Set up the database

```bash
cd lib/db
pnpm run push        # Syncs Drizzle schema to your database
cd ../..
```

### 4. Build shared libraries

```bash
pnpm run -r build    # Builds all packages in dependency order
```

### 5. Run in development

Open two terminals:

```bash
# Terminal 1 — API server (http://localhost:8080)
pnpm --filter @workspace/api-server run dev

# Terminal 2 — Frontend (http://localhost:3000)
pnpm --filter @workspace/interview-coach run dev
```

The frontend proxies `/api` requests to the API server automatically.

---

## Using the App

1. **Home (Pass the Filter)** — Pick a challenge type or browse past sessions.
2. **Select a Role** — Choose from 12 built-in roles or paste a job posting for a tailored interview.
3. **Interview Screen** — Zoom-style layout: Sarah (your AI interviewer) appears on the left, chat on the right.
   - Type or click the microphone to speak your answers.
   - The avatar's mouth animates in sync with TTS narration.
   - Per-question and session-level timers keep you honest.
4. **Feedback** — Click "Get Feedback" at any time (or wait for the session timer to expire) for a readiness score, strengths, and areas to improve.

---

## API Overview

Full reference: [`docs/API.md`](docs/API.md)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/interview/roles` | List all supported job roles |
| `GET` | `/api/interview/sessions` | List all past sessions |
| `POST` | `/api/interview/sessions` | Create a new interview session |
| `GET` | `/api/interview/sessions/:id` | Get session + message history |
| `DELETE` | `/api/interview/sessions/:id` | Delete a session |
| `POST` | `/api/interview/sessions/:id/chat` | **SSE** — stream AI reply |
| `GET` | `/api/interview/sessions/:id/feedback` | Generate/retrieve feedback |
| `POST` | `/api/interview/analyze-job` | Analyze a job posting |
| `POST` | `/api/interview/research-role` | Research a job title |
| `GET` | `/healthz` | Health check |

---

## Database Schema

Managed by Drizzle ORM (`lib/db/src/schema.ts`). Three tables:

```sql
conversations      id, title, createdAt
messages           id, conversationId→conversations, role, content, createdAt
interview_sessions id, jobRole, jobRoleName, jobContext, conversationId→conversations, createdAt
```

To add a column or table, edit `lib/db/src/schema.ts` then run:

```bash
cd lib/db && pnpm run push
```

---

## Codegen

The API client and Zod schemas are auto-generated from `lib/api-spec/openapi.yaml`.  
**Never edit** files inside `lib/api-client-react/src/generated/` or `lib/api-zod/src/generated/` directly.

```bash
# After changing openapi.yaml, regenerate:
pnpm --filter @workspace/api-spec run codegen
```

---

## Deployment

The project is ready to deploy on Replit with a single click using **Replit Deployments** (Autoscale).

For other platforms:

```bash
# Build the API
pnpm --filter @workspace/api-server run build
node artifacts/api-server/dist/index.mjs

# Build the frontend
pnpm --filter @workspace/interview-coach run build
# Serve artifacts/interview-coach/dist/public with any static file server
```

Make sure `DATABASE_URL`, `SESSION_SECRET`, and the AI keys are set in the deployment environment.

---

## License

MIT — see [`LICENSE`](LICENSE).
