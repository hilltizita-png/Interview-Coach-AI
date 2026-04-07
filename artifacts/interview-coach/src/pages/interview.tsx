import { useState, useEffect, useRef, useCallback } from "react";
import { streamInterviewReply } from "@/services/ai";
import { useRoute, useLocation, useSearch, Link } from "wouter";
import { useGetInterviewSession, getGetInterviewSessionQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, Send, CheckCircle2, Bot, Volume2, VolumeX, Mic, MicOff,
  Zap, BookOpen, FlaskConical, Trophy, MessageSquare, X, PhoneOff,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import TalkingAvatar from "@/components/TalkingAvatar";

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

function speak(text: string, onStart?: () => void, onEnd?: () => void) {
  if (!text) return;
  window.speechSynthesis.cancel();

  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) {
    window.speechSynthesis.onvoiceschanged = () => speak(text, onStart, onEnd);
    return;
  }

  const preferredVoice = voices.find(v => v.name.includes("Google US English"));
  const englishVoice = voices.find(v => v.lang.startsWith("en"));
  const voice = preferredVoice || englishVoice || voices[0];

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.rate = 1;
  utterance.pitch = 1;
  if (onStart) utterance.onstart = onStart;
  if (onEnd) utterance.onend = onEnd;
  utterance.onboundary = (e) => {
    if (e.name === "word") {
      window.dispatchEvent(new CustomEvent("avatar:boundary"));
    }
  };
  window.speechSynthesis.speak(utterance);
}

function speakAttenborough(text: string, onStart?: () => void, onEnd?: () => void) {
  if (!text) return;
  window.speechSynthesis.cancel();

  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) {
    window.speechSynthesis.onvoiceschanged = () => speakAttenborough(text, onStart, onEnd);
    return;
  }

  const preferredVoice = voices.find(v => v.name.includes("Alex"));
  const englishVoice = voices.find(v => v.lang.startsWith("en"));
  const voice = preferredVoice || englishVoice || voices[0];

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.rate = 0.9;
  utterance.pitch = 1;
  if (onStart) utterance.onstart = onStart;
  if (onEnd) utterance.onend = onEnd;
  utterance.onboundary = (e) => {
    if (e.name === "word") {
      window.dispatchEvent(new CustomEvent("avatar:boundary"));
    }
  };
  window.speechSynthesis.speak(utterance);
}

function startListening(
  onResult: (text: string) => void,
  onStart?: () => void,
  onEnd?: () => void,
) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert("Speech recognition not supported in this browser.");
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event: SpeechRecognitionEvent) => {
    const transcript = event.results[0][0].transcript;
    onResult(transcript);
  };

  recognition.onstart = () => onStart?.();
  recognition.onend = () => onEnd?.();
  recognition.onerror = () => onEnd?.();

  recognition.start();
}

interface LocalMessage {
  id: number | string;
  role: "user" | "assistant";
  content: string;
  isSystem?: boolean;
}

type ChallengeMode = "quick-round" | "full-session" | "answer-lab" | "boss-round" | "general";

