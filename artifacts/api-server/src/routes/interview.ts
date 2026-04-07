/**
 * routes/interview.ts — All interview-related API endpoints
 *
 * This file registers every route the frontend calls during an interview session.
 * It is mounted at /api by the Express app in index.ts, so all paths below
 * are relative to /api (e.g. router.get("/interview/roles") → GET /api/interview/roles).
 *
 * Route summary:
 *   GET  /interview/roles                    → static list of job roles
 *   GET  /interview/sessions                 → all past sessions (newest first)
 *   POST /interview/sessions                 → create a session + insert the greeting
 *   GET  /interview/sessions/:id             → one session with its messages
 *   DELETE /interview/sessions/:id           → delete session + all messages
 *   POST /interview/sessions/:id/chat        → SSE: stream an AI reply
 *   GET  /interview/sessions/:id/feedback    → generate/return AI feedback
 *   POST /interview/analyze-job              → summarise a job posting (GPT-4o-mini)
 *   POST /interview/research-role            → research a job title (GPT-4o-mini)
 *
 * Database tables used (defined in lib/db/src/schema.ts):
 *   conversations      — one row per interview session (holds the title)
 *   messages           — every chat message (role: user | assistant | system)
 *   interview_sessions — links a conversation to a job role + context
 */

import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import { db, conversations, messages, interviewSessions } from "@workspace/db";
import {
  CreateInterviewSessionBody,
  GetInterviewSessionParams,
  DeleteInterviewSessionParams,
  SendInterviewMessageBody,
  SendInterviewMessageParams,
  GetInterviewFeedbackParams,
} from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

/**
 * Static list of supported job roles.
 * To add a new role, append an entry here — no other changes needed.
 * The frontend fetches this list and shows it in the challenge mode picker.
 */
const JOB_ROLES = [
  { id: "software-engineer", name: "Software Engineer", category: "Engineering", description: "Technical interviews covering algorithms, system design, and coding skills" },
  { id: "frontend-engineer", name: "Frontend Engineer", category: "Engineering", description: "React, CSS, performance, and web platform questions" },
  { id: "backend-engineer", name: "Backend Engineer", category: "Engineering", description: "APIs, databases, architecture, and scalability" },
  { id: "data-scientist", name: "Data Scientist", category: "Data & Analytics", description: "Statistics, ML models, Python, and data storytelling" },
  { id: "data-analyst", name: "Data Analyst", category: "Data & Analytics", description: "SQL, visualization, business insight, and reporting" },
  { id: "product-manager", name: "Product Manager", category: "Product", description: "Product strategy, prioritization, metrics, and stakeholder management" },
  { id: "ux-designer", name: "UX Designer", category: "Design", description: "User research, design thinking, Figma, and usability" },
  { id: "devops-engineer", name: "DevOps Engineer", category: "Engineering", description: "CI/CD, Kubernetes, cloud infrastructure, and reliability" },
  { id: "marketing-manager", name: "Marketing Manager", category: "Business", description: "Campaigns, brand strategy, analytics, and growth" },
  { id: "sales-executive", name: "Sales Executive", category: "Business", description: "Sales process, negotiation, quota attainment, and CRM" },
  { id: "project-manager", name: "Project Manager", category: "Operations", description: "Planning, risk management, stakeholder communication, and delivery" },
  { id: "finance-analyst", name: "Finance Analyst", category: "Finance", description: "Financial modeling, valuation, budgeting, and reporting" },
];

/** GET /api/interview/roles — Returns the full static list of supported job roles. */
router.get("/interview/roles", (_req, res): void => {
  res.json(JOB_ROLES);
});

/** GET /api/interview/sessions — Returns all past interview sessions, oldest first. */
router.get("/interview/sessions", async (_req, res): Promise<void> => {
  const sessions = await db
    .select()
    .from(interviewSessions)
    .orderBy(asc(interviewSessions.createdAt));
  res.json(sessions);
});

/**
 * POST /api/interview/sessions — Create a new interview session.
 *
 * Steps:
 *   1. Validate the request body with Zod (jobRole, jobRoleName, optional jobContext).
 *   2. Create a conversations row (the parent record for all messages).
 *   3. Choose an appropriate opening greeting based on whether a specific role
 *      or a generic/skill-based session was requested.
 *   4. Insert the greeting as the first assistant message.
 *   5. Create the interview_sessions row linking everything together.
 *   6. Return the new session object (201 Created).
 */
