import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Brain, History, UserCircle, Home } from "lucide-react";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-[#0d0f14]">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-56 border-b md:border-b-0 md:border-r border-zinc-800/60 bg-zinc-900/80 flex flex-col shrink-0">
        <div className="px-5 py-5 border-b border-zinc-800/60">
          <div className="flex items-center gap-2.5">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white text-base tracking-tight">Interview Coach</span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-visible">
          {[
            { href: "/profile", label: "Profile", icon: UserCircle },
            { href: "/", label: "Challenges", icon: Home },
            { href: "/history", label: "Past Sessions", icon: History },
          ].map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors whitespace-nowrap md:whitespace-normal",
                location === href
                  ? "bg-indigo-600/20 text-indigo-300 font-medium"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {children}
      </main>
    </div>
  );
}
