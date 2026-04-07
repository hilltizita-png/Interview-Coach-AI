import { useEffect, useRef, useState } from "react";

type Feedback = "good" | "needs improvement" | "thinking";

interface TalkingAvatarProps {
  isSpeaking: boolean;
  feedback?: Feedback;
}

type MouthShape = "closed" | "small" | "medium" | "wide" | "round";

interface MouthDef {
  d: string;
  fill: string;
}

const MOUTH_DEFS: Record<MouthShape, MouthDef> = {
  closed: { d: "M 70 98 Q 80 101 90 98", fill: "none" },
  small:  { d: "M 70 97 Q 80 104 90 97",  fill: "#c0504a" },
  medium: { d: "M 67 96 Q 80 108 93 96",  fill: "#b84040" },
  wide:   { d: "M 65 95 Q 80 112 95 95",  fill: "#a03030" },
  round:  { d: "M 73 96 Q 80 110 87 96",  fill: "#b84040" },
};

const CSS_LOOP: MouthShape[] = [
  "small", "medium", "wide", "medium", "small", "round", "medium", "closed",
];

export default function TalkingAvatar({ isSpeaking, feedback }: TalkingAvatarProps) {
  const [mouthShape, setMouthShape] = useState<MouthShape>("closed");
  const [blinkState, setBlinkState] = useState(false);
  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 });
  const [breathPhase, setBreathPhase] = useState(0);
  const [nodAngle, setNodAngle] = useState(0);

  const cssLoopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const blinkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eyeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const breathTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nodTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shapeIdxRef = useRef(0);
  const hasBoundaryRef = useRef(false);

  useEffect(() => {
    if (!isSpeaking) {
      if (cssLoopRef.current) {
        clearInterval(cssLoopRef.current);
        cssLoopRef.current = null;
      }
      hasBoundaryRef.current = false;
      setMouthShape("closed");
      return;
    }

    shapeIdxRef.current = 0;
    hasBoundaryRef.current = false;

    cssLoopRef.current = setInterval(() => {
      if (!hasBoundaryRef.current) {
        shapeIdxRef.current = (shapeIdxRef.current + 1) % CSS_LOOP.length;
        setMouthShape(CSS_LOOP[shapeIdxRef.current]);
      }
    }, 185);

    return () => {
      if (cssLoopRef.current) {
        clearInterval(cssLoopRef.current);
        cssLoopRef.current = null;
      }
    };
  }, [isSpeaking]);

  useEffect(() => {
    const onBoundary = () => {
      if (!isSpeaking) return;
      hasBoundaryRef.current = true;
      const shapes: MouthShape[] = ["wide", "medium", "round", "wide"];
      const pick = shapes[Math.floor(Math.random() * shapes.length)];
      setMouthShape(pick);
      setTimeout(() => {
        setMouthShape("small");
        setTimeout(() => { hasBoundaryRef.current = false; }, 80);
      }, 110);
    };

    window.addEventListener("avatar:boundary", onBoundary);
    return () => window.removeEventListener("avatar:boundary", onBoundary);
  }, [isSpeaking]);

  useEffect(() => {
    const scheduleBlink = () => {
      const delay = 2500 + Math.random() * 4000;
      blinkTimerRef.current = setTimeout(() => {
        setBlinkState(true);
        setTimeout(() => {
          setBlinkState(false);
          scheduleBlink();
        }, 140);
      }, delay);
    };
    scheduleBlink();
    return () => {
      if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const scheduleEyeMove = () => {
      const delay = 1800 + Math.random() * 2500;
      eyeTimerRef.current = setTimeout(() => {
        const maxX = isSpeaking ? 2.5 : 1.8;
        const maxY = isSpeaking ? 1.8 : 1.4;
        setEyeOffset({
          x: (Math.random() - 0.5) * maxX * 2,
          y: (Math.random() - 0.5) * maxY * 2,
        });
        scheduleEyeMove();
      }, delay);
    };
    scheduleEyeMove();
    return () => {
      if (eyeTimerRef.current) clearTimeout(eyeTimerRef.current);
    };
  }, [isSpeaking]);

  useEffect(() => {
    let frame = 0;
    breathTimerRef.current = setInterval(() => {
      frame++;
      setBreathPhase(frame);
    }, 50);
    return () => {
      if (breathTimerRef.current) clearInterval(breathTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isSpeaking) {
      if (nodTimerRef.current) clearTimeout(nodTimerRef.current);
      setNodAngle(0);
      return;
    }
    const doNod = () => {
      const delay = 1200 + Math.random() * 2000;
      nodTimerRef.current = setTimeout(() => {
        setNodAngle(-4);
        setTimeout(() => {
          setNodAngle(2);
          setTimeout(() => {
            setNodAngle(0);
            doNod();
          }, 160);
        }, 180);
      }, delay);
    };
    doNod();
    return () => {
      if (nodTimerRef.current) clearTimeout(nodTimerRef.current);
    };
  }, [isSpeaking]);

  const breathY = Math.sin(breathPhase * 0.07) * 1.2;
  const breathScale = 1 + Math.sin(breathPhase * 0.07) * 0.003;

  const currentMouth = isSpeaking ? MOUTH_DEFS[mouthShape] : MOUTH_DEFS.closed;
  const eyeScaleY = blinkState ? 0.05 : 1;

  const isGood = feedback === "good";
  const borderColor = isGood
    ? "#22c55e"
    : isSpeaking
    ? "hsl(190,85%,25%)"
    : "hsl(40,20%,80%)";
  const glowSize = isSpeaking || isGood ? "6px" : "0px";
  const glowColor = isGood
    ? "rgba(34,197,94,0.30)"
    : isSpeaking
    ? "rgba(14,116,144,0.22)"
    : "transparent";

  const hairColor = "#3d2b1f";
  const suitColor = "#1c3d5a";
  const shirtColor = "#f8f8ff";
  const tieColor = "#8b1a1a";
  const eyeIrisColor = "#2d3a4a";
  const lipColor = isGood ? "#d06060" : "#b85050";

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        marginBottom: 20,
      }}
    >
      <div
        style={{
          width: 160,
          height: 160,
          borderRadius: "50%",
          overflow: "hidden",
          border: `3px solid ${borderColor}`,
          boxShadow: `0 0 0 ${glowSize} ${glowColor}, 0 4px 16px rgba(0,0,0,0.12)`,
          transition: "border-color 0.3s, box-shadow 0.4s, transform 0.3s",
          transform: `scale(${isGood ? 1.05 : 1}) translateY(${isGood ? -2 : 0}px)`,
          flexShrink: 0,
        }}
      >
        <svg
          viewBox="0 0 160 200"
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: "100%", height: "100%", display: "block" }}
        >
          <defs>
            <clipPath id="ta-clip">
              <circle cx="80" cy="80" r="80" />
            </clipPath>
            <radialGradient id="ta-bg" cx="50%" cy="30%" r="80%">
              <stop offset="0%" stopColor="#dff0fa" />
              <stop offset="100%" stopColor="#9abfdb" />
            </radialGradient>
            <radialGradient id="ta-skin" cx="48%" cy="42%" r="55%">
              <stop offset="0%" stopColor="#fde0be" />
              <stop offset="100%" stopColor="#e8b98a" />
            </radialGradient>
            <radialGradient id="ta-shine" cx="35%" cy="30%" r="40%">
              <stop offset="0%" stopColor="white" stopOpacity="0.85" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </radialGradient>
          </defs>

          <g clipPath="url(#ta-clip)">
            <rect width="160" height="200" fill="url(#ta-bg)" />

            <g transform={`translate(80, ${80 + breathY}) scale(${breathScale}) translate(-80, -80)`}>
              <g transform={`rotate(${nodAngle}, 80, 105)`} style={{ transition: "transform 0.18s ease-out" }}>

                <ellipse cx="80" cy="150" rx="52" ry="7" fill="rgba(0,0,0,0.07)" />

                <rect x="18" y="127" width="124" height="82" rx="6" fill={suitColor} />
                <polygon points="67,127 80,156 93,127 80,134" fill={shirtColor} />
                <rect x="77" y="127" width="6" height="32" fill={tieColor} />
                <polygon points="80,157 74.5,167 85.5,167" fill={tieColor} />
                <rect x="18" y="127" width="36" height="16" rx="4" fill={suitColor} />
                <rect x="106" y="127" width="36" height="16" rx="4" fill={suitColor} />

                <ellipse cx="80" cy="83" rx="30" ry="33" fill="url(#ta-skin)" />
                <ellipse cx="80" cy="79" rx="28" ry="30" fill="#f5cba7" />

                <path
                  d="M 51 71 Q 55 40 80 36 Q 105 40 109 71 Q 110 64 107 54 Q 99 36 80 34 Q 61 36 53 54 Q 50 64 51 71 Z"
                  fill={hairColor}
                />
                <path d="M 50 72 Q 48 80 50 87 Q 51 80 52 71" fill={hairColor} />
                <path d="M 110 72 Q 112 80 110 87 Q 109 80 108 71" fill={hairColor} />

                <g transform={`translate(${eyeOffset.x}, ${eyeOffset.y})`}>
                  <ellipse cx="66" cy="80" rx="7.5" ry={7.5 * eyeScaleY} fill="white" />
                  <ellipse cx="66" cy="80" rx="4.5" ry={4.5 * eyeScaleY} fill={eyeIrisColor} />
                  <ellipse cx="66" cy="80" rx="2.8" ry={2.8 * eyeScaleY} fill="#0a0e14" />
                  <ellipse cx="64.2" cy="78.2" rx="1.4" ry={1.4 * eyeScaleY} fill="url(#ta-shine)" />

                  <ellipse cx="94" cy="80" rx="7.5" ry={7.5 * eyeScaleY} fill="white" />
                  <ellipse cx="94" cy="80" rx="4.5" ry={4.5 * eyeScaleY} fill={eyeIrisColor} />
                  <ellipse cx="94" cy="80" rx="2.8" ry={2.8 * eyeScaleY} fill="#0a0e14" />
                  <ellipse cx="92.2" cy="78.2" rx="1.4" ry={1.4 * eyeScaleY} fill="url(#ta-shine)" />
                </g>

                <path d="M 59 76.5 Q 66 73.5 72 76.5" fill="none" stroke="#b08860" strokeWidth="1.3" strokeLinecap="round" />
                <path d="M 88 76.5 Q 94 73.5 101 76.5" fill="none" stroke="#b08860" strokeWidth="1.3" strokeLinecap="round" />

                <ellipse cx="67" cy="91" rx="4.5" ry="2.5" fill="#e8a080" opacity="0.38" />
                <ellipse cx="93" cy="91" rx="4.5" ry="2.5" fill="#e8a080" opacity="0.38" />

                <ellipse cx="80" cy="93.5" rx="3.2" ry="2.2" fill="#c8906a" />

                {isGood ? (
                  <>
                    <path
                      d="M 64 96 Q 80 115 96 96"
                      fill="none"
                      stroke={lipColor}
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <path d="M 63 95 Q 65 99.5 68 98.5" fill="none" stroke={lipColor} strokeWidth="1.2" strokeLinecap="round" />
                    <path d="M 97 95 Q 95 99.5 92 98.5" fill="none" stroke={lipColor} strokeWidth="1.2" strokeLinecap="round" />
                  </>
                ) : (
                  <>
                    <path
                      d={currentMouth.d}
                      fill={isSpeaking && mouthShape !== "closed" ? currentMouth.fill : "none"}
                      stroke={lipColor}
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                    {isSpeaking && mouthShape !== "closed" && (
                      <path
                        d={currentMouth.d}
                        fill="rgba(60,15,15,0.55)"
                        stroke="none"
                      />
                    )}
                  </>
                )}

              </g>
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}
