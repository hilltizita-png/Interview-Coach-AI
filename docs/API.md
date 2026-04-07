# API Reference

All endpoints are prefixed with `/api`. The server runs on port `8080` by default.

Requests and responses use `application/json` unless otherwise stated.

---

## Health

### `GET /healthz`

Returns 200 if the server is running.

**Response**

```json
{ "status": "ok" }
```

---

## Interview Roles

### `GET /api/interview/roles`

Returns the static list of supported job roles.

**Response**

```json
[
  { "id": "software-engineer", "name": "Software Engineer", "category": "Engineering" },
  { "id": "data-scientist",    "name": "Data Scientist",    "category": "Data" },
  ...
]
```

**Categories:** `Engineering`, `Data`, `Product`, `Design`, `Business`

---

## Interview Sessions

### `GET /api/interview/sessions`

Returns all past interview sessions, newest first.

**Response**

```json
[
  {
    "id": 42,
    "jobRole": "software-engineer",
    "jobRoleName": "Software Engineer",
    "jobContext": null,
    "createdAt": "2026-04-07T12:00:00.000Z"
  }
]
```

---

### `POST /api/interview/sessions`

Creates a new session. The AI sends an opening greeting automatically.

**Request Body**

```json
{
  "jobRole": "software-engineer",
  "jobRoleName": "Software Engineer",
  "jobContext": "Optional: extracted job description text"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `jobRole` | string | yes | Role identifier (e.g. `"software-engineer"`) |
| `jobRoleName` | string | yes | Display name |
| `jobContext` | string | no | Tailors the interview to a specific posting |

**Response** `201`

```json
{
  "id": 42,
  "jobRole": "software-engineer",
  "jobRoleName": "Software Engineer",
  "jobContext": null,
  "conversationId": 99,
  "createdAt": "2026-04-07T12:00:00.000Z"
}
```

---

### `GET /api/interview/sessions/:id`

Returns a session with its full message history.

**Response**

```json
{
  "id": 42,
  "jobRole": "software-engineer",
  "jobRoleName": "Software Engineer",
  "jobContext": null,
  "conversationId": 99,
  "createdAt": "2026-04-07T12:00:00.000Z",
  "messages": [
    {
      "id": 1,
      "role": "assistant",
      "content": "Hello! I'm Sarah, your AI interviewer. Let's get started...",
      "createdAt": "2026-04-07T12:00:01.000Z"
    }
  ]
}
```

**Errors**

| Code | Reason |
|---|---|
| `404` | Session not found |

---

### `DELETE /api/interview/sessions/:id`

Permanently deletes a session and all associated messages.

**Response** `204 No Content`

---

### `POST /api/interview/sessions/:id/chat`

**SSE endpoint** — streams the AI's reply token by token.

**Request Body**

```json
{
  "messages": [
    { "role": "user",      "content": "Tell me about yourself." },
    { "role": "assistant", "content": "..." },
    { "role": "user",      "content": "How do you handle conflict?" }
  ],
  "context": "Optional job description text",
  "timeLeft": 1200
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `messages` | array | yes | Full conversation so far |
| `context` | string | no | Job context override |
| `timeLeft` | number | no | Remaining session time in seconds; prompts the AI to wrap up when low |

**Response** — Server-Sent Events stream

```
data: {"delta":"Hello"}
data: {"delta":", how"}
data: {"delta":" can I help?"}
data: [DONE]
```

Each `data` line contains a JSON object with a `delta` key (the next token chunk).  
The stream ends with the literal string `[DONE]`.

---

### `GET /api/interview/sessions/:id/feedback`

Generates (or returns cached) AI feedback for the session.

**Response**

```json
{
  "strengths": [
    "Clear communication of technical concepts",
    "Strong examples using the STAR method"
  ],
  "areasForImprovement": [
    "Elaborate more on system design trade-offs",
    "Quantify achievements where possible"
  ],
  "readinessScore": 74,
  "readinessImprovements": [
    "Practice explaining distributed systems",
    "Prepare 2–3 conflict-resolution stories"
  ]
}
```

| Field | Type | Description |
|---|---|---|
| `strengths` | string[] | Things the candidate did well |
| `areasForImprovement` | string[] | Specific things to work on |
| `readinessScore` | number | 1–100 job readiness score |
| `readinessImprovements` | string[] | Actionable steps to raise the score |

**Score colours** (frontend convention):
- **Green** ≥ 75 — Ready
- **Amber** ≥ 50 — Getting there
- **Rose** < 50 — Needs work

---

## AI Utilities

### `POST /api/interview/analyze-job`

Extracts a structured job summary from a raw job posting.

**Request Body**

```json
{
  "jobPosting": "We are looking for a Senior Software Engineer to join our backend team..."
}
```

**Response**

```json
{
  "title": "Senior Software Engineer",
  "summary": "Backend-focused role requiring 5+ years experience...",
  "keySkills": ["Node.js", "PostgreSQL", "Distributed Systems"],
  "responsibilities": ["Design APIs", "Lead code reviews", "Mentor juniors"]
}
```

---

### `POST /api/interview/research-role`

Generates a profile and common interview topics for a job title.

**Request Body**

```json
{ "jobTitle": "Product Manager" }
```

**Response**

```json
{
  "overview": "Product Managers own the product vision and roadmap...",
  "commonTopics": [
    "Prioritization frameworks (RICE, MoSCoW)",
    "Stakeholder management",
    "Metrics and success criteria"
  ],
  "typicalQuestions": [
    "Tell me about a product you launched from scratch.",
    "How do you handle conflicting priorities from engineering and sales?"
  ]
}
```

---

## Conversations (Low-level)

These endpoints manage the underlying conversation objects used by the interview sessions. You generally don't need to call them directly.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/openai/conversations` | List all conversations |
| `POST` | `/api/openai/conversations` | Create a conversation |
| `GET` | `/api/openai/conversations/:id` | Get conversation + messages |
| `DELETE` | `/api/openai/conversations/:id` | Delete a conversation |
| `POST` | `/api/openai/conversations/:id/messages` | Send a message (SSE stream) |

---

## Error Format

All errors return JSON:

```json
{
  "error": "Human-readable message or Zod validation details"
}
```

| Status | Meaning |
|---|---|
| `400` | Bad request / validation error |
| `404` | Resource not found |
| `500` | Internal server error |
