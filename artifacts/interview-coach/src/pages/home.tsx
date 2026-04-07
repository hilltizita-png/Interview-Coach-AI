import { useState } from "react";
import { useLocation } from "wouter";
import {
  useListInterviewSessions,
  useCreateInterviewSession,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useProfile } from "@/contexts/profile-context";
import {
  Zap,
  BookOpen,
  FlaskConical,
  Trophy,
  Star,
  Target,
  Shield,
  Award,
  TrendingUp,
  ChevronRight,
  Flame,
  Clock,
  BarChart2,
  ChevronDown,
  Briefcase,
  PenLine,
  Lock,
} from "lucide-react";

const CHALLENGES = [
  {
    id: "quick-round",
    title: "Quick Round",
    description: "5 rapid-fire questions. Test your instincts under pressure.",
    icon: Zap,
    color: "from-yellow-500 to-orange-500",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/30",
    textColor: "text-yellow-400",
    btnClass: "bg-yellow-500 hover:bg-yellow-400 text-black",
    badge: "10 min",
    badgeBg: "bg-yellow-500/20 text-yellow-300",
  },
  {
    id: "full-session",
    title: "Full Session",
    description: "Full-length interview with an AI hiring-manager.",
    icon: BookOpen,
    color: "from-blue-500 to-cyan-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    textColor: "text-blue-400",
    btnClass: "bg-blue-500 hover:bg-blue-400 text-white",
    badge: "40 min",
    badgeBg: "bg-blue-500/20 text-blue-300",
  },
  {
    id: "answer-lab",
    title: "Answer Lab",
    description: "Refine, rinse, repeat.",
    icon: FlaskConical,
    color: "from-purple-500 to-pink-500",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/30",
    textColor: "text-purple-400",
    btnClass: "bg-purple-500 hover:bg-purple-400 text-white",
    badge: "Open-ended",
    badgeBg: "bg-purple-500/20 text-purple-300",
  },
  {
    id: "boss-round",
    title: "Boss Round",
    description: "Curveball questions only. For when you feel bulletproof.",
    icon: Trophy,
    color: "from-red-500 to-rose-600",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
    textColor: "text-red-400",
    btnClass: "bg-red-500 hover:bg-red-400 text-white",
    badge: "Hard",
    badgeBg: "bg-red-500/20 text-red-300",
  },
];

const CHALLENGE_DETAILS: Record<string, { description: string; color: string; textColor: string }> = {
  "quick-round": {
    description: "Get 5 high-signal questions in 10 minutes. Each answer is scored on clarity, structure, and relevance. Great for daily warm-ups.",
    color: "from-yellow-900/40 to-orange-900/40",
    textColor: "text-yellow-300",
  },
  "full-session": {
    description: "A complete mock interview with questions spanning behavioral, situational, and technical prompts over 40 minutes. Detailed feedback after the session.",
    color: "from-blue-900/40 to-cyan-900/40",
    textColor: "text-blue-300",
  },
  "answer-lab": {
    description: "Pick a skill area and perfect your responses. Coaching notes and targeted feedback after every session.",
    color: "from-purple-900/40 to-pink-900/40",
    textColor: "text-purple-300",
  },
  "boss-round": {
    description: "Only the toughest curveball questions. Designed to expose weak spots and build real confidence. Not for the faint of heart.",
    color: "from-red-900/40 to-rose-900/40",
    textColor: "text-red-300",
  },
};

const SKILL_IDS = ["technical-skills", "behavioural-scenarios", "confidence-delivery"];

const SKILLS = [
  { id: "technical-skills", label: "Technical Skills" },
  { id: "behavioural-scenarios", label: "Behavioural Scenarios" },
  { id: "confidence-delivery", label: "Confidence & Delivery" },
];