router.post("/interview/sessions", async (req, res): Promise<void> => {
  const parsed = CreateInterviewSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const title = `${parsed.data.jobRoleName} Interview`;
  const [convo] = await db.insert(conversations).values({ title }).returning();

  const jobContext = parsed.data.jobContext ?? null;

  // Determine what kind of greeting to use based on the role name:
  //   isGeneric   → no specific role selected; use a neutral opener
  //   isSkillMode → Answer Lab: focus on a specific skill area
  //   otherwise   → a specific job title or posting; name it in the greeting
  const isGeneric = !parsed.data.jobRoleName || parsed.data.jobRoleName === "General Interview";
  const isSkillMode = ["Technical Skills", "Behavioural Scenarios", "Confidence & Delivery"].includes(parsed.data.jobRoleName);

  const greeting = isGeneric
    ? `Hi, thanks for coming in today. I'm your AI interviewer for this practice session. Let's get started — tell me a bit about yourself and what's brought you to this point in your career.`
    : isSkillMode
    ? `Hi, thanks for coming in today. I'm your AI interviewer and we'll be focusing on ${parsed.data.jobRoleName} today. Let's get started — tell me a bit about yourself.`
    : `Hi, thanks for coming in today. I'm conducting the interview for the ${parsed.data.jobRoleName} position. Let's get started — tell me a bit about yourself and what's brought you to this point in your career.`;

  // Insert the greeting as the first message in the conversation.
  await db.insert(messages).values({
    conversationId: convo.id,
    role: "assistant",
    content: greeting,
  });

  // Create the session record that ties the conversation to the job role.
  const [session] = await db
    .insert(interviewSessions)
    .values({
      jobRole: parsed.data.jobRole,
      jobRoleName: parsed.data.jobRoleName,
      jobContext,
      conversationId: convo.id,
    })
    .returning();

  res.status(201).json(session);
});

/**
 * POST /api/interview/analyze-job — Summarise a raw job posting.
 *
 * The frontend sends a full job posting text; GPT-4o-mini extracts the key
 * responsibilities, skills, and experience into a short bullet-point summary.
 * This summary is stored as jobContext on the session and injected into the
 * AI system prompt so questions are tailored to the specific role.
 */
router.post("/interview/analyze-job", async (req, res): Promise<void> => {
  const { posting } = req.body;
  if (!posting || typeof posting !== "string") {
    res.status(400).json({ error: "posting is required" });
    return;
  }

  const result = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_completion_tokens: 512,
    messages: [
      {
        role: "system",
        content:
          "You are a recruitment analyst. Extract the main responsibilities, required skills, and experience from the following job posting. Return them as a short summary in bullet form.",
      },
      { role: "user", content: posting },
    ],
  });

  const summary = result.choices[0]?.message?.content ?? "";
  res.json({ summary });
});

/**
 * POST /api/interview/research-role — Generate a role profile for a job title.
 *
 * Used when the user selects a built-in role (e.g. "Product Manager") without
 * pasting a job posting. GPT-4o-mini generates a realistic profile including
 * responsibilities, required skills, and common interview topics, which is then
 * used as the jobContext to tailor interview questions.
 */
router.post("/interview/research-role", async (req, res): Promise<void> => {
  const { role } = req.body;
  if (!role || typeof role !== "string") {
    res.status(400).json({ error: "role is required" });
    return;
  }

  const result = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_completion_tokens: 512,
    messages: [
      {
        role: "system",
        content: `You are a career analyst.

Given a job title, generate a realistic job profile including:
- Key responsibilities
- Required skills
- Common interview topics

Keep it concise and structured.`,
      },
      { role: "user", content: role },
    ],
  });

  res.json({ summary: result.choices[0]?.message?.content ?? "" });
});

/**
 * GET /api/interview/sessions/:id — Return one session with its full message history.
 *
 * System messages (role === "system") are filtered out before returning so the
 * frontend never sees the internal prompt instructions.
 */
router.get("/interview/sessions/:id", async (req, res): Promise<void> => {
  const params = GetInterviewSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [session] = await db
    .select()
    .from(interviewSessions)
    .where(eq(interviewSessions.id, params.data.id));
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, session.conversationId))
    .orderBy(asc(messages.createdAt));

  // Strip system messages — they contain internal prompt instructions that
  // should never be shown to the user.
  const visibleMessages = msgs.filter((m) => m.role !== "system");

  res.json({ ...session, messages: visibleMessages });
});

