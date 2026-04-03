import { useRoute, Link } from "wouter";
import { useGetInterviewFeedback, getGetInterviewFeedbackQueryKey, useGetInterviewSession, getGetInterviewSessionQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, CheckCircle2, ChevronRight, Target, Trophy, AlertTriangle, Zap } from "lucide-react";

type FeedbackWithReadiness = {
  overallScore: number;
  strengths: string[];
  areasForImprovement: string[];
  summary: string;
  readinessScore?: number;
  readinessImprovements?: string[];
};

export default function Feedback() {
  const [, params] = useRoute("/feedback/:sessionId");
  const sessionId = params?.sessionId ? parseInt(params.sessionId, 10) : 0;

  const { data: session } = useGetInterviewSession(sessionId, {
    query: { enabled: !!sessionId, queryKey: getGetInterviewSessionQueryKey(sessionId) }
  });

  const { data: feedback, isLoading, error } = useGetInterviewFeedback(sessionId, {
    query: { enabled: !!sessionId, queryKey: getGetInterviewFeedbackQueryKey(sessionId) }
  });

  return (
    <Layout>
      <div className="flex-1 overflow-y-auto bg-background">
        <div className="max-w-4xl mx-auto p-6 md:p-12">
          
          <div className="mb-8 flex items-center justify-between">
            <Button variant="ghost" asChild className="-ml-4 text-muted-foreground hover:text-foreground">
              <Link href={`/interview/${sessionId}`} data-testid="link-back-chat">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Session
              </Link>
            </Button>
          </div>

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

          {isLoading && (
            <div className="space-y-8">
              <Card className="border-border">
                <CardHeader>
                  <Skeleton className="h-6 w-48 mb-2" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-4/6" />
                </CardContent>
              </Card>
              <div className="grid md:grid-cols-2 gap-6">
                <Skeleton className="h-64 rounded-xl" />
                <Skeleton className="h-64 rounded-xl" />
              </div>
            </div>
          )}

          {error && !isLoading && (
            <Card className="bg-destructive/5 border-destructive/20 shadow-none">
              <CardContent className="p-8 text-center">
                <AlertTriangle className="w-10 h-10 text-destructive mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Feedback not ready</h3>
                <p className="text-muted-foreground mb-6">
                  You need to have a conversation first before feedback can be generated. 
                  Go back to the session and answer some questions.
                </p>
                <Button asChild>
                  <Link href={`/interview/${sessionId}`}>Return to Interview</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {feedback && (() => {
            const f = feedback as unknown as FeedbackWithReadiness;
            const readiness = f.readinessScore ?? 0;
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
              
              {/* Score & Summary */}
              <Card className="border-primary/20 bg-primary/5 shadow-sm">
                <CardContent className="p-8 md:p-10 flex flex-col md:flex-row items-center md:items-start gap-8">
                  <div className="flex flex-col items-center justify-center text-center shrink-0">
                    <div className="relative w-32 h-32 rounded-full border-8 border-primary/20 flex items-center justify-center bg-card">
                      <div className="absolute inset-0 rounded-full border-8 border-primary rounded-r-transparent rounded-b-transparent transform rotate-45"></div>
                      <span className="text-4xl font-bold text-primary">{feedback.overallScore}</span>
                    </div>
                    <span className="mt-3 font-medium text-sm tracking-widest uppercase text-muted-foreground">Overall Score</span>
                  </div>
                  
                  <div className="flex-1 space-y-4 text-center md:text-left">
                    <h3 className="text-2xl font-serif font-semibold">Summary</h3>
                    <p className="text-lg leading-relaxed text-foreground/80">
                      {feedback.summary}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Strengths */}
                <Card className="border-border shadow-sm h-full">
                  <CardHeader className="bg-emerald-500/10 rounded-t-xl border-b border-emerald-500/10">
                    <CardTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                      <Trophy className="w-5 h-5" />
                      What you did well
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
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
                  </CardContent>
                </Card>

                {/* Areas for Improvement */}
                <Card className="border-border shadow-sm h-full">
                  <CardHeader className="bg-amber-500/10 rounded-t-xl border-b border-amber-500/10">
                    <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-500">
                      <Target className="w-5 h-5" />
                      Areas to improve
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
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
                  </CardContent>
                </Card>
              </div>
              
              {/* Job Readiness Score */}
              {f.readinessScore !== undefined && (
                <Card className={`border shadow-sm ${readinessBorder}`}>
                  <CardHeader className="border-b border-inherit rounded-t-xl">
                    <CardTitle className={`flex items-center gap-2 ${readinessColor}`}>
                      <Zap className="w-5 h-5" />
                      Job Readiness Score
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 flex flex-col md:flex-row items-center gap-6">
                    <div className="flex flex-col items-center shrink-0">
                      <div className={`relative w-24 h-24 rounded-full border-8 border-current/20 flex items-center justify-center bg-card ${readinessColor}`}>
                        <span className="text-3xl font-bold">{readiness}</span>
                      </div>
                      <span className="mt-2 text-xs font-medium tracking-widest uppercase text-muted-foreground">/ 100</span>
                    </div>
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
                  </CardContent>
                </Card>
              )}

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