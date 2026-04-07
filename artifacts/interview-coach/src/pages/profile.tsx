import { useState, useRef } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useProfile, JobPosting } from "@/contexts/profile-context";
import {
  UserCircle,
  FileText,
  Briefcase,
  Trash2,
  Plus,
  ChevronDown,
  ChevronUp,
  Check,
  Pencil,
  Loader2,
  FileUp,
} from "lucide-react";

async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    pages.push(pageText);
  }

  return pages.join("\n\n").replace(/\s{3,}/g, "  ").trim();
}

function ResumeSection() {
  const { resume, setResume } = useProfile();
  const [draft, setDraft] = useState(resume);
  const [saved, setSaved] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    setResume(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setParseError("");

    if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
      setParsing(true);
      try {
        const text = await extractTextFromPdf(file);
        if (!text.trim()) {
          setParseError("No readable text found in this PDF. Try a text-based PDF rather than a scanned image.");
        } else {
          setDraft(text);
          setUploadedFileName(file.name);
        }
      } catch {
        setParseError("Could not read this PDF. Make sure it's a standard PDF with selectable text.");
      } finally {
        setParsing(false);
      }
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setDraft(ev.target?.result as string);
        setUploadedFileName(file.name);
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="bg-zinc-900/60 border border-zinc-700/40 rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="bg-indigo-500/20 rounded-xl p-2.5">
          <FileText className="w-5 h-5 text-indigo-400" />
        </div>
        <div>
          <h2 className="font-semibold text-white">Resume</h2>
          <p className="text-xs text-zinc-500">Paste your resume, or upload a PDF or text file. Used to tailor interview questions.</p>
        </div>
      </div>

      {/* Drop zone / upload area */}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={parsing}
        className="w-full border-2 border-dashed border-zinc-700/60 rounded-xl py-5 px-4 flex flex-col items-center gap-2 hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 group"
      >
        {parsing ? (
          <>
            <Loader2 className="w-7 h-7 text-indigo-400 animate-spin" />
            <span className="text-sm text-zinc-400">Reading PDF…</span>
          </>
        ) : (
          <>
            <FileUp className="w-7 h-7 text-zinc-500 group-hover:text-indigo-400 transition-colors" />
            <span className="text-sm font-medium text-zinc-300">Upload PDF or text file</span>
            <span className="text-xs text-zinc-600">.pdf · .txt · .md</span>
          </>
        )}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
        className="hidden"
        onChange={handleFileUpload}
      />

      {uploadedFileName && !parsing && (
        <p className="text-xs text-indigo-400 flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5" />
          Loaded from <span className="font-medium">{uploadedFileName}</span> — review and save below
        </p>
      )}

      {parseError && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {parseError}
        </p>
      )}

      <Textarea
        value={draft}
        onChange={(e) => { setDraft(e.target.value); setUploadedFileName(""); }}
        placeholder="Or paste your resume text directly here…"
        className="min-h-[200px] bg-zinc-800/60 border-zinc-700/60 text-white placeholder:text-zinc-600 resize-y text-sm"
      />

      <div className="flex items-center gap-3">
        <Button
          onClick={handleSave}
          className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2"
          disabled={draft === resume || parsing}
        >
          {saved ? <Check className="w-4 h-4" /> : null}
          {saved ? "Saved" : "Save Resume"}
        </Button>
        {resume && (
          <span className="text-xs text-emerald-400 flex items-center gap-1">
            <Check className="w-3 h-3" /> Resume saved
          </span>
        )}
      </div>
    </div>
  );
}

function PostingCard({ posting, onDelete, onUpdate }: {
  posting: JobPosting;
  onDelete: () => void;
  onUpdate: (label: string, content: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(posting.label);
  const [content, setContent] = useState(posting.content);

  const handleSave = () => {
    onUpdate(label, content);
    setEditing(false);
  };

  return (
    <div className="bg-zinc-800/50 border border-zinc-700/40 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Briefcase className="w-4 h-4 text-zinc-400 shrink-0" />
          {editing ? (
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="bg-zinc-700/60 text-white text-sm rounded-md px-2 py-1 flex-1 min-w-0 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              autoFocus
            />
          ) : (
            <span className="text-sm font-medium text-white truncate">{posting.label}</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => { setEditing((v) => !v); setExpanded(true); }}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/50 transition-colors"
            title="Edit"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/50 transition-colors"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {editing ? (
            <>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[150px] bg-zinc-700/40 border-zinc-600/60 text-white text-sm resize-y"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-500 text-white">
                  Save
                </Button>
                <Button size="sm" variant="ghost" className="text-zinc-400" onClick={() => { setEditing(false); setLabel(posting.label); setContent(posting.content); }}>
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap line-clamp-6">
              {posting.content}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function JobPostingsSection() {
  const { jobPostings, addJobPosting, updateJobPosting, deleteJobPosting } = useProfile();
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newContent, setNewContent] = useState("");

  const handleAdd = () => {
    if (!newLabel.trim() || !newContent.trim()) return;
    addJobPosting(newLabel.trim(), newContent.trim());
    setNewLabel("");
    setNewContent("");
    setAdding(false);
  };

  return (
    <div className="bg-zinc-900/60 border border-zinc-700/40 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500/20 rounded-xl p-2.5">
            <Briefcase className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="font-semibold text-white">Job Postings</h2>
            <p className="text-xs text-zinc-500">Save and label job postings to quickly tailor your practice sessions.</p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => setAdding((v) => !v)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Add Posting
        </Button>
      </div>

      {adding && (
        <div className="bg-zinc-800/60 border border-zinc-700/40 rounded-xl p-4 space-y-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-1.5 block">
              Label
            </label>
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g. Google SWE 2025, Shopify PM"
              className="w-full bg-zinc-700/60 border border-zinc-600/60 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-zinc-600"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-1.5 block">
              Job Posting
            </label>
            <Textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Paste the full job posting here…"
              className="min-h-[140px] bg-zinc-700/40 border-zinc-600/60 text-white text-sm resize-y placeholder:text-zinc-600"
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!newLabel.trim() || !newContent.trim()}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              Save Posting
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-zinc-400"
              onClick={() => { setAdding(false); setNewLabel(""); setNewContent(""); }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {jobPostings.length === 0 && !adding && (
        <div className="text-center py-8 text-zinc-600 text-sm">
          No job postings saved yet. Add one to get started.
        </div>
      )}

      <div className="space-y-2">
        {jobPostings.map((posting) => (
          <PostingCard
            key={posting.id}
            posting={posting}
            onDelete={() => deleteJobPosting(posting.id)}
            onUpdate={(label, content) => updateJobPosting(posting.id, label, content)}
          />
        ))}
      </div>
    </div>
  );
}

export default function Profile() {
  return (
    <Layout>
      <div className="flex-1 overflow-y-auto bg-[#0d0f14] text-white">
        <div className="max-w-3xl mx-auto p-6 md:p-10 space-y-8">
          <header className="flex items-center gap-4">
            <div className="bg-zinc-800 rounded-2xl p-3">
              <UserCircle className="w-7 h-7 text-zinc-300" />
            </div>
            <div>
              <p className="text-xs font-medium tracking-widest uppercase text-zinc-500 mb-0.5">
                Interview Coach
              </p>
              <h1 className="text-2xl font-bold text-white">Your Profile</h1>
            </div>
          </header>

          <ResumeSection />
          <JobPostingsSection />
        </div>
      </div>
    </Layout>
  );
}
