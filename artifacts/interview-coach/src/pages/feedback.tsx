/**
 * feedback.tsx — Post-session feedback screen
 *
 * Displayed after an interview session ends. Fetches AI-generated feedback
 * from the API and renders:
 *   - Overall score (1–100 ring)
 *   - Written summary
 *   - Strengths (green card)
 *   - Areas for improvement (amber card)
 *   - Job readiness score with colour coding and actionable next steps
 *
 * Route: /feedback/:sessionId
 * The sessionId comes from the URL and is used to call both:
 *   GET /api/interview/sessions/:id       — for the role name in the header
 *   GET /api/interview/sessions/:id/feedback — for the AI feedback data
 */

import { useRoute, Link } from "wouter";
import { useGetInterviewFeedback, getGetInterviewFeedbackQueryKey, useGetInterviewSession, getGetInterviewSessionQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, CheckCircle2, ChevronRight, Target, Trophy, AlertTriangle, Zap } from "lucide-react";

/**
 * The shape of the feedback object returned by the API.
 * `overallScore` and `summary` come from the base schema; readiness fields
 * are additional fields added to the prompt but not yet in the generated types,
 * so we cast to this extended type where needed.
 */
type FeedbackWithReadiness = {
  overallScore: number;
  strengths: string[];
  areasForImprovement: string[];
  summary: string;
  readinessScore?: number;          // 1–100 job readiness rating
  readinessImprovements?: string[]; // actionable steps to improve readiness
};

