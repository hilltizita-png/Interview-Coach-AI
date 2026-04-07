import { Link } from "wouter";
import {
  useListInterviewSessions,
  useDeleteInterviewSession,
  getListInterviewSessionsQueryKey,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import {
  MessageSquare,
  FileText,
  Trash2,
  Calendar,
  History as HistoryIcon,
  ChevronRight,
  Clock,
  BarChart2,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function History() {
  const queryClient = useQueryClient();
  const { data: sessions, isLoading, error } = useListInterviewSessions();
  const deleteSession = useDeleteInterviewSession();

  const handleDelete = (id: number) => {
    if (confirm("Delete this session? This cannot be undone.")) {
      deleteSession.mutate(
        { id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListInterviewSessionsQueryKey() });
          },
        }
      );
    }
  };

  return (
    <Layout>
      <div className="flex-1 overflow-y-auto bg-[#0d0f14] text-white">
        <div className="max-w-4xl mx-auto p-6 md:p-10 space-y-8">

          {/* Header */}
          <header className="flex items-center gap-4">
            <div className="bg-zinc-800 rounded-2xl p-3">
              <HistoryIcon className="w-6 h-6 text-zinc-300" />
            </div>
            <div>
              <p className="text-xs font-medium tracking-widest uppercase text-zinc-500 mb-0.5">
                Interview Coach
              </p>
              <h1 className="text-2xl font-bold text-white">Past Sessions</h1>
            </div>
          </header>

          {/* Loading skeletons */}
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-44 rounded-2xl bg-zinc-800/60" />
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl text-sm">
              Could not load session history. Please try again.
            </div>
          )}

          {/* Empty state */}
          {sessions && sessions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
              <div className="bg-zinc-800/60 rounded-2xl p-5">
                <HistoryIcon className="w-8 h-8 text-zinc-500" />
              </div>
              <div>
                <p className="font-semibold text-white text-lg">No sessions yet</p>
                <p className="text-sm text-zinc-500 mt-1">
                  Start a challenge to see your history here.
                </p>
              </div>
              <Button asChild className="bg-indigo-600 hover:bg-indigo-500 text-white mt-2">
                <Link href="/">Go to Challenges</Link>
              </Button>
            </div>
          )}

          {/* Session grid */}
          {sessions && sessions.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...sessions].reverse().map((session) => (
                <div
                  key={session.id}
                  data-testid={`card-session-${session.id}`}
                  className="group bg-zinc-900/60 border border-zinc-700/40 rounded-2xl p-5 flex flex-col gap-4 hover:border-zinc-600/60 transition-all"
                >
                  {/* Card header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white text-base truncate">
                        {session.jobRoleName}
                      </p>
                      <p className="text-xs text-zinc-500 flex items-center gap-1.5 mt-1">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(session.createdAt), "MMM d, yyyy · h:mm a")}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(session.id)}
                      title="Delete session"
                      data-testid={`button-delete-${session.id}`}
                      className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Meta pills */}
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-[11px] text-zinc-500 bg-zinc-800/60 rounded-full px-2.5 py-1">
                      <Clock className="w-3 h-3" />
                      Session
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-zinc-500 bg-zinc-800/60 rounded-full px-2.5 py-1">
                      <BarChart2 className="w-3 h-3" />
                      #{session.id}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-auto">
                    <Button
                      variant="ghost"
                      className="flex-1 h-9 border border-zinc-700/60 text-zinc-300 hover:bg-zinc-800/60 hover:text-white text-sm gap-2"
                      asChild
                      data-testid={`link-chat-${session.id}`}
                    >
                      <Link href={`/interview/${session.id}`}>
                        <MessageSquare className="w-3.5 h-3.5" />
                        View Chat
                      </Link>
                    </Button>
                    <Button
                      className="flex-1 h-9 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 hover:text-indigo-200 border border-indigo-500/30 text-sm gap-2"
                      asChild
                      data-testid={`link-feedback-${session.id}`}
                    >
                      <Link href={`/feedback/${session.id}`}>
                        <FileText className="w-3.5 h-3.5" />
                        Feedback
                        <ChevronRight className="w-3 h-3 ml-auto" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