const MODE_CONFIG: Record<ChallengeMode, {
  totalMins: number | null;
  maxQuestions: number | null;
  closingNote: boolean;
  label: string;
  Icon: React.ElementType;
  color: string;
  badgeClass: string;
}> = {
  "quick-round":  { totalMins: 10,   maxQuestions: 5,    closingNote: false, label: "Quick Round",  Icon: Zap,          color: "text-yellow-400", badgeClass: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" },
  "full-session": { totalMins: 40,   maxQuestions: null,  closingNote: true,  label: "Full Session", Icon: BookOpen,     color: "text-blue-400",   badgeClass: "bg-blue-500/20 text-blue-300 border-blue-500/30"     },
  "answer-lab":   { totalMins: null, maxQuestions: null,  closingNote: false, label: "Answer Lab",   Icon: FlaskConical, color: "text-purple-400", badgeClass: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
  "boss-round":   { totalMins: 15,   maxQuestions: 5,    closingNote: false, label: "Boss Round",   Icon: Trophy,       color: "text-red-400",    badgeClass: "bg-red-500/20 text-red-300 border-red-500/30"       },
  "general":      { totalMins: 30,   maxQuestions: null,  closingNote: false, label: "Practice",     Icon: Bot,          color: "text-zinc-400",   badgeClass: "bg-zinc-700/40 text-zinc-400 border-zinc-700/40"     },
};

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function Interview() {
  const [, params] = useRoute("/interview/:sessionId");
  const sessionId = params?.sessionId ? parseInt(params.sessionId, 10) : 0;
  const [, setLocation] = useLocation();
  const search = useSearch();
  const mode = ((new URLSearchParams(search).get("mode")) ?? "general") as ChallengeMode;
  const modeConfig = MODE_CONFIG[mode] ?? MODE_CONFIG.general;
  const queryClient = useQueryClient();

  const { data: session, isLoading, error } = useGetInterviewSession(sessionId, {
    query: { enabled: !!sessionId, queryKey: getGetInterviewSessionQueryKey(sessionId) }
  });

  const [input, setInput] = useState("");
  const [localMessages, setLocalMessages] = useState<LocalMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [isNarration, setIsNarration] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [avatarFeedback, setAvatarFeedback] = useState<"good" | "needs improvement" | "thinking" | undefined>();

  const [totalTimeLeft, setTotalTimeLeft] = useState(
    modeConfig.totalMins !== null ? modeConfig.totalMins * 60 : 0
  );
  const [isInterviewActive, setIsInterviewActive] = useState(modeConfig.totalMins !== null);

  const [answersSubmitted, setAnswersSubmitted] = useState(0);
  const [sessionEnded, setSessionEnded] = useState(false);

  const sessionEndedRef = useRef(false);

  const [chatExpanded, setChatExpanded] = useState(true);
  const [micMuted, setMicMuted] = useState(false);

  const minimizeChat = useCallback(() => setChatExpanded(false), []);
  const expandChat = useCallback(() => setChatExpanded(true), []);
  const toggleChat = useCallback(() => setChatExpanded(prev => !prev), []);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices();
    };
  }, []);

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  const handleMicClick = useCallback(() => {
    if (micMuted) return;
    startListening(setInput, () => setIsListening(true), () => setIsListening(false));
  }, [micMuted]);

  useEffect(() => {
    if (session?.messages) {
      setLocalMessages(session.messages.map(m => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content
      })));
    }
  }, [session?.messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages, streamingContent, isStreaming]);

  const detectFeedbackAndSetFace = useCallback(() => {
    const lastMsg = [...localMessages].reverse().find(m => m.role === "assistant");
    if (!lastMsg) return;
    const positive = ["great", "strong", "clear", "excellent"];
    const negative = ["improve", "unclear", "weak", "consider"];
    const isPositive = positive.some(word => lastMsg.content.toLowerCase().includes(word));
    const isNegative = negative.some(word => lastMsg.content.toLowerCase().includes(word));
    if (isPositive) setAvatarFeedback("good");
    else if (isNegative) setAvatarFeedback("needs improvement");
    else setAvatarFeedback("thinking");
  }, [localMessages]);

  useEffect(() => {
    if (localMessages.length === 0) return;
    const lastMessage = localMessages[localMessages.length - 1];
    if (lastMessage.role === "assistant" && speechEnabled) {
      isNarration
        ? speakAttenborough(lastMessage.content, () => { setIsSpeaking(true); setAvatarFeedback("thinking"); }, () => { setIsSpeaking(false); detectFeedbackAndSetFace(); })
        : speak(lastMessage.content, () => { setIsSpeaking(true); setAvatarFeedback("thinking"); }, () => { setIsSpeaking(false); detectFeedbackAndSetFace(); });
    }
  }, [localMessages, speechEnabled, isNarration]);

  const loadFeedback = useCallback(async () => {
    try {
      const res = await fetch(`/api/interview/sessions/${sessionId}/feedback`);
      const data = await res.json();

      const content = `Session complete.

Readiness Score: ${data.readinessScore}/100

Strengths:
${(data.strengths as string[]).map(s => `• ${s}`).join("\n")}

Areas to improve:
${(data.areasForImprovement as string[]).map(a => `• ${a}`).join("\n")}

Steps to improve your score:
${(data.readinessImprovements as string[]).map(a => `• ${a}`).join("\n")}`;

      setLocalMessages(prev => [
        ...prev,
        {
          id: `feedback-${Date.now()}`,
          role: "assistant" as const,
          content,
          isSystem: true,
        }
      ]);

      setTimeout(() => setLocation(`/feedback/${sessionId}`), 4000);
    } catch {
      setLocalMessages(prev => [
        ...prev,
        {
          id: `feedback-err-${Date.now()}`,
          role: "assistant" as const,
          content: "Session complete. Great work! Your feedback is being prepared — click 'Get Feedback' to view it.",
          isSystem: true,
        }
      ]);
    }
  }, [sessionId, setLocation]);

  const endSession = useCallback(async (reason: "max-questions" | "timer") => {
    if (sessionEndedRef.current) return;
    sessionEndedRef.current = true;
    setSessionEnded(true);
    setIsInterviewActive(false);

    let closingText = "";

    if (reason === "timer" && modeConfig.closingNote) {
      closingText = "That brings us to the end of our time together today. You've shown some real strengths in this session — I've genuinely enjoyed our conversation. Give me a moment and I'll put together detailed feedback on your performance.";
    } else if (mode === "boss-round") {
      closingText = "That wraps up your Boss Round. Those were the toughest questions I could throw at you — let me pull your results.";
    } else if (mode === "quick-round") {
      closingText = "And that's five questions — Quick Round complete! Let me score your performance.";
    } else {
      closingText = "That's the end of your session. Well done for completing it — let me prepare your feedback.";
    }

    setLocalMessages(prev => [
      ...prev,
      {
        id: `closing-${Date.now()}`,
        role: "assistant" as const,
        content: closingText,
        isSystem: true,
      }
    ]);

    await new Promise(resolve => setTimeout(resolve, 1800));
    await loadFeedback();
  }, [mode, modeConfig.closingNote, loadFeedback]);

  // Session timer countdown
  useEffect(() => {
    if (!isInterviewActive || sessionEnded) return;

    if (totalTimeLeft === 0) {
      endSession("timer");
      return;
    }

    const interval = setTimeout(() => {
      setTotalTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearTimeout(interval);
  }, [totalTimeLeft, isInterviewActive, sessionEnded, endSession]);

  const handleSendMessage = useCallback(async () => {
    if (!input.trim() || isStreaming || sessionEnded) return;

    const userMessageContent = input.trim();
    setInput("");
    window.speechSynthesis.cancel();

    const tempId = Date.now().toString();
    setLocalMessages(prev => [...prev, { id: `user-${tempId}`, role: "user", content: userMessageContent }]);

    setIsStreaming(true);
    setStreamingContent("");
    setAvatarFeedback("thinking");

    const newAnswerCount = answersSubmitted + 1;
    setAnswersSubmitted(newAnswerCount);

    try {
      const messagesForApi = [
        ...localMessages,
        { id: `user-${tempId}`, role: "user" as const, content: userMessageContent },
      ].map(({ role, content }) => ({ role, content }));

      const questionsLeft = modeConfig.maxQuestions !== null
        ? modeConfig.maxQuestions - newAnswerCount
        : undefined;

      const assistantContent = await streamInterviewReply(
        sessionId,
        session?.jobContext ?? undefined,
        messagesForApi,
        (text) => setStreamingContent(text),
        modeConfig.totalMins !== null ? totalTimeLeft : undefined,
        questionsLeft,
      );

      setLocalMessages(prev => [...prev, { id: `assistant-${tempId}`, role: "assistant", content: assistantContent }]);
      setIsStreaming(false);
      setStreamingContent("");

      const positive = ["great", "strong", "clear", "excellent"];
      const negative = ["improve", "unclear", "weak", "consider"];
      const isPositive = positive.some(word => assistantContent.toLowerCase().includes(word));
      const isNegative = negative.some(word => assistantContent.toLowerCase().includes(word));
      setTimeout(() => {
        if (isPositive) setAvatarFeedback("good");
        else if (isNegative) setAvatarFeedback("needs improvement");
        else setAvatarFeedback("thinking");
      }, 500);
      queryClient.invalidateQueries({ queryKey: getGetInterviewSessionQueryKey(sessionId) });

      if (modeConfig.maxQuestions !== null && newAnswerCount >= modeConfig.maxQuestions) {
        setTimeout(() => endSession("max-questions"), 1200);
      }

    } catch (err) {
      console.error(err);
      setIsStreaming(false);
      setStreamingContent("");
    }
  }, [input, isStreaming, sessionEnded, localMessages, sessionId, session?.jobContext, totalTimeLeft, modeConfig, answersSubmitted, queryClient, endSession]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleEndSession = () => {
    window.speechSynthesis.cancel();
    setLocation(`/feedback/${sessionId}`);
  };

  if (isLoading) {
    return (
      <div className="h-[100dvh] flex flex-col bg-background">
        <header className="border-b p-4 flex items-center justify-between bg-card">
          <Skeleton className="w-32 h-8" />
          <Skeleton className="w-24 h-10" />
        </header>
        <div className="flex-1 p-6 space-y-6">
          <Skeleton className="w-2/3 h-24 rounded-2xl" />
          <Skeleton className="w-1/2 h-16 rounded-2xl ml-auto" />
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-background flex-col gap-4">
        <div className="text-xl text-destructive">Session not found or error loading session.</div>
        <Button onClick={() => setLocation("/")}>Go back</Button>
      </div>
    );
  }

  const ModeIcon = modeConfig.Icon;
  const questionsLeft = modeConfig.maxQuestions !== null
    ? Math.max(modeConfig.maxQuestions - answersSubmitted, 0)
    : null;

  return (
    <div
      data-testid="interview-zoom-layout"
      style={{
        position: "fixed",
        inset: 0,
        background: "#0a1220",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes zoom-bar-in {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .zoom-avatar-container {
          position: absolute;
          inset: 0;
        }
        .zoom-control-bar {
          animation: zoom-bar-in 0.35s ease both;
          position: absolute;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 12px;
          background: rgba(10,18,32,0.82);
          backdrop-filter: blur(14px);
          border: 1px solid rgba(255,255,255,0.10);
          border-radius: 40px;
          padding: 10px 20px;
          z-index: 50;
          box-shadow: 0 8px 40px rgba(0,0,0,0.6);
          white-space: nowrap;
        }
        .zoom-chat-panel {
          position: absolute;
          top: 0;
          right: 0;
          bottom: 0;
          width: 360px;
          max-width: 92vw;
          z-index: 40;
          display: flex;
          flex-direction: column;
          background: rgba(10,18,32,0.92);
          backdrop-filter: blur(18px);
          border-left: 1px solid rgba(255,255,255,0.10);
          box-shadow: -8px 0 40px rgba(0,0,0,0.5);
          transition: transform 0.28s cubic-bezier(0.25,0.46,0.45,0.94), opacity 0.28s;
        }
        .zoom-chat-panel.expanded {
          transform: translateX(0);
          opacity: 1;
          pointer-events: all;
        }
        .zoom-chat-panel.minimized {
          transform: translateX(100%);
          opacity: 0;
          pointer-events: none;
        }
        .zoom-chat-tab {
          position: absolute;
          top: 50%;
          right: 0;
          transform: translateY(-50%);
          z-index: 41;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          background: rgba(10,18,32,0.88);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255,255,255,0.12);
          border-right: none;
          border-radius: 12px 0 0 12px;
          padding: 14px 10px;
          cursor: pointer;
          transition: background 0.15s, transform 0.15s;
          box-shadow: -4px 0 20px rgba(0,0,0,0.4);
        }
        .zoom-chat-tab:hover {
          background: rgba(20,35,60,0.95);
          transform: translateY(-50%) translateX(-2px);
        }
        .zoom-chat-tab-label {
          writing-mode: vertical-rl;
          text-orientation: mixed;
          transform: rotate(180deg);
          color: rgba(255,255,255,0.75);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.08em;
          white-space: nowrap;
        }
        .zoom-status-badge {
          position: absolute;
          top: 20px;
          left: 20px;
          z-index: 30;
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(10,18,32,0.7);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 20px;
          padding: 6px 14px 6px 10px;
          color: white;
          font-size: 13px;
          font-weight: 600;
        }
        .zoom-ctrl-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.10);
          border-radius: 50%;
          width: 48px;
          height: 48px;
          cursor: pointer;
          transition: background 0.15s, transform 0.1s;
          color: white;
          justify-content: center;
          flex-shrink: 0;
        }
        .zoom-ctrl-btn:hover {
          background: rgba(255,255,255,0.16);
          transform: scale(1.07);
        }
        .zoom-ctrl-btn.active {
          background: rgba(56,189,248,0.22);
          border-color: rgba(56,189,248,0.45);
        }
        .zoom-ctrl-btn.danger {
          background: rgba(239,68,68,0.85);
          border-color: transparent;
        }
        .zoom-ctrl-btn.danger:hover {
          background: rgba(239,68,68,1);
        }
        .zoom-timer {
          color: white;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: 0.06em;
          min-width: 52px;
          text-align: center;
          font-variant-numeric: tabular-nums;
        }
        .zoom-timer.warning {
          color: #f87171;
        }
        .zoom-divider {
          width: 1px;
          height: 28px;
          background: rgba(255,255,255,0.12);
          flex-shrink: 0;
        }
        .zoom-chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px 16px 24px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          scroll-behavior: smooth;
        }
        .zoom-chat-input {
          padding: 12px 14px;
          border-top: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.03);
          flex-shrink: 0;
        }
      `}</style>

      {/* Full-screen avatar background */}
      <div className="zoom-avatar-container">
        <TalkingAvatar
          isSpeaking={isSpeaking}
          feedback={avatarFeedback}
          rightOffset={chatExpanded ? 360 : 0}
        />
      </div>

      {/* Top-left: role name + mode badge */}
      <div className="zoom-status-badge" data-testid="text-role-name">
        <ArrowLeft
          style={{ width: 16, height: 16, cursor: "pointer", opacity: 0.7 }}
          onClick={() => setLocation("/")}
        />
        <span data-testid="interview-role-name">{session.jobRoleName}</span>
        {mode !== "general" && (
          <span style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 11,
            fontWeight: 700,
            borderRadius: 20,
            padding: "2px 8px",
            marginLeft: 2,
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.15)",
          }}>
            <ModeIcon style={{ width: 10, height: 10 }} />
            {modeConfig.label}
          </span>
        )}
        {questionsLeft !== null && !sessionEnded && (
          <span style={{ fontSize: 11, opacity: 0.6, marginLeft: 4 }}>
            {questionsLeft === 0 ? "Wrapping up…" : `${questionsLeft}q left`}
          </span>
        )}
        {sessionEnded && (
          <span style={{ fontSize: 11, color: "#4ade80", marginLeft: 4 }}>Complete</span>
        )}
      </div>

      {/* Avatar status overlay badge (top center, subtle) */}
      {(isStreaming || isSpeaking || isListening) && (
        <div style={{
          position: "absolute",
          top: 20,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 30,
          background: "rgba(10,18,32,0.72)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 20,
          padding: "5px 14px",
          color: isSpeaking ? "#38bdf8" : isStreaming ? "#a78bfa" : "rgba(255,255,255,0.7)",
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: "0.04em",
          whiteSpace: "nowrap",
        }}>
          {isStreaming ? "Thinking…" : isSpeaking ? "Speaking…" : "Listening…"}
        </div>
      )}

      {/* Minimized chat tab — visible when panel is minimized */}
      {!chatExpanded && (
        <div className="zoom-chat-tab" onClick={expandChat} data-testid="chat-tab-minimized" title="Open chat">
          <MessageSquare style={{ width: 18, height: 18, color: "#38bdf8" }} />
          <span className="zoom-chat-tab-label">Interview Chat</span>
          {localMessages.length > 0 && (
            <span style={{
              background: "#38bdf8", color: "#0a1220", borderRadius: "50%",
              width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 700, flexShrink: 0,
            }}>
              {localMessages.length}
            </span>
          )}
        </div>
      )}

      {/* Chat panel — always mounted, slides with CSS transition */}
      <div
        className={`zoom-chat-panel ${chatExpanded ? "expanded" : "minimized"}`}
        data-testid="chat-panel"
      >
          {/* Panel header */}
          <div style={{
            padding: "14px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}>
            <span style={{ color: "white", fontWeight: 700, fontSize: 15 }}>
              Interview Chat
            </span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {/* Narration toggle */}
              {speechEnabled && (
                <label style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  cursor: "pointer",
                  color: "rgba(255,255,255,0.55)",
                  fontSize: 11,
                  userSelect: "none",
                }}>
                  <input
                    type="checkbox"
                    checked={isNarration}
                    onChange={() => setIsNarration(prev => !prev)}
                    data-testid="checkbox-narration"
                    style={{ accentColor: "#38bdf8" }}
                  />
                  Narration
                </label>
              )}
              <button
                onClick={minimizeChat}
                data-testid="button-close-chat"
                title="Minimize chat"
                style={{
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: "50%",
                  width: 30,
                  height: 30,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "rgba(255,255,255,0.7)",
                }}
              >
                <X style={{ width: 14, height: 14 }} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="zoom-chat-messages">
            {localMessages.length === 0 && !isStreaming && (
              <div style={{ textAlign: "center", color: "rgba(255,255,255,0.35)", marginTop: 40 }}>
                <Bot style={{ width: 36, height: 36, margin: "0 auto 10px", opacity: 0.4 }} />
                <p style={{ fontSize: 14 }}>Your coach is ready.</p>
                <p style={{ fontSize: 12, marginTop: 4 }}>Introduce yourself to start.</p>
              </div>
            )}

            {localMessages.map((msg, i) => (
              <div
                key={msg.id}
                style={{
                  display: "flex",
                  justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                  gap: 8,
                }}
                data-testid={`msg-${msg.role}-${i}`}
              >
                {msg.role === "assistant" && (
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: "rgba(56,189,248,0.2)",
                    border: "1px solid rgba(56,189,248,0.35)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    marginTop: 4,
                  }}>
                    <Bot style={{ width: 14, height: 14, color: "#38bdf8" }} />
                  </div>
                )}
                <div style={{
                  maxWidth: "80%",
                  padding: "10px 14px",
                  borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                  fontSize: 13,
                  lineHeight: 1.5,
                  background: msg.role === "user"
                    ? "rgba(56,189,248,0.18)"
                    : msg.isSystem
                    ? "rgba(74,222,128,0.10)"
                    : "rgba(255,255,255,0.07)",
                  border: msg.role === "user"
                    ? "1px solid rgba(56,189,248,0.25)"
                    : msg.isSystem
                    ? "1px solid rgba(74,222,128,0.20)"
                    : "1px solid rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.9)",
                  whiteSpace: "pre-wrap",
                }}>
                  {msg.content}
                </div>
              </div>
            ))}

            {isStreaming && (
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-start" }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: "rgba(56,189,248,0.2)", border: "1px solid rgba(56,189,248,0.35)",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 4,
                }}>
                  <Bot style={{ width: 14, height: 14, color: "#38bdf8" }} />
                </div>
                <div style={{
                  maxWidth: "80%", padding: "10px 14px",
                  borderRadius: "18px 18px 18px 4px",
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.9)",
                  fontSize: 13, lineHeight: 1.5,
                  minWidth: 60,
                }}>
                  {streamingContent ? (
                    <div style={{ whiteSpace: "pre-wrap" }}>{streamingContent}</div>
                  ) : (
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }} data-testid="typing-indicator">
                      <div className="w-2 h-2 rounded-full typing-dot" style={{ background: "rgba(56,189,248,0.5)" }} />
                      <div className="w-2 h-2 rounded-full typing-dot" style={{ background: "rgba(56,189,248,0.5)" }} />
                      <div className="w-2 h-2 rounded-full typing-dot" style={{ background: "rgba(56,189,248,0.5)" }} />
                    </div>
                  )}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Chat input */}
          <div className="zoom-chat-input">
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  sessionEnded ? "Session complete — view your feedback above"
                  : isStreaming ? "Wait for the coach to finish…"
                  : isListening ? "Listening…"
                  : "Type your response… (Enter to send)"
                }
                rows={2}
                disabled={isStreaming || isListening || sessionEnded}
                data-testid="input-chat"
                style={{
                  flex: 1,
                  resize: "none",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 12,
                  color: "white",
                  fontSize: 13,
                  padding: "8px 12px",
                  minHeight: 52,
                  maxHeight: 140,
                }}
                className="focus-visible:ring-1 focus-visible:ring-sky-400 placeholder:text-white/30"
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <button
                  onClick={handleMicClick}
                  disabled={isStreaming || micMuted || sessionEnded}
                  data-testid="button-mic"
                  style={{
                    width: 36, height: 36,
                    borderRadius: "50%",
                    border: isListening ? "1px solid rgba(239,68,68,0.6)" : "1px solid rgba(255,255,255,0.14)",
                    background: isListening ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.07)",
                    color: isListening ? "#f87171" : "rgba(255,255,255,0.7)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: (micMuted || sessionEnded) ? "not-allowed" : "pointer",
                    opacity: (micMuted || sessionEnded) ? 0.4 : 1,
                  }}
                  title={isListening ? "Listening…" : "Speak your answer"}
                >
                  {isListening ? <MicOff style={{ width: 15, height: 15 }} /> : <Mic style={{ width: 15, height: 15 }} />}
                </button>
                <button
                  onClick={handleSendMessage}
                  disabled={!input.trim() || isStreaming || sessionEnded}
                  data-testid="button-send"
                  style={{
                    width: 36, height: 36,
                    borderRadius: "50%",
                    border: "1px solid rgba(56,189,248,0.4)",
                    background: (input.trim() && !isStreaming && !sessionEnded) ? "rgba(56,189,248,0.25)" : "rgba(255,255,255,0.05)",
                    color: (input.trim() && !isStreaming && !sessionEnded) ? "#38bdf8" : "rgba(255,255,255,0.25)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: (input.trim() && !isStreaming && !sessionEnded) ? "pointer" : "not-allowed",
                    transition: "background 0.15s",
                  }}
                >
                  <Send style={{ width: 14, height: 14 }} />
                </button>
              </div>
            </div>
            {sessionEnded ? (
              <div style={{ marginTop: 8, textAlign: "center" }}>
                <button
                  onClick={() => setLocation(`/feedback/${sessionId}`)}
                  style={{
                    background: "rgba(74,222,128,0.2)",
                    border: "1px solid rgba(74,222,128,0.35)",
                    borderRadius: 20,
                    color: "#4ade80",
                    fontSize: 12,
                    fontWeight: 600,
                    padding: "5px 14px",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <CheckCircle2 style={{ width: 13, height: 13 }} />
                  View Full Feedback Report
                </button>
              </div>
            ) : (
              <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 10, marginTop: 6, textAlign: "center" }}>
                Press Enter to send · Shift+Enter for new line
              </p>
            )}
          </div>
        </div>

      {/* Zoom-style bottom control bar */}
      <div className="zoom-control-bar">
        {/* Session timer (only shown when there's a time limit) */}
        {modeConfig.totalMins !== null && (
          <span className={`zoom-timer ${totalTimeLeft < 300 ? "warning" : ""}`}>
            {formatTime(totalTimeLeft)}
          </span>
        )}

        {modeConfig.totalMins !== null && <div className="zoom-divider" />}

        {/* Mute mic */}
        <button
          className={`zoom-ctrl-btn ${micMuted ? "" : "active"}`}
          onClick={() => setMicMuted(prev => !prev)}
          data-testid="button-toggle-mic"
          title={micMuted ? "Unmute mic" : "Mute mic"}
        >
          {micMuted
            ? <MicOff style={{ width: 20, height: 20, color: "#f87171" }} />
            : <Mic style={{ width: 20, height: 20 }} />
          }
        </button>

        {/* Mute speaker */}
        <button
          className={`zoom-ctrl-btn ${speechEnabled ? "active" : ""}`}
          onClick={() => {
            if (speechEnabled) window.speechSynthesis.cancel();
            setSpeechEnabled(prev => !prev);
          }}
          data-testid="button-toggle-speech"
          title={speechEnabled ? "Mute interviewer" : "Unmute interviewer"}
        >
          {speechEnabled
            ? <Volume2 style={{ width: 20, height: 20 }} />
            : <VolumeX style={{ width: 20, height: 20, color: "rgba(255,255,255,0.4)" }} />
          }
        </button>

        {/* Chat toggle */}
        <button
          className={`zoom-ctrl-btn ${chatExpanded ? "active" : ""}`}
          onClick={toggleChat}
          data-testid="button-toggle-chat"
          title={chatExpanded ? "Minimize chat" : "Open chat"}
        >
          <MessageSquare style={{ width: 20, height: 20 }} />
        </button>

        <div className="zoom-divider" />

        {/* Feedback button */}
        <button
          className="zoom-ctrl-btn"
          onClick={() => setLocation(`/feedback/${sessionId}`)}
          data-testid="button-get-feedback"
          title="Get feedback"
          style={{ borderRadius: 24, width: "auto", padding: "0 14px", gap: 6, flexDirection: "row" }}
        >
          <CheckCircle2 style={{ width: 16, height: 16, color: "#4ade80" }} />
          <span style={{ fontSize: 12, fontWeight: 600 }}>Feedback</span>
        </button>

        {/* End session */}
        <button
          className="zoom-ctrl-btn danger"
          onClick={handleEndSession}
          data-testid="button-end-session"
          title="End session"
        >
          <PhoneOff style={{ width: 20, height: 20 }} />
        </button>
      </div>
    </div>
  );
}
