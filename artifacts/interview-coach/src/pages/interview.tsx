import { useState, useEffect, useRef, useCallback } from "react";
import { streamInterviewReply } from "@/services/ai";
import { useRoute, useLocation, Link } from "wouter";
import { useGetInterviewSession, getGetInterviewSessionQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Send, CheckCircle2, Bot, Volume2, VolumeX, Mic, MicOff, Timer } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import Avatar from "@/components/Avatar";

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

function speak(text: string, onStart?: () => void, onEnd?: () => void) {
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v =>
    v.name.includes("Google US English") ||
    v.name.includes("Samantha") ||
    v.name.includes("Microsoft")
  );
  if (preferred) utterance.voice = preferred;
  if (onStart) utterance.onstart = onStart;
  if (onEnd) utterance.onend = onEnd;
  window.speechSynthesis.speak(utterance);
}

function speakAttenborough(text: string, onStart?: () => void, onEnd?: () => void) {
  window.speechSynthesis.cancel();

  const base = new SpeechSynthesisUtterance();
  base.lang = "en-GB";
  base.rate = 0.82;
  base.pitch = 0.85;

  const voices = window.speechSynthesis.getVoices();
  const attenboroughish =
    voices.find(v =>
      v.name.includes("UK English Male") ||
      v.name.includes("Daniel") ||
      v.name.includes("Microsoft George") ||
      v.name.includes("Brian")
    );

  if (attenboroughish) base.voice = attenboroughish;

  const segments = text.match(/[^.!?]+[.!?]+/g) || [text];
  segments.forEach((line, i) => {
    const u = new SpeechSynthesisUtterance(line.trim());
    Object.assign(u, base);
    if (i === 0 && onStart) u.onstart = onStart;
    if (i === segments.length - 1 && onEnd) u.onend = onEnd;
    setTimeout(() => window.speechSynthesis.speak(u), i * 1100);
  });
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

const TIMER_OPTIONS = [15, 30, 60, 0] as const;
type TimerDuration = typeof TIMER_OPTIONS[number];

const SESSION_OPTIONS = [15, 30, 45, 60] as const;

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function Interview() {
  const [, params] = useRoute("/interview/:sessionId");
  const sessionId = params?.sessionId ? parseInt(params.sessionId, 10) : 0;
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: session, isLoading, error } = useGetInterviewSession(sessionId, {
    query: { enabled: !!sessionId, queryKey: getGetInterviewSessionQueryKey(sessionId) }
  });

  const [input, setInput] = useState("");
  const [localMessages, setLocalMessages] = useState<LocalMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [isNarration, setIsNarration] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [avatarFeedback, setAvatarFeedback] = useState<"good" | "needs improvement" | undefined>();

  const [timerDuration, setTimerDuration] = useState<TimerDuration>(15);
  const [timeLeft, setTimeLeft] = useState(15);
  const [isTimerActive, setIsTimerActive] = useState(false);

  const [interviewDuration, setInterviewDuration] = useState(30); // minutes
  const [totalTimeLeft, setTotalTimeLeft] = useState(30 * 60); // seconds
  const [isInterviewActive, setIsInterviewActive] = useState(false);

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
  
  // Sync remote messages
  useEffect(() => {
    if (session?.messages) {
      setLocalMessages(session.messages.map(m => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content
      })));
    }
  }, [session?.messages]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages, streamingContent, isStreaming]);

  // Speak last assistant message when it arrives
  useEffect(() => {
    if (localMessages.length === 0) return;
    const lastMessage = localMessages[localMessages.length - 1];
    if (lastMessage.role === "assistant" && speechEnabled) {
      isNarration
        ? speakAttenborough(lastMessage.content, () => setIsSpeaking(true), () => setIsSpeaking(false))
        : speak(lastMessage.content, () => setIsSpeaking(true), () => setIsSpeaking(false));
    }
  }, [localMessages, speechEnabled, isNarration]);

  // Session timer countdown
  useEffect(() => {
    if (!isInterviewActive) return;

    if (totalTimeLeft === 0) {
      setIsInterviewActive(false);

      const loadFeedback = async () => {
        try {
          const res = await fetch(`/api/interview/sessions/${sessionId}/feedback`);
          const data = await res.json();

          const content = `Interview complete.

Strengths:
${(data.strengths as string[]).map(s => `- ${s}`).join("\n")}

Areas to improve:
${(data.areasForImprovement as string[]).map(a => `- ${a}`).join("\n")}`;

          setLocalMessages(prev => [
            ...prev,
            {
              id: `system-end-${Date.now()}`,
              role: "assistant" as const,
              content,
              isSystem: true,
            }
          ]);
        } catch {
          setLocalMessages(prev => [
            ...prev,
            {
              id: `system-end-${Date.now()}`,
              role: "assistant" as const,
              content: "Interview complete. Great job!",
              isSystem: true,
            }
          ]);
        }
      };

      loadFeedback();
      return;
    }

    const interval = setTimeout(() => {
      setTotalTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearTimeout(interval);
  }, [totalTimeLeft, isInterviewActive]);

  // Start timer when the last message is from the assistant
  useEffect(() => {
    if (!isInterviewActive) return;
    if (localMessages.length === 0) return;
    if (timerDuration === 0) return;

    const lastMessage = localMessages[localMessages.length - 1];
    if (lastMessage.role === "assistant" && !lastMessage.isSystem) {
      setTimeLeft(timerDuration);
      setIsTimerActive(true);
    }
  }, [localMessages, isInterviewActive]);

  // Pause timer while streaming
  useEffect(() => {
    if (isStreaming) setIsTimerActive(false);
  }, [isStreaming]);

  const handleSendMessage = useCallback(async () => {
    if (!input.trim() || isStreaming) return;

    setIsTimerActive(false);
    setTimeLeft(timerDuration);

    const userMessageContent = input.trim();
    setInput("");
    window.speechSynthesis.cancel();

    const tempId = Date.now().toString();
    setLocalMessages(prev => [...prev, { id: `user-${tempId}`, role: "user", content: userMessageContent }]);
    
    setIsStreaming(true);
    setStreamingContent("");

    try {
      const messagesForApi = [
        ...localMessages,
        { id: `user-${tempId}`, role: "user" as const, content: userMessageContent },
      ].map(({ role, content }) => ({ role, content }));

      const assistantContent = await streamInterviewReply(
        sessionId,
        session?.jobContext ?? undefined,
        messagesForApi,
        (text) => setStreamingContent(text),
        totalTimeLeft,
      );

      setLocalMessages(prev => [...prev, { id: `assistant-${tempId}`, role: "assistant", content: assistantContent }]);
      setIsStreaming(false);
      setStreamingContent("");

      const lower = assistantContent.toLowerCase();
      const isGood = ["great answer", "excellent", "well said", "strong answer", "good answer", "well done", "impressive", "nicely", "perfect", "solid"].some(k => lower.includes(k));
      const needsWork = ["could improve", "needs improvement", "consider", "try to", "work on", "be more specific", "lacks", "missing", "not quite"].some(k => lower.includes(k));
      setTimeout(() => {
        setAvatarFeedback(isGood ? "good" : needsWork ? "needs improvement" : undefined);
      }, 500);
      queryClient.invalidateQueries({ queryKey: getGetInterviewSessionQueryKey(sessionId) });

    } catch (err) {
      console.error(err);
      setIsStreaming(false);
      setStreamingContent("");
    }
  }, [input, isStreaming, localMessages, sessionId, session?.jobContext, timerDuration, queryClient]);

  // Countdown tick — setTimeout pattern: each render captures a fresh closure, no ref needed
  useEffect(() => {
    if (!isTimerActive) return;

    if (timeLeft === 0) {
      setIsTimerActive(false);
      if (input.trim()) {
        handleSendMessage();
      } else {
        setLocalMessages(prev => [
          ...prev,
          {
            id: `timeout-${Date.now()}`,
            role: "assistant",
            content: "Time's up — in real interviews, quick thinking matters. Let's try the next one.",
            isSystem: true,
          },
        ]);
      }
      return;
    }

    const timer = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, isTimerActive]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleTimerDurationChange = (d: TimerDuration) => {
    setTimerDuration(d);
    setIsTimerActive(false);
    setTimeLeft(d);
  };

  const handleInterviewDurationChange = (mins: number) => {
    setInterviewDuration(mins);
    setTotalTimeLeft(mins * 60);
  };

  function startInterview(minutes: number) {
    setInterviewDuration(minutes);
    setTotalTimeLeft(minutes * 60);
    setIsInterviewActive(true);
  }

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
        <Button onClick={() => setLocation("/")}>Go back to Roles</Button>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-background relative">
      {/* Duration selection overlay */}
      {!isInterviewActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="duration-select">
            <h3>Select Interview Length</h3>
            <button onClick={() => startInterview(30)}>
              30 Minutes
            </button>
            <button onClick={() => startInterview(60)}>
              1 Hour
            </button>
          </div>
        </div>
      )}
      {/* Header */}
      <header className="border-b border-border bg-card shrink-0 flex items-center justify-between px-4 md:px-6 py-4 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild className="rounded-full">
            <Link href="/" data-testid="link-back-roles">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div>
            <h1 className="font-serif font-bold text-lg leading-none" data-testid="text-role-name">
              {session.jobRoleName}
            </h1>
            {isInterviewActive && (
              <div className={`interview-timer ${totalTimeLeft < 300 ? "warning" : ""}`}>
                🕒 {formatTime(totalTimeLeft)}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Session duration selector */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Timer className="w-3.5 h-3.5" />
            {SESSION_OPTIONS.map(m => (
              <button
                key={m}
                onClick={() => handleInterviewDurationChange(m)}
                className={`px-2 py-0.5 rounded-md font-medium transition-colors ${interviewDuration === m ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                data-testid={`session-option-${m}`}
              >
                {m}m
              </button>
            ))}
          </div>

          {/* Per-question timer selector */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Timer className="w-3 h-3 opacity-60" />
            {TIMER_OPTIONS.map(d => (
              <button
                key={d}
                onClick={() => handleTimerDurationChange(d)}
                className={`px-2 py-0.5 rounded-md font-medium transition-colors ${timerDuration === d ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                data-testid={`timer-option-${d}`}
              >
                {d === 0 ? "Off" : `${d}s`}
              </button>
            ))}
          </div>

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
            Get Feedback
          </Button>
        </div>
      </header>

      {/* Interview Screen */}
      <div className="interview-screen">
        <Avatar isSpeaking={isSpeaking} feedback={avatarFeedback} />

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
      </div>

      {/* Input Area */}
      <div className="p-4 md:p-6 bg-card/80 backdrop-blur-md border-t border-border shrink-0">
        <div className="max-w-3xl mx-auto relative flex items-end gap-3">
          {isTimerActive && timerDuration > 0 && (
            <div className={`timer ${timeLeft <= 5 ? "warning" : ""}`}>
              ⏳ {timeLeft}s
            </div>
          )}
          <Textarea 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isStreaming ? "Wait for the coach to finish..."
              : isListening ? "Listening..."
              : "Type or speak your response... (Enter to send)"
            }
            className="min-h-[60px] max-h-[200px] resize-none pr-24 rounded-xl border-input bg-background shadow-sm focus-visible:ring-1 focus-visible:ring-primary text-base"
            disabled={isStreaming || isListening}
            data-testid="input-chat"
            rows={2}
          />
          <Button
            size="icon"
            variant="ghost"
            className={`absolute right-14 bottom-3 rounded-lg w-10 h-10 ${isListening ? "text-destructive animate-pulse" : "text-muted-foreground hover:text-foreground"}`}
            onClick={handleMicClick}
            disabled={isStreaming}
            data-testid="button-mic"
            title={isListening ? "Listening..." : "Speak your answer"}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </Button>
          <Button 
            size="icon" 
            className="absolute right-3 bottom-3 rounded-lg w-10 h-10 shadow-sm"
            onClick={handleSendMessage}
            disabled={!input.trim() || isStreaming}
            data-testid="button-send"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <div className="max-w-3xl mx-auto mt-2 text-center">
          <span className="text-xs text-muted-foreground">This is a practice space. You can say anything here.</span>
        </div>
      </div>
    </div>
  );
}
