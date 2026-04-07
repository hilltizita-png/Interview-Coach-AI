# AI Interview Coach

A full-stack AI-powered interview preparation platform. Practice with a streaming AI interviewer, get detailed post-session feedback, and track your job readiness score — all inside a Zoom-style interface with an animated talking avatar.

---

## Features

- **Streaming AI Interviewer** — Real-time conversation over Server-Sent Events (SSE), powered by GPT-4o / GPT-4o-mini via Replit AI Integrations
- **Animated Talking Avatar** — SVG character "Sarah" with blinking eyes, head nods, breathing idle, and mouth sync to speech
- **Text-to-Speech (TTS)** — Every AI response is narrated aloud using the browser Speech Synthesis API
- **Speech-to-Text (STT)** — Answer by speaking; the Web Speech API transcribes your voice live
- **PDF Resume Upload** — Upload your resume as a PDF, `.txt`, or `.md`; text is extracted client-side with PDF.js and used to tailor questions
- **Job Posting Analysis** — Paste any job posting and the AI extracts key skills and custom-tailors the entire session
- **12 Built-in Roles** — Engineering, Data, Product, Design, and Business categories
- **Job Readiness Score** — Color-coded 1–100 score with specific next steps
- **In-chat Feedback** — Strengths and areas to improve surfaced after every session
- **Interview History** — All past sessions are persisted in PostgreSQL and browsable
- **Zoom-style Interview Screen** — Full-screen dark avatar panel, floating chat side panel, control bar bottom-left, mic/speaker/feedback/end-session controls
- **"Pass the Filter" Dashboard** — Four distinct challenge modes with mode-specific rules and timers

---

## Challenge Modes

| Mode | Time Limit | Questions | Behavior |
|---|---|---|---|
| **Quick Round** | 10 min | 5 | Fast-fire questions; auto-feedback when time or questions run out |
| **Full Session** | 40 min | Unlimited | Full interview experience; Sarah closes warmly, then feedback loads |
| **Answer Lab** | None | Unlimited | No pressure — practice phrasing, request feedback anytime |
| **Boss Round** | 15 min | 5 | Fetches your past session weaknesses and targets them with the hardest questions |

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
| AI | GPT-4o (chat/feedback), GPT-4o-mini (analysis) via Replit AI Integrations |
| PDF Parsing | pdfjs-dist (client-side, no server required) |
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
│           │   ├── feedback.tsx # Post-session feedback & score
│           │   └── profile.tsx  # Resume upload + job postings
│           ├── components/
│           │   └── TalkingAvatar.tsx # Animated SVG interviewer
│           ├── contexts/
│           │   └── profile-context.tsx # Resume + postings state
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
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Random secret used to sign session cookies |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | OpenAI API key |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | OpenAI-compatible base URL (default: `https://api.openai.com/v1`) |

> **On Replit:** All of the above are managed automatically — no `.env` file needed.

### 3. Set up the database

```bash
cd lib/db && pnpm run push && cd ../..
```

### 4. Build shared libraries

```bash
pnpm run -r build
```

### 5. Run in development

```bash
# Terminal 1 — API server
pnpm --filter @workspace/api-server run dev

# Terminal 2 — Frontend
pnpm --filter @workspace/interview-coach run dev
```

The frontend proxies `/api` requests to the API server automatically.

---

## Using the App

1. **Profile** — Upload your resume (PDF, `.txt`, or `.md`) and save job postings for quick access.
2. **Challenges (Home)** — Pick a mode: Quick Round, Full Session, Answer Lab, or Boss Round.
3. **Select a Role** — Choose from 12 built-in roles or paste a job posting for a tailored session.
4. **Interview Screen** — Zoom-style layout with Sarah on the left, chat panel on the right.
   - Type responses in the chat panel or click the microphone to speak.
   - The avatar's mouth animates in sync with TTS narration.
   - A control bar in the bottom-left has mic, speaker, inline feedback, and end-session buttons.
   - The chat panel slides in from the right; a floating button in the bottom-right toggles it.
5. **Feedback** — Click "Feedback" in the control bar at any time, or let the session timer expire. A readiness score, strengths, and improvement steps are shown on the feedback screen.

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
| `POST` | `/api/interview/sessions/:id/chat` | SSE — stream AI reply |
| `GET` | `/api/interview/sessions/:id/feedback` | Generate or retrieve feedback |
| `POST` | `/api/interview/analyze-job` | Analyze a job posting |
| `POST` | `/api/interview/research-role` | Research a job title |
| `GET` | `/healthz` | Health check |

---

## Database Schema

Managed by Drizzle ORM (`lib/db/src/schema.ts`). Three tables:

```
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
# After changing openapi.yaml:
pnpm --filter @workspace/api-spec run codegen
```

---

## Deployment

The project is ready to deploy on Replit with a single click using **Replit Deployments**.

For other platforms:

```bash
# Build the API
pnpm --filter @workspace/api-server run build
node artifacts/api-server/dist/index.mjs

# Build the frontend
pnpm --filter @workspace/interview-coach run build
# Serve artifacts/interview-coach/dist/public with any static file server
```

Ensure `DATABASE_URL`, `SESSION_SECRET`, and the AI keys are set in your deployment environment.

---

## License

MIT — see [`LICENSE`](LICENSE).
