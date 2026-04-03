import { useState } from "react";
import { useListJobRoles, useCreateInterviewSession } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import { ArrowRight, Briefcase } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import JobInput from "@/components/JobInput";

export default function Home() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [jobSummary, setJobSummary] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<{ id: string; name: string } | null>(null);
  const [pendingRoleId, setPendingRoleId] = useState<string | null>(null);
  
  const { data: roles, isLoading, error } = useListJobRoles();
  const createSession = useCreateInterviewSession();

  const startSession = (roleId: string, roleName: string, jobContext?: string, options?: { newSession?: boolean }) => {
    createSession.mutate(
      { data: { jobRole: roleId, jobRoleName: roleName, jobContext } },
      {
        onSuccess: (session) => setLocation(`/interview/${session.id}`),
        onError: () => {
          setPendingRoleId(null);
          toast({ title: "Could not start session", description: "Please try again later.", variant: "destructive" });
        },
      }
    );
  };

  const handleJobExtracted = (summary: string) => {
    setJobSummary(summary);
    setSelectedRole({ id: "custom", name: "Custom Job (from posting)" });
  };

  const handleRoleSelect = (roleId: string, roleName: string) => {
    if (pendingRoleId) return;
    setPendingRoleId(roleId);
    startSession(roleId, roleName, jobSummary?.trim() || undefined, { newSession: true });
  };

  const handleStartInterview = () => {
    if (!jobSummary) {
      alert("Please paste or generate a job first");
      return;
    }
    startSession(
      selectedRole?.id || "custom",
      selectedRole?.name || "Custom Role",
      jobSummary
    );
  };

  // Group roles by category
  const groupedRoles = roles?.reduce((acc, role) => {
    if (!acc[role.category]) acc[role.category] = [];
    acc[role.category].push(role);
    return acc;
  }, {} as Record<string, typeof roles>);

  return (
    <Layout>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6 md:p-12">

          {!jobSummary ? (
            <>
              <header className="mb-8 max-w-2xl">
                <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-4">
                  What role are you interviewing for?
                </h1>
                <p className="text-lg text-muted-foreground">
                  Paste a job posting and I'll tailor the interview questions to match. Or skip ahead and pick a role directly.
                </p>
              </header>
              <JobInput
                summary={jobSummary}
                onJobExtracted={handleJobExtracted}
                onClear={() => setJobSummary(null)}
                defaultOpen
              />
              <Button variant="link" className="text-muted-foreground px-0 -mt-4" onClick={() => setJobSummary(" ")}>
                Skip — just pick a role →
              </Button>
            </>
          ) : (
            <>
              <header className="mb-8 max-w-2xl">
                <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-4">
                  Select a Role
                </h1>
                <p className="text-lg text-muted-foreground">
                  Choose the position you want to practice for. I'll act as the hiring manager and ask you relevant questions.
                </p>
              </header>
              <JobInput
                summary={jobSummary.trim() ? jobSummary : null}
                onJobExtracted={handleJobExtracted}
                onClear={() => setJobSummary("")}
              />
              {jobSummary?.trim() && (
                <Button onClick={handleStartInterview} className="mb-6">
                  Start Interview
                </Button>
              )}
            </>
          )}

          {jobSummary !== null && isLoading && (
            <div className="space-y-8">
              <Skeleton className="h-8 w-48 mb-4" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <Skeleton key={i} className="h-48 w-full rounded-xl" />
                ))}
              </div>
            </div>
          )}

          {jobSummary !== null && error && (
            <div className="bg-destructive/10 text-destructive p-4 rounded-lg flex items-center justify-between">
              <span>Could not load job roles.</span>
              <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Retry</Button>
            </div>
          )}

          {jobSummary !== null && groupedRoles && Object.entries(groupedRoles).map(([category, categoryRoles]) => (
            <div key={category} className="mb-12">
              <h2 className="text-2xl font-serif font-semibold mb-6 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-primary" />
                {category}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {categoryRoles.map(role => (
                  <Card 
                    key={role.id} 
                    className="flex flex-col group hover:shadow-md transition-all duration-300 border-border/60 hover:border-primary/30"
                    data-testid={`card-role-${role.id}`}
                  >
                    <CardHeader>
                      <CardTitle className="text-xl">{role.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col justify-between">
                      <CardDescription className="text-base leading-relaxed mb-6">
                        {role.description}
                      </CardDescription>
                      <Button 
                        onClick={() => handleRoleSelect(role.id, role.name)}
                        className="w-full justify-between group-hover:bg-primary"
                        disabled={pendingRoleId !== null}
                        data-testid={`button-start-${role.id}`}
                      >
                        {pendingRoleId === role.id
                          ? (createSession.isPending ? "Starting..." : "Researching role...")
                          : "Start Practice"}
                        <ArrowRight className="w-4 h-4 ml-2 opacity-70 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}