# AI Interview Coach — Workspace Notes

## Overview

pnpm monorepo. React + Vite frontend, Express 5 API backend, PostgreSQL + Drizzle ORM, OpenAI via Replit AI Integrations.

## Stack

- **Monorepo**: pnpm workspaces
- **Node.js**: 24
- **TypeScript**: 5.9
- **Frontend**: React 19, Vite 7, Tailwind CSS 4, Wouter, TanStack Query v5
- **Backend**: Express 5 with esbuild bundling
- **Database**: PostgreSQL + Drizzle ORM + Zod validation
- **AI**: OpenAI GPT-5.2 (chat/feedback), GPT-4o-mini (analysis) via Replit AI Integrations
- **API codegen**: Orval (OpenAPI → React Query hooks + Zod types)

## Structure

```
artifacts/
  api-server/           Express 5 REST + SSE API (port 8080)
  interview-coach/      React + Vite frontend
lib/
  api-spec/             openapi.yaml (source of truth — run codegen after changes)
  api-client-react/     GENERATED React Query hooks — do not edit
  api-zod/              GENERATED Zod schemas — do not edit
  db/                   Drizzle schema: conversations, messages, interview_sessions
  integrations-openai-ai-server/
  integrations-openai-ai-react/
docs/
  SETUP.md              Full local setup guide
  API.md                Full API reference
```

## Key Files

| File | Purpose |
|---|---|
| `artifacts/api-server/src/routes/interview.ts` | All interview API endpoints |
| `artifacts/interview-coach/src/pages/interview.tsx` | Zoom-style interview screen |
| `artifacts/interview-coach/src/pages/home.tsx` | "Pass the Filter" dashboard |
| `artifacts/interview-coach/src/pages/feedback.tsx` | Post-session feedback + score |
| `artifacts/interview-coach/src/components/TalkingAvatar.tsx` | Animated SVG avatar "Sarah" |
| `lib/db/src/schema.ts` | Drizzle table definitions |
| `lib/api-spec/openapi.yaml` | OpenAPI spec (source of truth) |

## Interview Screen Layout

Zoom/Teams-style side-by-side:
- **Left panel (`.avatar-panel`, dark `#0b1622`)**: `TalkingAvatar` SVG — 3:4 video tile, 300px wide
- **Right column (`.chat-column`)**: scrollable messages + input at bottom
- **Mobile**: stacks vertically at `< 640px`

## TalkingAvatar Behaviour

- Blinking eyes: random 2.5–6.5s intervals
- Breathing: sine-wave vertical bob, 50ms ticks
- Head nodding: when `isSpeaking=true`, subtle ±4deg rotation
- Mouth animation: CSS interval loop (185ms) + Web Speech API `onboundary` events
- Speaking glow: blue border + spread when speaking; green when `feedback="good"`
- Name plate: "Sarah · AI Interviewer" + pulsing blue "Speaking" dot

## TTS / STT

- `speak()` — prefers "Google US English", rate 1.0, dispatches `avatar:boundary` on word events
- `speakAttenborough()` — prefers "Alex", rate 0.9, same boundary dispatch
- Narration checkbox in header toggles between the two voices
- STT via Web Speech API `startListening()` helper

## Timers

- Per-question: 15s / 30s / 60s / Off — starts after user's first answer; pauses while streaming
- Session: 30 min / 1 hr — countdown in header; triggers feedback on expiry

## AI Models

- Chat + feedback: `gpt-5.2`
- Job analysis (`/analyze-job`) + role research (`/research-role`): `gpt-4o-mini`

## Codegen Workflow

1. Edit `lib/api-spec/openapi.yaml`
2. `pnpm --filter @workspace/api-spec run codegen`
3. `pnpm run -r build`

## Database Migrations

```bash
cd lib/db && pnpm run push
```

Never change primary key ID column types (serial ↔ varchar) — destructive.

## Environment Secrets (Replit)

- `DATABASE_URL` — auto-provisioned by PostgreSQL integration
- `SESSION_SECRET` — set manually in Replit Secrets
- `AI_INTEGRATIONS_OPENAI_API_KEY` — injected by Replit AI Integrations
- `AI_INTEGRATIONS_OPENAI_BASE_URL` — injected by Replit AI Integrations

## Documentation

- `README.md` — project overview, quick start, feature list
- `docs/SETUP.md` — local setup step-by-step
- `docs/API.md` — full API reference with request/response examples
- `LICENSE` — MIT
