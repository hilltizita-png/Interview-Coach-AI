type Feedback = "good" | "needs improvement" | "thinking";

interface AvatarProps {
  isSpeaking: boolean;
  feedback?: Feedback;
}

const AVATAR_SRCS: Record<Feedback | "default", string> = {
  good: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f603/emoji.svg",           // 😃 replace later
  "needs improvement": "https://fonts.gstatic.com/s/e/notoemoji/latest/1f610/emoji.svg", // 😐 replace later
  thinking: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f914/emoji.svg",       // 🤔 replace later
  default: "https://i.imgur.com/6VBx3io.png",
};

export default function Avatar({ isSpeaking, feedback }: AvatarProps) {
  const src = feedback ? AVATAR_SRCS[feedback] : AVATAR_SRCS.default;

  return (
    <div className="avatar-container">
      <img
        src={src}
        alt="AI Interviewer"
        className={`avatar ${isSpeaking ? "speaking" : ""}`}
      />
    </div>
  );
}
