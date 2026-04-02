import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Sparkles, X, CheckCircle2 } from "lucide-react";

interface JobInputProps {
  onJobExtracted: (summary: string) => void;
  onClear: () => void;
  summary: string | null;
  defaultOpen?: boolean;
}

type Mode = "paste" | "generate";

export default function JobInput({ onJobExtracted, onClear, summary, defaultOpen = false }: JobInputProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [mode, setMode] = useState<Mode>("paste");
  const [posting, setPosting] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAnalyze() {
    setLoading(true);
    try {
      const res = await fetch("/api/interview/analyze-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ posting }),
      });
      const data = await res.json();
      onJobExtracted(data.summary);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  async function handleResearch() {
    setLoading(true);
    try {
      const res = await fetch("/api/interview/research-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: roleTitle }),
      });
      const data = await res.json();
      onJobExtracted(data.summary);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  if (summary?.trim()) {
    return (
      <div className="flex items-start gap-3 px-4 py-3 bg-primary/5 border border-primary/20 rounded-xl text-sm mb-8">
        <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
        <div className="flex-1 text-muted-foreground leading-relaxed whitespace-pre-wrap">{summary}</div>
        <button
          onClick={() => { onClear(); setPosting(""); setRoleTitle(""); }}
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          title="Remove job context"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="mb-8">
      {!open ? (
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setOpen(true)}>
          <Sparkles className="w-4 h-4 text-primary" />
          Tailor to a job posting
        </Button>
      ) : (
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Tailor your interview</CardTitle>
                <CardDescription>Paste a job posting or generate a profile from a title.</CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="rounded-full -mt-1 -mr-1">
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex gap-1 mt-2 bg-muted rounded-lg p-1 w-fit">
              <button
                onClick={() => setMode("paste")}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${mode === "paste" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                Paste posting
              </button>
              <button
                onClick={() => setMode("generate")}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${mode === "generate" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                data-testid="tab-generate"
              >
                Generate from title
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {mode === "paste" ? (
              <>
                <Textarea
                  rows={6}
                  placeholder="Paste the job description here..."
                  value={posting}
                  onChange={(e) => setPosting(e.target.value)}
                  className="resize-none text-sm"
                  data-testid="textarea-job-posting"
                />
                <Button
                  disabled={!posting.trim() || loading}
                  onClick={handleAnalyze}
                  className="gap-2"
                  data-testid="button-analyze-posting"
                >
                  <Sparkles className="w-4 h-4" />
                  {loading ? "Analyzing..." : "Analyze Posting"}
                </Button>
              </>
            ) : (
              <>
                <Input
                  placeholder="e.g. Senior Product Manager, ML Engineer..."
                  value={roleTitle}
                  onChange={(e) => setRoleTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && roleTitle.trim() && !loading && handleResearch()}
                  data-testid="input-role-title"
                />
                <Button
                  disabled={!roleTitle.trim() || loading}
                  onClick={handleResearch}
                  className="gap-2"
                  data-testid="button-research-role"
                >
                  <Sparkles className="w-4 h-4" />
                  {loading ? "Researching..." : "Generate Profile"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