export default function Feedback() {
  // Extract the sessionId from the URL path (/feedback/42 → sessionId = 42).
  const [, params] = useRoute("/feedback/:sessionId");
  const sessionId = params?.sessionId ? parseInt(params.sessionId, 10) : 0;

  // Fetch the session record so we can show the role name in the page header.
  const { data: session } = useGetInterviewSession(sessionId, {
    query: { enabled: !!sessionId, queryKey: getGetInterviewSessionQueryKey(sessionId) }
  });

  // Fetch the AI feedback. This may take a few seconds on first load since the
  // API calls OpenAI to analyse the transcript. Subsequent loads are instant
  // because the API returns the same result without re-calling OpenAI.
  const { data: feedback, isLoading, error } = useGetInterviewFeedback(sessionId, {
    query: { enabled: !!sessionId, queryKey: getGetInterviewFeedbackQueryKey(sessionId) }
  });

  return (
    <Layout>
      <div className="flex-1 overflow-y-auto bg-background">
        <div className="max-w-4xl mx-auto p-6 md:p-12">

          {/* Back link — returns to the interview chat for this session */}
          <div className="mb-8 flex items-center justify-between">
            <Button variant="ghost" asChild className="-ml-4 text-muted-foreground hover:text-foreground">
              <Link href={`/interview/${sessionId}`} data-testid="link-back-chat">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Session
              </Link>
            </Button>
          </div>

          {/* Page header — shows the role/position name once the session loads */}
          <header className="mb-10">
            <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-3">
              Interview Feedback
            </h1>
            {session && (
              <p className="text-lg text-muted-foreground flex items-center gap-2">
                For role: <span className="font-medium text-foreground">{session.jobRoleName}</span>
              </p>
            )}
          </header>

          {/* Loading state — skeleton cards while the API generates feedback */}
          {isLoading && (
            <div className="space-y-8">
              <Card className="border-border">
                <CardHeader>
                  <Skeleton className="h-6 w-48 mb-2" />
                </CardHeader>
                <div className="p-6 space-y-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-4/6" />
                </div>
              </Card>
              <div className="grid md:grid-cols-2 gap-6">
                <Skeleton className="h-64 rounded-xl" />
                <Skeleton className="h-64 rounded-xl" />
              </div>
            </div>
          )}

          {/* Error state — shown if the session has no messages yet */}
          {error && !isLoading && (
            <Card className="bg-destructive/5 border-destructive/20 shadow-none">
              <div className="p-8 text-center">
                <AlertTriangle className="w-10 h-10 text-destructive mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Feedback not ready</h3>
                <p className="text-muted-foreground mb-6">
                  You need to have a conversation first before feedback can be generated.
                  Go back to the session and answer some questions.
                </p>
                <Button asChild>
                  <Link href={`/interview/${sessionId}`}>Return to Interview</Link>
                </Button>
              </div>
            </Card>
          )}

          {/* Main feedback — only rendered once `feedback` is available */}
          {feedback && (() => {
            // Cast to the extended type to access readiness fields.
            const f = feedback as unknown as FeedbackWithReadiness;
            const readiness = f.readinessScore ?? 0;

            // Colour coding: green ≥75, amber ≥50, rose <50.
            const readinessColor =
              readiness >= 75 ? "text-emerald-600" :
              readiness >= 50 ? "text-amber-600" :
              "text-rose-600";
            const readinessBorder =
              readiness >= 75 ? "border-emerald-500/30 bg-emerald-500/5" :
              readiness >= 50 ? "border-amber-500/30 bg-amber-500/5" :
              "border-rose-500/30 bg-rose-500/5";

            return (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

                {/* Overall score ring + written summary */}
                <Card className="border-primary/20 bg-primary/5 shadow-sm">
                  <div className="p-8 md:p-10 flex flex-col md:flex-row items-center md:items-start gap-8">
                    {/* Circular score indicator */}
                    <div className="flex flex-col items-center justify-center text-center shrink-0">
                      <div className="relative w-32 h-32 rounded-full border-8 border-primary/20 flex items-center justify-center bg-card">
                        <div className="absolute inset-0 rounded-full border-8 border-primary rounded-r-transparent rounded-b-transparent transform rotate-45"></div>
                        <span className="text-4xl font-bold text-primary">{feedback.overallScore}</span>
                      </div>
                      <span className="mt-3 font-medium text-sm tracking-widest uppercase text-muted-foreground">Overall Score</span>
                    </div>

                    {/* AI-generated written summary of the session */}
                    <div className="flex-1 space-y-4 text-center md:text-left">
                      <h3 className="text-2xl font-serif font-semibold">Summary</h3>
                      <p className="text-lg leading-relaxed text-foreground/80">
                        {feedback.summary}
                      </p>
                    </div>
                  </div>
                </Card>

                {/* Strengths + Areas to improve — side by side on desktop */}
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Strengths card */}
                  <Card className="border-border shadow-sm h-full">
                    <CardHeader className="bg-emerald-500/10 rounded-t-xl border-b border-emerald-500/10">
                      <CardTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                        <Trophy className="w-5 h-5" />
                        What you did well
                      </CardTitle>
                    </CardHeader>
                    <div className="p-6">
                      <ul className="space-y-4">
                        {feedback.strengths.map((strength, i) => (
                          <li key={i} className="flex gap-3 text-foreground/80 leading-relaxed">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                            <span data-testid={`text-strength-${i}`}>{strength}</span>
                          </li>
                        ))}
                        {feedback.strengths.length === 0 && (
                          <li className="text-muted-foreground italic">Not enough data to determine strengths yet.</li>
                        )}
                      </ul>
                    </div>
                  </Card>

                  {/* Areas for improvement card */}
                  <Card className="border-border shadow-sm h-full">
                    <CardHeader className="bg-amber-500/10 rounded-t-xl border-b border-amber-500/10">
                      <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-500">
                        <Target className="w-5 h-5" />
                        Areas to improve
                      </CardTitle>
                    </CardHeader>
                    <div className="p-6">
                      <ul className="space-y-4">
                        {feedback.areasForImprovement.map((area, i) => (
                          <li key={i} className="flex gap-3 text-foreground/80 leading-relaxed">
                            <ChevronRight className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                            <span data-testid={`text-improvement-${i}`}>{area}</span>
                          </li>
                        ))}
                        {feedback.areasForImprovement.length === 0 && (
                          <li className="text-muted-foreground italic">Not enough data to determine areas for improvement yet.</li>
                        )}
                      </ul>
                    </div>
                  </Card>
                </div>

                {/* Job readiness score — only shown when the API includes it */}
                {f.readinessScore !== undefined && (
                  <Card className={`border shadow-sm ${readinessBorder}`}>
                    <CardHeader className="border-b border-inherit rounded-t-xl">
                      <CardTitle className={`flex items-center gap-2 ${readinessColor}`}>
                        <Zap className="w-5 h-5" />
                        Job Readiness Score
                      </CardTitle>
                    </CardHeader>
                    <div className="p-6 flex flex-col md:flex-row items-center gap-6">
                      {/* Numeric score circle */}
                      <div className="flex flex-col items-center shrink-0">
                        <div className={`relative w-24 h-24 rounded-full border-8 border-current/20 flex items-center justify-center bg-card ${readinessColor}`}>
                          <span className="text-3xl font-bold">{readiness}</span>
                        </div>
                        <span className="mt-2 text-xs font-medium tracking-widest uppercase text-muted-foreground">/ 100</span>
                      </div>

                      {/* Readiness narrative + actionable improvement steps */}
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground mb-4">
                          {readiness >= 75
                            ? "You appear well-qualified for this role. Focus on closing the remaining gaps."
                            : readiness >= 50
                            ? "You have a solid foundation but have room to grow before applying."
                            : "There are key skill gaps to address before you'll be competitive for this role."}
                        </p>
                        {(f.readinessImprovements ?? []).length > 0 && (
                          <ul className="space-y-2">
                            {(f.readinessImprovements ?? []).map((step, i) => (
                              <li key={i} className="flex gap-2 text-sm text-foreground/80">
                                <ChevronRight className={`w-4 h-4 shrink-0 mt-0.5 ${readinessColor}`} />
                                {step}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </Card>
                )}

                {/* CTA to start another session */}
                <div className="flex justify-center pt-8">
                  <Button variant="outline" size="lg" asChild className="px-8">
                    <Link href="/" data-testid="link-practice-again">Start Another Session</Link>
                  </Button>
                </div>

              </div>
            );
          })()}

        </div>
      </div>
    </Layout>
  );
}
