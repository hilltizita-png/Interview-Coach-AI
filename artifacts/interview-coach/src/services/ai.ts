/**
 * ai.ts — Streaming chat client
 *
 * This module provides a single function that sends a user's message to the
 * API server and streams the AI interviewer's reply back token by token.
 *
 * The API uses Server-Sent Events (SSE): the server keeps the HTTP connection
 * open and writes `data: {...}\n\n` lines as each token is generated. This file
 * reads those lines and calls `onChunk` after each one so the UI can update
 * in real time rather than waiting for the full response.
 */

/** A single turn in the conversation — either from the user or the AI. */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Streams an AI reply for a given interview session.
 *
 * @param sessionId     - The database ID of the current interview session.
 * @param context       - Optional job/resume context string sent to the API
 *                        so the AI knows what role is being interviewed for.
 * @param messages      - The full conversation history so far (user + assistant turns).
 * @param onChunk       - Callback invoked after each streamed token chunk with
 *                        the *accumulated* text so far (not just the new token).
 *                        Use this to update a "streaming" message in the UI.
 * @param timeLeft      - Optional seconds remaining in the session. Passed to the
 *                        API so the AI can start wrapping up when time is short.
 * @param questionsLeft - Optional number of questions remaining (for modes with a
 *                        question limit). Tells the AI to signal the final question.
 *
 * @returns The complete AI response as a single string once streaming is done.
 */
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

  // Read the SSE stream byte by byte using a ReadableStream reader.
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    // Decode the raw bytes into a string (may contain multiple SSE lines).
    const chunk = decoder.decode(value);

    for (const line of chunk.split("\n")) {
      // Each SSE data line starts with "data: ". Skip the sentinel [DONE] line.
      if (line.startsWith("data: ") && line !== "data: [DONE]") {
        try {
          const data = JSON.parse(line.slice(6)); // strip the "data: " prefix
          if (data.content) {
            fullText += data.content;
            onChunk(fullText); // notify the UI with the latest accumulated text
          }
        } catch (e) {
          console.error("SSE parse error", e);
        }
      }
    }
  }

  return fullText;
}
