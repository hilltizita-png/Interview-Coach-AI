import { useState, useEffect, useRef, useCallback } from "react";
import { streamInterviewReply } from "@/services/ai";
import { useRoute, useLocation, useSearch, Link } from "wouter";
import { useGetInterviewSession, getGetInterviewSessionQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Send, CheckCircle2, Bot, Volume2, VolumeX, Mic, MicOff, Zap, BookOpen, FlaskConical, Trophy } from "lucide-react";
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
  "quick-round":  { totalMins: 10,   maxQuestions: 5,    closingNote: false, label: "Quick Round",  Icon: Zap,         color: "text-yellow-400", badgeClass: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" },
  "full-session": { totalMins: 40,   maxQuestions: null,  closingNote: true,  label: "Full Session", Icon: BookOpen,    color: "text-blue-400",   badgeClass: "bg-blue-500/20 text-blue-300 border-blue-500/30"     },
  "answer-lab":   { totalMins: null, maxQuestions: null,  closingNote: false, label: "Answer Lab",   Icon: FlaskConical, color: "text-purple-400", badgeClass: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
  "boss-round":   { totalMins: 15,   maxQuestions: 5,    closingNote: false, label: "Boss Round",   Icon: Trophy,      color: "text-red-400",    badgeClass: "bg-red-500/20 text-red-300 border-red-500/30"       },
  "general":      { totalMins: 30,   maxQuestions: null,  closingNote: false, label: "Practice",     Icon: Bot,         color: "text-zinc-400",   badgeClass: "bg-zinc-700/40 text-zinc-400 border-zinc-700/40"     },
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
    startListening(setInput, () => setIsListening(true), () => setIsListening(false));
  }, []);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
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

      // End session when max questions are answered
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
    <div className="h-[100dvh] flex flex-col bg-background relative">
      {/* Header */}
      <header className="border-b border-border bg-card shrink-0 flex items-center justify-between px-4 md:px-6 py-4 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild className="rounded-full">
            <Link href="/" data-testid="link-back-roles">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif font-bold text-lg leading-none" data-testid="text-role-name">
                {session.jobRoleName}
              </h1>
              {mode !== "general" && (
                <span className={`inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2.5 py-0.5 border ${modeConfig.badgeClass}`}>
                  <ModeIcon className="w-3 h-3" />
                  {modeConfig.label}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              {isInterviewActive && modeConfig.totalMins !== null && (
                <div className={`interview-timer ${totalTimeLeft < 120 ? "warning" : ""}`}>
                  🕒 {formatTime(totalTimeLeft)}
                </div>
              )}
              {questionsLeft !== null && !sessionEnded && (
                <span className="text-xs text-muted-foreground">
                  {questionsLeft === 0
                    ? "Wrapping up…"
                    : `${questionsLeft} question${questionsLeft === 1 ? "" : "s"} left`}
                </span>
              )}
              {sessionEnded && (
                <span className="text-xs font-medium text-emerald-400">Session complete</span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {speechEnabled && (
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isNarration}
                onChange={() => setIsNarration(prev => !prev)}
                className="accent-primary"
                data-testid="checkbox-narration"
              />
              Narration
            </label>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (speechEnabled) window.speechSynthesis.cancel();
              setSpeechEnabled(prev => !prev);
            }}
            data-testid="button-toggle-speech"
            title={speechEnabled ? "Mute interviewer" : "Unmute interviewer"}
            className="rounded-full"
          >
            {speechEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5 text-muted-foreground" />}
          </Button>
          <Button 
            variant="secondary" 
            onClick={() => setLocation(`/feedback/${sessionId}`)}
            data-testid="button-get-feedback"
            className="gap-2"
          >
            <CheckCircle2 className="w-4 h-4 text-primary" />
            {mode === "answer-lab" ? "Get Feedback" : "View Feedback"}
          </Button>
        </div>
      </header>

      {/* Interview Screen — Zoom/Teams style */}
      <div className="interview-screen">

        {/* Left: Avatar panel */}
        <div className="avatar-panel">
          <TalkingAvatar isSpeaking={isSpeaking} feedback={avatarFeedback} />
          <p className="avatar-status">
            {sessionEnded ? "Session complete" : isSpeaking ? "Answering…" : isStreaming ? "Thinking…" : "Listening"}
          </p>
        </div>

        {/* Right: Chat + input */}
        <div className="chat-column">
          <div className="chat-area">
            <div className="max-w-3xl mx-auto space-y-8 pb-4">

            {localMessages.length === 0 && !isStreaming && (
              <div className="text-center text-muted-foreground my-12 animate-in fade-in zoom-in duration-500">
                <Bot className="w-12 h-12 mx-auto mb-4 text-primary/40" />
                <p className="text-lg">Your coach is ready.</p>
                <p className="text-sm">Introduce yourself to start the interview.</p>
              </div>
            )}

            {localMessages.map((msg, i) => (
              <div 
                key={msg.id} 
                className={`flex gap-4 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                data-testid={`msg-${msg.role}-${i}`}
              >
                {msg.role === "assistant" && (
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 shadow-sm text-primary-foreground">
                    <Bot className="w-5 h-5" />
                  </div>
                )}
                <div 
                  className={`px-5 py-4 rounded-2xl max-w-[85%] text-base leading-relaxed shadow-sm ${
                    msg.role === "user" 
                      ? "bg-primary text-primary-foreground rounded-tr-sm" 
                      : msg.isSystem
                        ? "bg-muted/60 text-foreground border border-border/60 rounded-tl-sm"
                        : "bg-card text-card-foreground border border-border rounded-tl-sm"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              </div>
            ))}

            {isStreaming && (
              <div className="flex gap-4 justify-start animate-in fade-in">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 shadow-sm text-primary-foreground">
                  <Bot className="w-5 h-5" />
                </div>
                <div className="px-5 py-4 rounded-2xl max-w-[85%] bg-card text-card-foreground border border-border rounded-tl-sm shadow-sm min-h-[56px] flex items-center">
                  {streamingContent ? (
                    <div className="whitespace-pre-wrap leading-relaxed">{streamingContent}</div>
                  ) : (
                    <div className="flex gap-1 items-center h-full px-2" data-testid="typing-indicator">
                      <div className="w-2 h-2 rounded-full bg-primary/40 typing-dot"></div>
                      <div className="w-2 h-2 rounded-full bg-primary/40 typing-dot"></div>
                      <div className="w-2 h-2 rounded-full bg-primary/40 typing-dot"></div>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input area */}
          <div className="chat-input-area">
            <div className="max-w-3xl mx-auto relative flex items-end gap-3">
              <Textarea 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  sessionEnded ? "Session complete — view your feedback above"
                  : isStreaming ? "Wait for the coach to finish..."
                  : isListening ? "Listening..."
                  : "Type or speak your response… (Enter to send)"
                }
                className="min-h-[60px] max-h-[200px] resize-none pr-24 rounded-xl border-input bg-background shadow-sm focus-visible:ring-1 focus-visible:ring-primary text-base"
                disabled={isStreaming || isListening || sessionEnded}
                data-testid="input-chat"
                rows={2}
              />
              <Button
                size="icon"
                variant="ghost"
                className={`absolute right-14 bottom-3 rounded-lg w-10 h-10 ${isListening ? "text-destructive animate-pulse" : "text-muted-foreground hover:text-foreground"}`}
                onClick={handleMicClick}
                disabled={isStreaming || sessionEnded}
                data-testid="button-mic"
                title={isListening ? "Listening..." : "Speak your answer"}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>
              <Button 
                size="icon" 
                className="absolute right-3 bottom-3 rounded-lg w-10 h-10 shadow-sm"
                onClick={handleSendMessage}
                disabled={!input.trim() || isStreaming || sessionEnded}
                data-testid="button-send"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <div className="max-w-3xl mx-auto mt-2 text-center">
              {sessionEnded ? (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setLocation(`/feedback/${sessionId}`)}
                  className="text-xs gap-1"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  View Full Feedback Report
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">Practice space — say anything here.</span>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
