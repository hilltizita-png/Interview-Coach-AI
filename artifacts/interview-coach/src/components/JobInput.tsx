import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Sparkles, X, CheckCircle2 } from "lucide-react";

interface JobInputProps {
  onJobExtracted: (summary: string) => void;
  onClear: () => void;
  summary: string | null;
  defaultOpen?: boolean;
}

export default function JobInput({ onJobExtracted, onClear, summary, defaultOpen = false }: JobInputProps) {
  const [posting, setPosting] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(defaultOpen);

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

  if (summary) {
    return (
      <div className="flex items-start gap-3 px-4 py-3 bg-primary/5 border border-primary/20 rounded-xl text-sm mb-8">
        <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
        <div className="flex-1 text-muted-foreground leading-relaxed">{summary}</div>
        <button
          onClick={() => { onClear(); setPosting(""); }}
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
                <CardTitle className="text-base">Paste a Job Posting</CardTitle>
                <CardDescription>I'll tailor the interview questions to match this role.</CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="rounded-full -mt-1 -mr-1">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
