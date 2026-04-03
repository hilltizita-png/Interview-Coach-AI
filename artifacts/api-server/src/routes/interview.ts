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

router.get("/interview/roles", (_req, res): void => {
  res.json(JOB_ROLES);
});

router.get("/interview/sessions", async (_req, res): Promise<void> => {
  const sessions = await db
    .select()
    .from(interviewSessions)
    .orderBy(asc(interviewSessions.createdAt));
  res.json(sessions);
});

router.post("/interview/sessions", async (req, res): Promise<void> => {
  const parsed = CreateInterviewSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const title = `${parsed.data.jobRoleName} Interview`;
  const [convo] = await db.insert(conversations).values({ title }).returning();

  const jobContext = parsed.data.jobContext ?? null;

  const greeting = jobContext
    ? `Let's begin your practice interview for the ${parsed.data.jobRoleName} role.\n\nBased on the job posting, here's what I'll be focusing on:\n${jobContext}\n\nAre you ready to get started?`
    : `Let's begin your practice interview for the ${parsed.data.jobRoleName} role.\n\nI'll ask you a mix of behavioral and role-specific questions, one at a time. Take your time with each answer.\n\nAre you ready to get started?`;

  await db.insert(messages).values({
    conversationId: convo.id,
    role: "assistant",
    content: greeting,
  });

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

  const visibleMessages = msgs.filter((m) => m.role !== "system");

  res.json({ ...session, messages: visibleMessages });
});

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

  // Persist the last user message (final entry in the client messages array)
  const lastUserMsg = [...clientMessages].reverse().find((m) => m.role === "user");
  if (lastUserMsg) {
    await db.insert(messages).values({
      conversationId: session.conversationId,
      role: "user",
      content: lastUserMsg.content,
    });
  }

  const timeNote = timeLeft !== undefined
    ? `\nThe interview has limited time remaining: ${timeLeft} seconds.\nIf time is short, ask more direct and concise questions.`
    : "";

  const systemPrompt = context
    ? `You are an AI interview coach. You are interviewing for a role with the following description:

${context}

Ask one question at a time, relevant to the responsibilities and skills above.
After the user's answer, give short constructive feedback, then proceed.${timeNote}`
    : `You are an AI interview coach conducting a practice interview for a ${session.jobRoleName} position.
Ask one question at a time, relevant to the role.
After the user's answer, give short constructive feedback, then proceed.${timeNote}`;

  const chatMessages = [
    { role: "system" as const, content: systemPrompt },
    ...clientMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullResponse = "";

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

  await db.insert(messages).values({
    conversationId: session.conversationId,
    role: "assistant",
    content: fullResponse,
  });

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

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

  const visibleMessages = msgs.filter((m) => m.role !== "system");

  const transcript = visibleMessages
    .map((m) => `${m.role === "user" ? "Candidate" : "Interviewer"}: ${m.content}`)
    .join("\n\n");

  const jobContext = session.jobContext
    ? `\n\nJob Description:\n${session.jobContext}`
    : "";

  const feedbackPrompt = `You are an expert interview coach. Review this mock interview transcript for the position of ${session.jobRoleName} and provide structured feedback.

Transcript:
${transcript}${jobContext}

Respond with a JSON object (no markdown, just raw JSON) in this exact format:
{
  "overallScore": <integer 1-100>,
  "strengths": [<string>, <string>, <string>],
  "areasForImprovement": [<string>, <string>, <string>],
  "summary": "<2-3 sentence overall summary>",
  "readinessScore": <integer 1-100 rating how qualified the candidate appears for this specific role based on what they demonstrated>,
  "readinessImprovements": [<string — specific actionable step to increase job readiness>, <string>, <string>]
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
