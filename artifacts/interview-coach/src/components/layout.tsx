import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Brain, History, User } from "lucide-react";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-background">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-border bg-card flex flex-col">
        <div className="p-6">
          <div className="flex items-center gap-3 text-primary font-serif font-bold text-xl">
            <div className="bg-primary text-primary-foreground p-2 rounded-lg">
              <Brain className="w-5 h-5" />
            </div>
            Coach
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            A quiet space to practice.
          </p>
        </div>

        <nav className="flex-1 px-4 pb-4 flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-visible">
          <Link
            href="/"
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md transition-colors whitespace-nowrap md:whitespace-normal",
              location === "/" 
                ? "bg-primary text-primary-foreground font-medium" 
                : "text-foreground hover:bg-secondary"
            )}
            data-testid="nav-home"
          >
            <User className="w-4 h-4" />
            Roles
          </Link>
          <Link
            href="/history"
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md transition-colors whitespace-nowrap md:whitespace-normal",
              location === "/history" 
                ? "bg-primary text-primary-foreground font-medium" 
                : "text-foreground hover:bg-secondary"
            )}
            data-testid="nav-history"
          >
            <History className="w-4 h-4" />
            Past Sessions
          </Link>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {children}
      </main>
    </div>
  );
}