import avatarImg from "@assets/Screenshot_2026-04-02_at_8.00.01_PM_1775183091610.png";

type Feedback = "good" | "needs improvement" | "thinking";

interface AvatarProps {
  isSpeaking: boolean;
  feedback?: Feedback;
}

export default function Avatar({ isSpeaking, feedback }: AvatarProps) {
  return (
    <div className="avatar-container">
      <div className={`avatar-wrapper ${isSpeaking ? "speaking" : ""} ${feedback === "good" ? "good" : ""}`}>
        <img
          src={avatarImg}
          alt="AI Interviewer"
          className="avatar-photo"
        />
        <div className={`avatar-mouth ${isSpeaking ? "talking" : ""}`} />
      </div>
    </div>
  );
}