/**
 * DELETE /api/interview/sessions/:id — Permanently delete a session and all its messages.
 *
 * Deleting the conversations row cascades to the messages table (via foreign key),
 * so we only need one DELETE query. The interview_sessions row is also removed
 * because it references the conversation.
 */
router.delete("/interview/sessions/:id", async (req, res): Promise<void> => {
  const params = DeleteInterviewSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [session] = await db
    .select()
    .from(interviewSessions)
    .where(eq(interviewSessions.id, params.data.id));
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  await db
    .delete(conversations)
    .where(eq(conversations.id, session.conversationId));

  res.sendStatus(204);
});

/**
 * POST /api/interview/sessions/:id/chat — Stream the AI interviewer's next reply.
 *
 * This is a Server-Sent Events (SSE) endpoint. The HTTP connection stays open
 * and the server writes tokens as they arrive from the OpenAI streaming API.
 * Each write looks like: `data: {"content":"Hello"}\n\n`
 * The stream ends with: `data: {"done":true}\n\n`
 *
 * How the AI is instructed:
 *   - A system prompt is constructed from the session's jobContext (if any).
 *   - Two optional hints are appended: a time note (when < ~60 s remain) and a
 *     questions note (when a question-limit mode like Quick Round is active).
 *   - The full conversation history (user + assistant turns) is sent with every
 *     request so the AI has complete context of the interview so far.
 *
 * After the stream completes, the full AI response is saved to the database
 * as a new assistant message.
 */