function computeStreak(sessions: { createdAt: string }[]): number {
  const days = new Set(sessions.map((s) => s.createdAt.slice(0, 10)));
  const sorted = [...days].sort().reverse();
  if (!sorted.length) return 0;
  const today = new Date().toISOString().slice(0, 10);
  let streak = 0;
  let cursor = today;
  for (const day of sorted) {
    if (day === cursor) {
      streak++;
      const d = new Date(cursor);
      d.setDate(d.getDate() - 1);
      cursor = d.toISOString().slice(0, 10);
    } else break;
  }
  return streak;
}

export default function Home() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { resume, jobPostings } = useProfile();

  const [selected, setSelected] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<string>("technical-skills");
  const [jobTarget, setJobTarget] = useState<string>("");
  const [customRoleText, setCustomRoleText] = useState<string>("");

  const { data: sessions, isLoading: sessionsLoading } = useListInterviewSessions();
  const createSession = useCreateInterviewSession();

  const sessionCount = sessions?.length ?? 0;
  const estimatedHours = ((sessionCount * 18) / 60).toFixed(1);
  const uniqueRoles = new Set(sessions?.map((s) => s.jobRole)).size;

  const streak = sessions ? computeStreak(sessions) : 0;
  const answerLabCount = sessions?.filter((s) => SKILL_IDS.includes(s.jobRole)).length ?? 0;

  // Readiness score accounting for all factors
  const readinessScore = Math.min(
    Math.round(
      Math.min(sessionCount * 4, 55) +   // session volume (max 55)
      Math.min(streak * 4, 16) +          // consistency streak (max 16)
      Math.min(answerLabCount * 3, 12) +  // Answer Lab skill practice (max 12)
      Math.min(uniqueRoles * 2, 8) +      // role diversity (max 8)
      5                                   // base score
    ),
    97
  );

  const ACHIEVEMENTS = [
    {
      icon: Flame,
      label: "7-Day Streak",
      desc: "Practice 7 days in a row",
      current: streak,
      goal: 7,
    },
    {
      icon: Star,
      label: "First Session",
      desc: "Complete your first interview",
      current: sessionCount,
      goal: 1,
    },
    {
      icon: Shield,
      label: "Boss Slayer",
      desc: "Complete 20 total sessions",
      current: sessionCount,
      goal: 20,
    },
    {
      icon: Award,
      label: "Answer Craftsman",
      desc: "Complete 3 Answer Lab sessions",
      current: answerLabCount,
      goal: 3,
    },
    {
      icon: TrendingUp,
      label: "Rising Star",
      desc: "Complete 5 sessions",
      current: sessionCount,
      goal: 5,
    },
    {
      icon: Target,
      label: "Bullseye",
      desc: "Complete 15 sessions",
      current: sessionCount,
      goal: 15,
    },
  ];

  const circumference = 2 * Math.PI * 40;
  const dashOffset = circumference - (readinessScore / 100) * circumference;

  const buildJobContext = (): string | undefined => {
    let context = "";
    if (jobTarget.startsWith("posting:")) {
      const id = jobTarget.replace("posting:", "");
      const posting = jobPostings.find((p) => p.id === id);
      if (posting) context += `Job Posting (${posting.label}):\n${posting.content}`;
    } else if (jobTarget === "custom" && customRoleText.trim()) {
      context += `Target Role: ${customRoleText.trim()}`;
    }
    if (resume.trim()) {
      context += (context ? "\n\n" : "") + `Candidate Resume:\n${resume.trim()}`;
    }
    return context || undefined;
  };

  const derivePositionName = (): string => {
    if (jobTarget.startsWith("posting:")) {
      const id = jobTarget.replace("posting:", "");
      const posting = jobPostings.find((p) => p.id === id);
      if (posting?.label) return posting.label;
    } else if (jobTarget === "custom" && customRoleText.trim()) {
      return customRoleText.trim();
    }
    return "";
  };

  const handleBegin = async () => {
    const isAnswerLab = selected === "answer-lab";
    const isBossRound = selected === "boss-round";
    const skillLabel = SKILLS.find((s) => s.id === selectedSkill)?.label ?? "Technical Skills";
    const jobContext = buildJobContext();

    let modeInstructions = "";
    if (selected === "quick-round") {
      modeInstructions = "QUICK ROUND MODE: Ask exactly 5 rapid-fire, high-signal questions. Be direct and concise. Cover the most important aspects of the role in minimal time.";
    } else if (selected === "full-session") {
      modeInstructions = "FULL SESSION MODE: Conduct a comprehensive interview. Cover behavioral, situational, and technical questions. Gradually increase difficulty. Vary question types to give a complete picture of the candidate.";
    } else if (isBossRound) {
      let weaknessContext = "";
      try {
        const sessionsRes = await fetch("/api/interview/sessions");
        const allSessions: { id: number }[] = await sessionsRes.json();
        const recentIds = allSessions.slice(-3).map((s) => s.id);
        const feedbacks = await Promise.allSettled(
          recentIds.map((id) => fetch(`/api/interview/sessions/${id}/feedback`).then((r) => r.json()))
        );
        const weaknesses: string[] = [];
        for (const result of feedbacks) {
          if (result.status === "fulfilled" && result.value?.areasForImprovement) {
            weaknesses.push(...(result.value.areasForImprovement as string[]));
          }
        }
        if (weaknesses.length > 0) {
          const unique = [...new Set(weaknesses)].slice(0, 6);
          weaknessContext = `\n\nPast weaknesses identified from previous sessions:\n${unique.map((w) => `- ${w}`).join("\n")}\n\nTarget these specific areas with your most difficult questions.`;
        }
      } catch {
        // If fetch fails, proceed without weakness context
      }
      modeInstructions = `BOSS ROUND MODE: Ask only the most difficult, pressure-testing interview questions. Use curveball questions, complex hypotheticals, failure scenarios, and deep follow-ups. Do not go easy on the candidate. Expose any weaknesses and push for depth in every answer.${weaknessContext}`;
    }

    const sessionData = isAnswerLab
      ? {
          jobRole: selectedSkill,
          jobRoleName: skillLabel,
          jobContext: [
            `ANSWER LAB MODE: Focus exclusively on ${skillLabel} questions. Ask one targeted question at a time and move on after each answer without providing feedback or coaching. Wait for the candidate to request feedback explicitly.`,
            jobContext,
          ]
            .filter(Boolean)
            .join("\n\n"),
        }
      : {
          jobRole: "general",
          jobRoleName: derivePositionName() || "General Interview",
          jobContext: [modeInstructions, jobContext].filter(Boolean).join("\n\n") || undefined,
        };

    createSession.mutate(
      { data: sessionData },
      {
        onSuccess: (session) => setLocation(`/interview/${session.id}?mode=${selected ?? "general"}`),
        onError: () =>
          toast({
            title: "Could not start session",
            description: "Please try again later.",
            variant: "destructive",
          }),
      }
    );
  };

  const selectedChallenge = CHALLENGES.find((c) => c.id === selected);
  const selectedDetail = selected ? CHALLENGE_DETAILS[selected] : null;

  return (
    <Layout>
      <div className="flex-1 overflow-y-auto bg-[#0d0f14] text-white">
        <div className="max-w-5xl mx-auto p-6 md:p-10 space-y-10">

          {/* Header */}
          <header>
            <p className="text-sm font-medium tracking-widest uppercase text-zinc-500 mb-1">
              Interview Coach
            </p>
            <h1 className="text-3xl md:text-4xl font-bold">
              {selectedChallenge ? selectedChallenge.title : "Your Interview Hub"}
            </h1>
          </header>

          {/* Score Ring + Stats Row */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="sm:col-span-1 flex flex-col items-center justify-center bg-zinc-900/60 border border-zinc-700/40 rounded-2xl p-6 gap-3">
              {sessionsLoading ? (
                <Skeleton className="w-24 h-24 rounded-full bg-zinc-800" />
              ) : (
                <svg width="100" height="100" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#27272a" strokeWidth="10" />
                  <circle
                    cx="50" cy="50" r="40" fill="none" stroke="url(#scoreGrad)"
                    strokeWidth="10" strokeLinecap="round"
                    strokeDasharray={circumference} strokeDashoffset={dashOffset}
                    transform="rotate(-90 50 50)"
                  />
                  <defs>
                    <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#22d3ee" />
                    </linearGradient>
                  </defs>
                  <text x="50" y="54" textAnchor="middle" fontSize="20" fontWeight="bold" fill="white">
                    {readinessScore}
                  </text>
                </svg>
              )}
              <p className="text-xs text-zinc-400 text-center">Readiness Score</p>
            </div>

            {[
              { icon: BarChart2, label: "Sessions Done", value: sessionsLoading ? null : String(sessionCount), color: "text-indigo-400" },
              { icon: Target, label: "Roles Practiced", value: sessionsLoading ? null : String(uniqueRoles), color: "text-cyan-400" },
              { icon: Clock, label: "Time Practiced", value: sessionsLoading ? null : `${estimatedHours} hrs`, color: "text-emerald-400" },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col justify-between bg-zinc-900/60 border border-zinc-700/40 rounded-2xl p-5">
                <stat.icon className={`w-5 h-5 ${stat.color} mb-3`} />
                <div>
                  {stat.value === null ? (
                    <Skeleton className="h-7 w-12 bg-zinc-800 mb-1" />
                  ) : (
                    <p className="text-2xl font-bold">{stat.value}</p>
                  )}
                  <p className="text-xs text-zinc-500 mt-0.5">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Active Mission Banner */}
          {(() => {
            const MISSIONS = [
              { label: "Complete your first session", goal: 1, current: sessionCount },
              { label: "Complete 5 sessions to unlock Boss Round", goal: 5, current: sessionCount },
              { label: "Build a 3-day practice streak", goal: 3, current: streak },
              { label: "Complete 3 Answer Lab sessions", goal: 3, current: answerLabCount },
              { label: "Reach 15 total sessions", goal: 15, current: sessionCount },
              { label: "Hit a 7-day streak", goal: 7, current: streak },
              { label: "Reach 25 total sessions", goal: 25, current: sessionCount },
              { label: "Complete 10 Answer Lab sessions", goal: 10, current: answerLabCount },
              { label: "Reach 50 total sessions", goal: 50, current: sessionCount },
            ];
            const mission = MISSIONS.find((m) => m.current < m.goal) ?? null;
            const allDone = !mission;
            const current = mission?.current ?? 0;
            const goal = mission?.goal ?? 1;
            const pct = Math.min((current / goal) * 100, 100);

            return (
              <div className="relative overflow-hidden rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/80 to-purple-950/60 px-6 py-5 flex items-center gap-5">
                <div className="shrink-0 bg-indigo-500/20 rounded-xl p-3">
                  <Target className="w-6 h-6 text-indigo-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-0.5">
                    {allDone ? "All Missions Complete" : "Active Mission"}
                  </p>
                  <p className="text-base font-semibold text-white truncate">
                    {allDone ? "You've conquered every challenge. Legend." : mission!.label}
                  </p>
                  {!allDone && (
                    <div className="mt-2 flex items-center gap-3">
                      <div className="flex-1 bg-zinc-800 rounded-full h-1.5">
                        <div
                          className="bg-indigo-400 h-1.5 rounded-full transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-indigo-300 shrink-0">{current} / {goal}</span>
                    </div>
                  )}
                </div>
                <ChevronRight className="w-5 h-5 text-zinc-500 shrink-0" />
              </div>
            );
          })()}

          {/* Challenge Cards */}
          <section>
            <h2 className="text-lg font-semibold text-zinc-300 mb-4">Choose Your Challenge</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {CHALLENGES.map((challenge) => {
                const Icon = challenge.icon;
                const isActive = selected === challenge.id;
                const isLocked = challenge.id === "boss-round" && sessionCount < 5;

                if (isLocked) {
                  return (
                    <div
                      key={challenge.id}
                      className="relative rounded-2xl border border-zinc-800/40 bg-zinc-900/30 p-5 flex flex-col gap-4 opacity-60 cursor-not-allowed"
                    >
                      <div className="flex items-start justify-between">
                        <div className="rounded-xl p-2.5 bg-zinc-700/40">
                          <Lock className="w-5 h-5 text-zinc-500" />
                        </div>
                        <span className="text-xs font-medium rounded-full px-2.5 py-1 bg-zinc-800 text-zinc-500">
                          Locked
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-base mb-1 text-zinc-500">{challenge.title}</p>
                        <p className="text-sm text-zinc-600">
                          Complete {5 - sessionCount} more session{5 - sessionCount !== 1 ? "s" : ""} to unlock.
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        <div className="w-full bg-zinc-800 rounded-full h-1">
                          <div
                            className="bg-zinc-600 h-1 rounded-full transition-all duration-700"
                            style={{ width: `${Math.min((sessionCount / 5) * 100, 100)}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-zinc-600">{sessionCount} / 5 sessions</p>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={challenge.id}
                    onClick={() => setSelected(challenge.id)}
                    className={`relative rounded-2xl border p-5 flex flex-col gap-4 cursor-pointer transition-all duration-200 ${challenge.bgColor} ${challenge.borderColor} ${isActive ? "ring-2 ring-offset-2 ring-offset-[#0d0f14] ring-white/20" : "hover:brightness-110"}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className={`rounded-xl p-2.5 bg-gradient-to-br ${challenge.color} opacity-90`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <span className={`text-xs font-medium rounded-full px-2.5 py-1 ${challenge.badgeBg}`}>
                        {challenge.badge}
                      </span>
                    </div>
                    <div>
                      <p className={`font-semibold text-base mb-1 ${challenge.textColor}`}>{challenge.title}</p>
                      <p className="text-sm text-zinc-400">{challenge.description}</p>
                    </div>
                    <Button
                      className={`w-full font-semibold text-sm ${challenge.btnClass}`}
                      onClick={(e) => { e.stopPropagation(); setSelected(challenge.id); }}
                    >
                      Start {challenge.title}
                    </Button>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Detail + Session Setup Panel */}
          {selected && selectedChallenge && selectedDetail && (
            <section>
              <div className={`rounded-2xl border border-zinc-700/40 bg-gradient-to-br ${selectedDetail.color} p-6 space-y-6`}>

                <div>
                  <p className={`text-xs font-semibold uppercase tracking-widest ${selectedDetail.textColor}`}>
                    About this challenge
                  </p>
                  <h3 className="text-xl font-bold text-white mt-1">{selectedChallenge.title}</h3>
                  <p className="text-sm text-zinc-300 leading-relaxed mt-2">{selectedDetail.description}</p>
                </div>

                {/* Answer Lab: Pick a Skill */}
                {selected === "answer-lab" && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Pick a Skill</p>
                    <div className="relative">
                      <select
                        value={selectedSkill}
                        onChange={(e) => setSelectedSkill(e.target.value)}
                        className="w-full appearance-none bg-zinc-900/80 border border-zinc-700/60 text-white text-sm rounded-xl px-4 py-3 pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer"
                      >
                        {SKILLS.map((skill) => (
                          <option key={skill.id} value={skill.id} className="bg-zinc-900">{skill.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                    </div>
                  </div>
                )}

                {/* Tailor to a Job Posting */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                    <Briefcase className="w-3 h-3 opacity-70" />
                    Tailor to a Job Posting
                  </p>
                  <div className="relative">
                    <select
                      value={jobTarget}
                      onChange={(e) => setJobTarget(e.target.value)}
                      className="w-full appearance-none bg-zinc-900/80 border border-zinc-700/60 text-white text-sm rounded-xl px-4 py-3 pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer"
                    >
                      <option value="" className="bg-zinc-900">No specific posting</option>
                      <option value="custom" className="bg-zinc-900">✏ Type a role or focus…</option>
                      {jobPostings.map((p) => (
                        <option key={p.id} value={`posting:${p.id}`} className="bg-zinc-900">📄 {p.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                  </div>

                  {jobTarget === "custom" && (
                    <div className="relative">
                      <PenLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input
                        value={customRoleText}
                        onChange={(e) => setCustomRoleText(e.target.value)}
                        placeholder="e.g. Senior PM at a fintech startup, Staff Engineer at FAANG…"
                        className="w-full bg-zinc-900/80 border border-zinc-700/60 text-white text-sm rounded-xl px-4 py-3 pl-9 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 placeholder:text-zinc-600"
                      />
                    </div>
                  )}

                  {resume && (
                    <p className="text-xs text-emerald-400 flex items-center gap-1.5">
                      <Shield className="w-3 h-3" />
                      Resume from your profile will also be used to tailor questions.
                    </p>
                  )}

                  {!resume && jobPostings.length === 0 && (
                    <p className="text-xs text-zinc-600">
                      Save a resume or job posting in your{" "}
                      <a href="/profile" className="text-zinc-400 underline underline-offset-2 hover:text-white transition-colors">Profile</a>{" "}
                      for tailored questions.
                    </p>
                  )}
                </div>

                <Button
                  className={`w-full font-bold text-base py-3 ${selectedChallenge.btnClass}`}
                  disabled={createSession.isPending}
                  onClick={handleBegin}
                >
                  {createSession.isPending ? "Starting…" : `Begin ${selectedChallenge.title}`}
                </Button>
              </div>
            </section>
          )}

          {/* Achievements */}
          <section>
            <h2 className="text-lg font-semibold text-zinc-300 mb-4">Achievements</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {ACHIEVEMENTS.map((achievement) => {
                const Icon = achievement.icon;
                const progress = Math.min(achievement.current, achievement.goal);
                const unlocked = progress >= achievement.goal;
                const pct = Math.round((progress / achievement.goal) * 100);

                return (
                  <div
                    key={achievement.label}
                    className={`flex flex-col gap-3 rounded-xl p-4 border transition-all ${
                      unlocked
                        ? "bg-amber-500/10 border-amber-500/30"
                        : "bg-zinc-900/50 border-zinc-800/40"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className={`rounded-lg p-2 ${unlocked ? "bg-amber-500/20" : "bg-zinc-800/60"}`}>
                        {unlocked ? (
                          <Icon className="w-5 h-5 text-amber-400" />
                        ) : (
                          <Lock className="w-5 h-5 text-zinc-600" />
                        )}
                      </div>
                      <span className={`text-xs font-semibold tabular-nums ${unlocked ? "text-amber-300" : "text-zinc-500"}`}>
                        {progress}/{achievement.goal}
                      </span>
                    </div>

                    <div>
                      <p className={`text-sm font-semibold ${unlocked ? "text-white" : "text-zinc-400"}`}>
                        {achievement.label}
                      </p>
                      <p className="text-[11px] text-zinc-500 mt-0.5 leading-tight">{achievement.desc}</p>
                    </div>

                    <div className="space-y-1">
                      <div className="w-full bg-zinc-800 rounded-full h-1">
                        <div
                          className={`h-1 rounded-full transition-all duration-700 ${unlocked ? "bg-amber-400" : "bg-zinc-600"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      {unlocked && (
                        <p className="text-[10px] text-amber-400 font-medium">✓ Unlocked</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

        </div>
      </div>
    </Layout>
  );
}
