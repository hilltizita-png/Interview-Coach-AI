type Feedback = "good" | "needs improvement" | "thinking";

interface AvatarProps {
  isSpeaking: boolean;
  feedback?: Feedback;
}

const FEEDBACK_EMOJI: Record<Feedback, string> = {
  thinking: "🤔",
  good: "😃",
  "needs improvement": "😐",
};

export default function Avatar({ isSpeaking, feedback }: AvatarProps) {
  return (
    <div className="avatar-container">
      {feedback ? (
        <div className={`avatar avatar-emoji ${feedback === "good" ? "good" : ""} ${isSpeaking ? "speaking" : ""}`}>
          {FEEDBACK_EMOJI[feedback]}
        </div>
      ) : (
        <img
          src="https://i.imgur.com/6VBx3io.png"
          alt="AI Interviewer"
          className={`avatar ${isSpeaking ? "speaking" : ""}`}
        />
      )}
    </div>
  );
}
