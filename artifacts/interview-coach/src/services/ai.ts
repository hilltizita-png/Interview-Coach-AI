export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function streamInterviewReply(
  sessionId: number,
  context: string | undefined,
  messages: ChatMessage[],
  onChunk: (text: string) => void,
  timeLeft?: number,
  questionsLeft?: number,
): Promise<string> {
  const response = await fetch(`/api/interview/sessions/${sessionId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ context, messages, timeLeft, questionsLeft }),
  });

  if (!response.ok) throw new Error("Failed to send message");
  if (!response.body) throw new Error("No response body");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    for (const line of chunk.split("\n")) {
      if (line.startsWith("data: ") && line !== "data: [DONE]") {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.content) {
            fullText += data.content;
            onChunk(fullText);
          }
        } catch (e) {
          console.error("SSE parse error", e);
        }
      }
    }
  }

  return fullText;
}