router.post("/interview/sessions/:id/chat", async (req, res): Promise<void> => {
  const params = SendInterviewMessageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = SendInterviewMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [session] = await db
    .select()
    .from(interviewSessions)
    .where(eq(interviewSessions.id, params.data.id));
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const clientMessages = parsed.data.messages;
  const context = parsed.data.context;
  const timeLeft = parsed.data.timeLeft;
  // questionsLeft is not in the Zod schema (it was added later), so we read it directly.
  const questionsLeft = typeof req.body.questionsLeft === "number" ? req.body.questionsLeft : undefined;

  // Save the most recent user message to the database before generating a reply.
  // We search in reverse because the last user message is the one just submitted.
  const lastUserMsg = [...clientMessages].reverse().find((m) => m.role === "user");
  if (lastUserMsg) {
    await db.insert(messages).values({
      conversationId: session.conversationId,
      role: "user",
      content: lastUserMsg.content,
    });
  }

  // Append a time note to the system prompt when the session timer is running low.
  // This nudges the AI to start wrapping up rather than asking a long new question.
  const timeNote = timeLeft !== undefined
    ? `\nTime remaining in this session: ${timeLeft} seconds. Keep questions concise and direct.`
    : "";

  // Append a questions note for modes with a fixed question count (Quick Round, Boss Round).
  // When questionsLeft is 0 the AI asks its final closing question.
  const questionsNote = questionsLeft !== undefined
    ? questionsLeft === 0
      ? `\nThis is the FINAL question of the session. Ask one last strong closing question.`
      : `\nThere ${questionsLeft === 1 ? "is 1 question" : `are ${questionsLeft} questions`} remaining in this session (including this one). Pace accordingly.`
    : "";

  // Build the system prompt. If a jobContext was provided (job posting text, resume,
  // mode-specific instructions), use it as the role description. Otherwise fall back
  // to the session's stored jobRoleName.
  const systemPrompt = context
    ? `You are an AI hiring manager conducting a real interview for a role with the following description:

${context}

Rules:
- Ask exactly one interview question at a time.
- After the candidate answers, immediately ask the next relevant question without providing feedback, commentary, praise, or guidance.
- Keep the interview flowing naturally like a real interview.
- Do not coach, hint, or suggest how to improve answers during the session.
- Only ask questions — never explain, evaluate, or summarize mid-session.${timeNote}${questionsNote}`
    : `You are an AI hiring manager conducting a practice interview for the ${session.jobRoleName} position.

Rules:
- Ask exactly one interview question at a time.
- After the candidate answers, immediately ask the next relevant question without providing feedback, commentary, praise, or guidance.
- Keep the interview flowing naturally like a real interview.
- Do not coach, hint, or suggest how to improve answers during the session.
- Only ask questions — never explain, evaluate, or summarize mid-session.${timeNote}${questionsNote}`;

  // Prepend the system prompt to the full conversation history.
  const chatMessages = [
    { role: "system" as const, content: systemPrompt },
    ...clientMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  // Set SSE headers so the browser knows to keep the connection alive.
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullResponse = "";

  // Open a streaming request to OpenAI and forward each token to the client.
  const stream = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 8192,
    messages: chatMessages,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      fullResponse += content;
      res.write(`data: ${JSON.stringify({ content })}\n\n`);
    }
  }

  // Persist the completed AI response to the database.
  await db.insert(messages).values({
    conversationId: session.conversationId,
    role: "assistant",
    content: fullResponse,
  });

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

/**
 * GET /api/interview/sessions/:id/feedback — Generate AI feedback for a session.
 *
 * Builds a transcript from all visible messages, assembles an evaluation prompt,
 * and calls GPT to produce a structured JSON object with:
 *   overallScore, strengths, areasForImprovement, summary,
 *   readinessScore, readinessImprovements, toneScore, confidenceScore, communicationScore
 *
 * Note: There is no caching — every request re-generates feedback. If you need to
 * avoid repeat API calls, add a feedbackCache column to interview_sessions and
 * check for an existing value before calling OpenAI.
 *
 * If the AI returns malformed JSON, a safe fallback object is used rather than
 * returning a 500 error to the user.
 */
router.get("/interview/sessions/:id/feedback", async (req, res): Promise<void> => {
  const params = GetInterviewFeedbackParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [session] = await db
    .select()
    .from(interviewSessions)
    .where(eq(interviewSessions.id, params.data.id));
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, session.conversationId))
    .orderBy(asc(messages.createdAt));

  // Filter out system messages so they don't appear in the transcript.
  const visibleMessages = msgs.filter((m) => m.role !== "system");

  // Format the conversation as a human-readable transcript for the AI evaluator.
  const transcript = visibleMessages
    .map((m) => `${m.role === "user" ? "Candidate" : "Interviewer"}: ${m.content}`)
    .join("\n\n");

  // Append the job description if one was stored on the session.
  const jobContext = session.jobContext
    ? `\n\nJob Description:\n${session.jobContext}`
    : "";

  // The feedback prompt instructs the AI to act as an interview coach and return
  // structured JSON. The JSON schema is specified in the prompt rather than using
  // the OpenAI JSON mode so we stay compatible with older model versions.
  const feedbackPrompt = `You are an expert interview coach. Review this mock interview transcript for the position of ${session.jobRoleName} and provide structured feedback.

Evaluate the candidate on:
- Quality and relevance of answers
- Tone: professionalism, warmth, and appropriateness of language
- Confidence: assertiveness, directness, and avoidance of excessive hedging or filler phrases
- Communication style: clarity, conciseness, and ability to stay on point
- Body language signals inferred from written communication style (e.g., hesitation patterns, enthusiasm, assertiveness)

Transcript:
${transcript}${jobContext}

Respond with a JSON object (no markdown, just raw JSON) in this exact format:
{
  "overallScore": <integer 1-100>,
  "strengths": [<string>, <string>, <string>],
  "areasForImprovement": [<string>, <string>, <string>],
  "summary": "<2-3 sentence overall summary including observations on tone, confidence, and communication style>",
  "readinessScore": <integer 1-100 rating how qualified the candidate appears for this specific role based on what they demonstrated>,
  "readinessImprovements": [<string — specific actionable step to increase job readiness>, <string>, <string>],
  "toneScore": <integer 1-100 rating professionalism and warmth of tone>,
  "confidenceScore": <integer 1-100 rating assertiveness and confidence inferred from answers>,
  "communicationScore": <integer 1-100 rating clarity and conciseness>
}`;

  const feedbackResponse = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 1024,
    messages: [{ role: "user", content: feedbackPrompt }],
  });

  const rawContent = feedbackResponse.choices[0]?.message?.content ?? "{}";

  let feedback;
  try {
    feedback = JSON.parse(rawContent);
  } catch {
    feedback = {
      overallScore: 70,
      strengths: ["Completed the interview session"],
      areasForImprovement: ["Continue practicing"],
      summary: "Keep practicing to improve your interview performance.",
      readinessScore: 50,
      readinessImprovements: ["Continue developing your skills for this role"],
    };
  }

  res.json({
    sessionId: session.id,
    overallScore: feedback.overallScore ?? 70,
    strengths: feedback.strengths ?? [],
    areasForImprovement: feedback.areasForImprovement ?? [],
    summary: feedback.summary ?? "",
    readinessScore: feedback.readinessScore ?? 50,
    readinessImprovements: feedback.readinessImprovements ?? [],
  });
});

export default router;
