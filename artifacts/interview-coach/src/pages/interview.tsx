import { useState, useEffect, useRef, useCallback } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useGetInterviewSession, getGetInterviewSessionQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Send, CheckCircle2, Bot, Volume2, VolumeX } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";

interface LocalMessage {
  id: number | string;
  role: "user" | "assistant";
  content: string;
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

  const speak = useCallback((text: string) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  }, []);

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
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

  const handleSendMessage = async () => {
    if (!input.trim() || isStreaming) return;

    const userMessageContent = input.trim();
    setInput("");
    window.speechSynthesis.cancel();

    // Optimistically add user message
    const tempId = Date.now().toString();
    setLocalMessages(prev => [...prev, { id: `user-${tempId}`, role: "user", content: userMessageContent }]);
    
    setIsStreaming(true);
    setStreamingContent("");

    try {
      const response = await fetch(`/api/interview/sessions/${sessionId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: userMessageContent }),
      });

      if (!response.ok) throw new Error("Failed to send message");
      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                assistantContent += data.content;
                setStreamingContent(assistantContent);
              }
            } catch (e) {
              console.error("Error parsing SSE JSON", e);
            }
          }
        }
      }

      // Once done, add the final assistant message and clear streaming state
      setLocalMessages(prev => [...prev, { id: `assistant-${tempId}`, role: "assistant", content: assistantContent }]);
      setIsStreaming(false);
      setStreamingContent("");

      if (speechEnabled && assistantContent) {
        speak(assistantContent);
      }
      
      // Invalidate the session query to grab the real DB IDs
      queryClient.invalidateQueries({ queryKey: getGetInterviewSessionQueryKey(sessionId) });

    } catch (err) {
      console.error(err);
      setIsStreaming(false);
      setStreamingContent("");
    }
  };

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
        <Button onClick={() => setLocation("/")}>Go back to Roles</Button>
      </div>
    );
  }

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
            <h1 className="font-serif font-bold text-lg leading-none" data-testid="text-role-name">
              {session.jobRoleName}
            </h1>
            <span className="text-xs text-muted-foreground">Practice Session</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
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

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto px-4 py-8 md:p-8 scroll-smooth">
        <div className="max-w-3xl mx-auto space-y-8 pb-4">
          
          {/* Welcome Message */}
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

          {/* Streaming Message */}
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

      {/* Input Area */}
      <div className="p-4 md:p-6 bg-card/80 backdrop-blur-md border-t border-border shrink-0">
        <div className="max-w-3xl mx-auto relative flex items-end gap-3">
          <Textarea 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isStreaming ? "Wait for the coach to finish..." : "Type your response... (Press Enter to send)"}
            className="min-h-[60px] max-h-[200px] resize-none pr-12 rounded-xl border-input bg-background shadow-sm focus-visible:ring-1 focus-visible:ring-primary text-base"
            disabled={isStreaming}
            data-testid="input-chat"
            rows={2}
          />
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