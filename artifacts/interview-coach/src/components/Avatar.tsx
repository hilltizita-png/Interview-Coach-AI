interface AvatarProps {
  isSpeaking: boolean;
}

export default function Avatar({ isSpeaking }: AvatarProps) {
  return (
    <div className="avatar-container">
      <img
        src="https://i.imgur.com/6VBx3io.png"
        alt="AI Interviewer"
        className={`avatar ${isSpeaking ? "speaking" : ""}`}
      />
    </div>
  );
}
