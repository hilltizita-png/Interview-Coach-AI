import { Link } from "wouter";
import { useListInterviewSessions, useDeleteInterviewSession, getListInterviewSessionsQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { MessageSquare, FileText, Trash2, Calendar, History as HistoryIcon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function History() {
  const queryClient = useQueryClient();
  const { data: sessions, isLoading, error } = useListInterviewSessions();
  const deleteSession = useDeleteInterviewSession();

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this session?")) {
      deleteSession.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListInterviewSessionsQueryKey() });
        }
      });
    }
  };

  return (
    <Layout>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6 md:p-12">
          <header className="mb-10">
            <h1 className="text-4xl font-serif font-bold text-foreground mb-4">
              Past Sessions
            </h1>
            <p className="text-lg text-muted-foreground">
              Review your previous practice interviews and feedback.
            </p>
          </header>

          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-48 rounded-xl" />
              ))}
            </div>
          )}

          {error && (
            <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
              Could not load history.
            </div>
          )}

          {sessions && sessions.length === 0 && (
            <div className="text-center py-20 bg-card rounded-xl border border-dashed border-border">
              <HistoryIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-xl font-medium mb-2">No sessions yet</h3>
              <p className="text-muted-foreground mb-6">Start a practice interview to see your history here.</p>
              <Button asChild>
                <Link href="/">Browse Roles</Link>
              </Button>
            </div>
          )}

          {sessions && sessions.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {sessions.map(session => (
                <Card key={session.id} className="flex flex-col border-border/60 hover:shadow-sm transition-all" data-testid={`card-session-${session.id}`}>
                  <CardHeader className="pb-4">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-xl font-serif">{session.jobRoleName}</CardTitle>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 -mt-2 -mr-2"
                        onClick={() => handleDelete(session.id)}
                        title="Delete Session"
                        data-testid={`button-delete-${session.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex items-center text-sm text-muted-foreground mt-2 gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {format(new Date(session.createdAt), 'MMMM d, yyyy • h:mm a')}
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 pb-4">
                    {/* Visual spacer */}
                  </CardContent>
                  <CardFooter className="flex gap-3 pt-0 border-t border-border/30 mt-4 px-6 py-4 bg-muted/20">
                    <Button variant="outline" className="flex-1 bg-background" asChild data-testid={`link-chat-${session.id}`}>
                      <Link href={`/interview/${session.id}`}>
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Chat
                      </Link>
                    </Button>
                    <Button variant="default" className="flex-1" asChild data-testid={`link-feedback-${session.id}`}>
                      <Link href={`/feedback/${session.id}`}>
                        <FileText className="w-4 h-4 mr-2" />
                        Feedback
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}