# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **AI**: OpenAI via Replit AI Integrations (`gpt-5.2`)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── interview-coach/    # React + Vite frontend (AI Interview Coach)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   ├── db/                 # Drizzle ORM schema + DB connection
│   ├── integrations-openai-ai-server/  # OpenAI server-side client
│   └── integrations-openai-ai-react/   # OpenAI React hooks
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## AI Interview Coach App

A React web app where users select a job role and chat with an AI interviewer.

### Features
- Role selection from 12 job roles across 5 categories (Engineering, Data, Product, Design, Business)
- Real-time streaming AI interview chat (SSE)
- AI-powered feedback after each session (score, strengths, areas to improve)
- Interview history

### Database Tables
- `conversations` — OpenAI conversation threads
- `messages` — Individual messages per conversation  
- `interview_sessions` — Links job role to a conversation

### API Routes
- `GET /api/interview/roles` — List available job roles (static)
- `GET/POST /api/interview/sessions` — List / create interview sessions
- `GET/DELETE /api/interview/sessions/:id` — Get / delete session with messages
- `POST /api/interview/sessions/:id/chat` — SSE streaming AI chat
- `GET /api/interview/sessions/:id/feedback` — Get AI feedback for session

### Environment Variables
- `DATABASE_URL` — PostgreSQL connection string
- `AI_INTEGRATIONS_OPENAI_BASE_URL` — Replit AI Integrations proxy URL
- `AI_INTEGRATIONS_OPENAI_API_KEY` — Replit AI Integrations API key

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all lib packages as project references.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/`.

### `artifacts/interview-coach` (`@workspace/interview-coach`)

React + Vite frontend for the AI Interview Coach app.

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL.

- `src/schema/conversations.ts` — OpenAI conversations
- `src/schema/messages.ts` — OpenAI messages
- `src/schema/interviewSessions.ts` — Interview sessions

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI spec and Orval codegen config. Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/integrations-openai-ai-server` (`@workspace/integrations-openai-ai-server`)

Server-side OpenAI client via Replit AI Integrations proxy.

### `lib/integrations-openai-ai-react` (`@workspace/integrations-openai-ai-react`)

React hooks for OpenAI voice/audio features.
