import { useEffect, useRef, useState } from "react";

type Feedback = "good" | "needs improvement" | "thinking";

interface TalkingAvatarProps {
  isSpeaking: boolean;
  feedback?: Feedback;
}

type MouthShape = "closed" | "small" | "medium" | "wide" | "round";

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

  // --- Speaking Loop ---
  useEffect(() => {
    if (!isSpeaking) {
      if (cssLoopRef.current) clearInterval(cssLoopRef.current);
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
    }, 160); 

    return () => {
      if (cssLoopRef.current) clearInterval(cssLoopRef.current);
    };
  }, [isSpeaking]);

  // --- Boundary/Emphasis Listeners ---
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

  // --- Blinking Animation ---
  useEffect(() => {
    const scheduleBlink = () => {
      const delay = 2500 + Math.random() * 4000;
      blinkTimerRef.current = setTimeout(() => {
        setBlinkState(true);
        setTimeout(() => {
          setBlinkState(false);
          // 20% chance for a double blink
          if (Math.random() > 0.8) {
             setTimeout(() => {
                 setBlinkState(true);
                 setTimeout(() => {
                     setBlinkState(false);
                     scheduleBlink();
                 }, 120);
             }, 100);
          } else {
             scheduleBlink();
          }
        }, 120);
      }, delay);
    };
    scheduleBlink();
    return () => {
      if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current);
    };
  }, []);

  // --- Eye Tracking Animation ---
  useEffect(() => {
    const scheduleEyeMove = () => {
      const delay = 1800 + Math.random() * 2500;
      eyeTimerRef.current = setTimeout(() => {
        const maxX = isSpeaking ? 3.0 : 1.5;
        const maxY = isSpeaking ? 2.0 : 1.0;
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

  // --- Breathing Animation ---
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

  // --- Nodding Animation ---
  useEffect(() => {
    if (!isSpeaking) {
      if (nodTimerRef.current) clearTimeout(nodTimerRef.current);
      setNodAngle(0);
      return;
    }
    const doNod = () => {
      const delay = 1200 + Math.random() * 2000;
      nodTimerRef.current = setTimeout(() => {
        setNodAngle(-1.5); 
        setTimeout(() => {
          setNodAngle(1.0); 
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

  // --- Derived Values ---
  const breathY = Math.sin(breathPhase * 0.05) * 2.5;
  const breathScale = 1 + Math.sin(breathPhase * 0.05) * 0.002;
  const eyeScaleY = blinkState ? 0.05 : 1;

  // --- Dynamic Mouth Engine ---
  const getMouthPaths = (shape: MouthShape, isGood: boolean) => {
    const s = isGood ? -7 : -3.5; // Slight default smile, lifts more when "good"
    
    // Core Coordinates
    const cx = 200;
    const cy = 288; // Shifted up slightly for better proportions
    
    switch (shape) {
      case "closed":
        return {
          inner: "", // Closed, no inner mouth
          teeth: "",
          upperLip: `M160 ${cy+s} Q200 ${cy-10} 240 ${cy+s} Q200 ${cy-1} 160 ${cy+s} Z`,
          lowerLip: `M160 ${cy+s} Q200 ${cy+14} 240 ${cy+s} Q200 ${cy+2} 160 ${cy+s} Z`,
          centerLine: `M160 ${cy+s} Q200 ${cy+5} 240 ${cy+s}`
        };
      case "small":
        return {
          inner: `M165 ${cy-2+s} Q200 ${cy-6} 235 ${cy-2+s} Q200 ${cy+8} 165 ${cy-2+s} Z`,
          teeth: `M168 ${cy-2+s} Q200 ${cy-5} 232 ${cy-2+s} L230 ${cy} Q200 ${cy+2} 170 ${cy} Z`,
          upperLip: `M165 ${cy-2+s} Q200 ${cy-14} 235 ${cy-2+s} Q200 ${cy-6} 165 ${cy-2+s} Z`,
          lowerLip: `M165 ${cy-2+s} Q200 ${cy+16} 235 ${cy-2+s} Q200 ${cy+8} 165 ${cy-2+s} Z`,
          centerLine: ""
        };
      case "medium":
        return {
          inner: `M160 ${cy-2+s} Q200 ${cy-8} 240 ${cy-2+s} Q200 ${cy+15} 160 ${cy-2+s} Z`,
          teeth: `M163 ${cy-2+s} Q200 ${cy-7} 237 ${cy-2+s} L233 ${cy+1} Q200 ${cy+4} 167 ${cy+1} Z`,
          upperLip: `M160 ${cy-2+s} Q200 ${cy-16} 240 ${cy-2+s} Q200 ${cy-8} 160 ${cy-2+s} Z`,
          lowerLip: `M160 ${cy-2+s} Q200 ${cy+22} 240 ${cy-2+s} Q200 ${cy+15} 160 ${cy-2+s} Z`,
          centerLine: ""
        };
      case "wide":
        return {
          inner: `M155 ${cy+s} Q200 ${cy-10} 245 ${cy+s} Q200 ${cy+22} 155 ${cy+s} Z`,
          teeth: `M158 ${cy+s} Q200 ${cy-8} 242 ${cy+s} L238 ${cy+3} Q200 ${cy+6} 162 ${cy+3} Z`,
          upperLip: `M155 ${cy+s} Q200 ${cy-18} 245 ${cy+s} Q200 ${cy-10} 155 ${cy+s} Z`,
          lowerLip: `M155 ${cy+s} Q200 ${cy+30} 245 ${cy+s} Q200 ${cy+22} 155 ${cy+s} Z`,
          centerLine: ""
        };
      case "round":
        return {
          inner: `M175 ${cy+4+s} Q200 ${cy-8} 225 ${cy+4+s} Q200 ${cy+20} 175 ${cy+4+s} Z`,
          teeth: `M178 ${cy+3+s} Q200 ${cy-5} 222 ${cy+3+s} L220 ${cy+2} Q200 ${cy+4} 180 ${cy+2} Z`,
          upperLip: `M175 ${cy+4+s} Q200 ${cy-16} 225 ${cy+4+s} Q200 ${cy-8} 175 ${cy+4+s} Z`,
          lowerLip: `M175 ${cy+4+s} Q200 ${cy+28} 225 ${cy+4+s} Q200 ${cy+20} 175 ${cy+4+s} Z`,
          centerLine: ""
        };
    }
  };

  const isGood = feedback === "good";
  const m = getMouthPaths(mouthShape, isGood);
  
  // Theming
  const borderColor = isGood ? "#22c55e" : isSpeaking ? "#0ea5e9" : "#334155";
  const glowColor = isGood ? "rgba(34,197,94,0.30)" : isSpeaking ? "rgba(14,165,233,0.25)" : "transparent";
  const glowSpread = isSpeaking || isGood ? "8px" : "0px";

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 320 }}>
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "3 / 4",
          borderRadius: 14,
          overflow: "hidden",
          border: `2px solid ${borderColor}`,
          boxShadow: `0 0 0 ${glowSpread} ${glowColor}, 0 8px 40px rgba(0,0,0,0.6)`,
          transition: "border-color 0.3s, box-shadow 0.4s",
          background: "linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)", 
        }}
      >
        <svg
          viewBox="0 0 400 500"
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: "100%", height: "100%", display: "block" }}
        >
          <defs>
            {/* Soft Drop Shadow for 3D depth */}
            <filter id="drop-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#000" floodOpacity="0.35"/>
            </filter>
            
            <filter id="soft-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#000" floodOpacity="0.2"/>
            </filter>

            {/* Skin Shading */}
            <radialGradient id="skin-base" cx="50%" cy="45%" r="55%">
              <stop offset="0%" stopColor="#ffd8c2" />
              <stop offset="60%" stopColor="#f3bba0" />
              <stop offset="100%" stopColor="#db8f72" />
            </radialGradient>
            
            {/* Cheek Blush */}
            <radialGradient id="blush" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ff7b65" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#ff7b65" stopOpacity="0" />
            </radialGradient>

            {/* Hair Gradients */}
            <linearGradient id="hair-base" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#4A1E0E" />
              <stop offset="40%" stopColor="#8A3E1B" />
              <stop offset="100%" stopColor="#2E1106" />
            </linearGradient>

            <linearGradient id="hair-highlight" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#C96836" stopOpacity="0.8"/>
              <stop offset="100%" stopColor="#C96836" stopOpacity="0"/>
            </linearGradient>

            {/* Eye Gradients */}
            <radialGradient id="iris" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#7a3411" />
              <stop offset="70%" stopColor="#3d1502" />
              <stop offset="100%" stopColor="#1a0700" />
            </radialGradient>

            {/* Lips Gradients */}
            <linearGradient id="upper-lip" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e87869" />
              <stop offset="100%" stopColor="#c75040" />
            </linearGradient>
            
            <linearGradient id="lower-lip" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#de5d4e" />
              <stop offset="100%" stopColor="#eba096" />
            </linearGradient>

            {/* Suit & Shirt */}
            <linearGradient id="suit-base" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b3e42" />
              <stop offset="100%" stopColor="#1a1c1f" />
            </linearGradient>
            <linearGradient id="shirt-base" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#d1d5db" />
            </linearGradient>
          </defs>

          {/* Master Breathing Container */}
          <g transform={`translate(0, ${breathY}) scale(${breathScale})`} style={{ transformOrigin: "200px 500px" }}>
            
            {/* ================================================== */}
            {/* 1. BACK HAIR LAYER                                 */}
            {/* ================================================== */}
            <path 
              d="M100 150 C30 220 20 380 70 480 C110 500 150 480 200 480 C250 480 290 500 330 480 C380 380 370 220 300 150 Z" 
              fill="url(#hair-base)" 
              filter="url(#drop-shadow)"
            />

            {/* ================================================== */}
            {/* 2. BODY / SUIT LAYER                               */}
            {/* ================================================== */}
            {/* Main Jacket Shoulders */}
            <path d="M40 500 L60 380 Q100 340 200 340 Q300 340 340 380 L360 500 Z" fill="url(#suit-base)" filter="url(#drop-shadow)"/>
            
            {/* White Shirt Collar Base */}
            <path d="M140 350 L200 420 L260 350 L200 340 Z" fill="url(#shirt-base)"/>
            
            {/* Left Collar Point */}
            <path d="M135 345 L185 410 L180 345 Z" fill="#ffffff" filter="url(#soft-shadow)"/>
            
            {/* Right Collar Point */}
            <path d="M265 345 L215 410 L220 345 Z" fill="#ffffff" filter="url(#soft-shadow)"/>
            
            {/* Suit Lapels */}
            <path d="M100 365 L170 480 L80 500 Z" fill="#2d3033" filter="url(#soft-shadow)"/>
            <path d="M300 365 L230 480 L320 500 Z" fill="#2d3033" filter="url(#soft-shadow)"/>

            {/* ================================================== */}
            {/* 3. HEAD & FACE GROUP (Handles Nodding)             */}
            {/* ================================================== */}
            <g transform={`rotate(${nodAngle}, 200, 260)`} style={{ transition: "transform 0.1s ease-out" }}>
              
              {/* Neck & Neck Shadow */}
              <path d="M165 290 L165 360 Q200 370 235 360 L235 290 Z" fill="#db8f72"/>
              <path d="M165 290 L165 320 Q200 340 235 320 L235 290 Z" fill="#b06447" opacity="0.6"/>

              {/* Ears */}
              <path d="M115 220 C100 220 100 260 120 265" fill="url(#skin-base)"/>
              <path d="M285 220 C300 220 300 260 280 265" fill="url(#skin-base)"/>

              {/* Main Face Shape */}
              <path 
                d="M125 210 C125 310 160 340 200 340 C240 340 275 310 275 210 C275 140 240 120 200 120 C160 120 125 140 125 210 Z" 
                fill="url(#skin-base)"
                filter="url(#drop-shadow)"
              />
              
              {/* Inner Face 3D Shading (Edges) */}
              <path 
                d="M125 210 C125 310 160 340 200 340 L200 330 C165 330 135 300 135 210 C135 150 160 130 200 130 L200 120 C160 120 125 140 125 210 Z" 
                fill="#b06447" opacity="0.3"
              />
              <path 
                d="M275 210 C275 310 240 340 200 340 L200 330 C235 330 265 300 265 210 C265 150 240 130 200 130 L200 120 C240 120 275 140 275 210 Z" 
                fill="#b06447" opacity="0.15"
              />

              {/* Blush */}
              <ellipse cx="155" cy="245" rx="22" ry="14" fill="url(#blush)" />
              <ellipse cx="245" cy="245" rx="22" ry="14" fill="url(#blush)" />

              {/* --- EYES --- */}
              <g transform={`scale(1, ${eyeScaleY})`} style={{ transformOrigin: "200px 215px", transition: "transform 0.08s ease" }}>
                
                {/* Left Eye Whites */}
                <path d="M140 220 Q160 200 176 220 Q160 232 140 220 Z" fill="#ffffff" filter="url(#soft-shadow)"/>
                
                {/* Left Eye Tracking Group */}
                <g clipPath="url(#left-eye-clip)">
                  <clipPath id="left-eye-clip">
                    <path d="M140 220 Q160 200 176 220 Q160 232 140 220 Z" />
                  </clipPath>
                  <g transform={`translate(${eyeOffset.x}, ${eyeOffset.y})`}>
                    <circle cx="158" cy="216" r="12" fill="url(#iris)"/>
                    <circle cx="158" cy="216" r="6" fill="#0d0400"/>
                    <circle cx="153" cy="211" r="3.5" fill="#ffffff" opacity="0.9"/>
                    <circle cx="163" cy="221" r="1.5" fill="#ffffff" opacity="0.7"/>
                  </g>
                </g>

                {/* Right Eye Whites */}
                <path d="M224 220 Q240 200 260 220 Q240 232 224 220 Z" fill="#ffffff" filter="url(#soft-shadow)"/>
                
                {/* Right Eye Tracking Group */}
                <g clipPath="url(#right-eye-clip)">
                  <clipPath id="right-eye-clip">
                    <path d="M224 220 Q240 200 260 220 Q240 232 224 220 Z" />
                  </clipPath>
                  <g transform={`translate(${eyeOffset.x}, ${eyeOffset.y})`}>
                    <circle cx="242" cy="216" r="12" fill="url(#iris)"/>
                    <circle cx="242" cy="216" r="6" fill="#0d0400"/>
                    <circle cx="237" cy="211" r="3.5" fill="#ffffff" opacity="0.9"/>
                    <circle cx="247" cy="221" r="1.5" fill="#ffffff" opacity="0.7"/>
                  </g>
                </g>

                {/* Eyelashes / Upper Lids */}
                <path d="M136 222 Q160 196 180 222" fill="none" stroke="#2b1104" strokeWidth="4.5" strokeLinecap="round"/>
                <path d="M136 222 Q130 215 125 210" fill="none" stroke="#2b1104" strokeWidth="3.5" strokeLinecap="round"/>
                
                <path d="M220 222 Q240 196 264 222" fill="none" stroke="#2b1104" strokeWidth="4.5" strokeLinecap="round"/>
                <path d="M264 222 Q270 215 275 210" fill="none" stroke="#2b1104" strokeWidth="3.5" strokeLinecap="round"/>
              </g>

              {/* Eyebrows */}
              <path d="M130 190 Q150 175 175 185" fill="none" stroke="#361a0b" strokeWidth="6" strokeLinecap="round"/>
              <path d="M270 190 Q250 175 225 185" fill="none" stroke="#361a0b" strokeWidth="6" strokeLinecap="round"/>

              {/* Nose */}
              <path d="M190 255 Q200 262 210 255 Q200 266 190 255 Z" fill="#cf7c5b" opacity="0.6"/>
              <path d="M200 230 L200 250" fill="none" stroke="#ffffff" strokeWidth="4" opacity="0.25" strokeLinecap="round" />
              <circle cx="200" cy="254" r="4" fill="#ffffff" opacity="0.35" />

              {/* Freckles */}
              <g fill="#9e4c2f" opacity="0.6">
                <circle cx="180" cy="255" r="1.2" /> <circle cx="185" cy="260" r="1.5" />
                <circle cx="175" cy="262" r="1" />   <circle cx="190" cy="265" r="1.2" />
                <circle cx="220" cy="255" r="1.2" /> <circle cx="215" cy="260" r="1.5" />
                <circle cx="225" cy="262" r="1" />   <circle cx="210" cy="265" r="1.2" />
                <circle cx="160" cy="255" r="1" />   <circle cx="240" cy="255" r="1" />
                <circle cx="150" cy="258" r="1.5" /> <circle cx="250" cy="258" r="1.5" />
              </g>

              {/* --- MOUTH ENGINE --- */}
              <g filter="url(#soft-shadow)">
                {/* Inner Mouth / Cavity */}
                {m.inner && <path d={m.inner} fill="#330b0b" />}
                
                {/* Teeth */}
                {m.teeth && <path d={m.teeth} fill="#f8f8f8" />}
                
                {/* Upper Lip */}
                <path d={m.upperLip} fill="url(#upper-lip)" />
                
                {/* Lower Lip */}
                <path d={m.lowerLip} fill="url(#lower-lip)" />
                
                {/* Center Line for Closed State */}
                {m.centerLine && (
                  <path d={m.centerLine} fill="none" stroke="#a13325" strokeWidth="2.5" strokeLinecap="round" />
                )}
              </g>

              {/* ================================================== */}
              {/* 4. FRONT HAIR LAYER (Sweops over face & shoulders) */}
              {/* ================================================== */}
              
              {/* Right Side Sweep (Viewer's Left) - Giant voluminous wave */}
              <path 
                d="M230 100 C150 90 70 140 65 240 C60 340 100 370 70 470 C50 520 120 500 150 450 C180 390 110 340 120 270 C130 190 170 140 230 130 Z" 
                fill="url(#hair-base)" 
                filter="url(#drop-shadow)"
              />

              {/* Left Side Tuck (Viewer's Right) - Tucked behind ear slightly */}
              <path 
                d="M230 100 C290 95 335 140 335 220 C335 290 300 310 320 400 C330 450 340 480 300 490 C260 500 270 440 280 390 C290 330 280 290 280 250 C280 200 260 150 230 130 Z" 
                fill="url(#hair-base)" 
                filter="url(#drop-shadow)"
              />

              {/* Hair Highlights (Glossy 3D shine) */}
              <path d="M125 160 C100 200 105 260 120 300" fill="none" stroke="url(#hair-highlight)" strokeWidth="6" strokeLinecap="round" opacity="0.8"/>
              <path d="M285 160 C305 200 300 260 280 300" fill="none" stroke="url(#hair-highlight)" strokeWidth="6" strokeLinecap="round" opacity="0.8"/>
              <path d="M90 360 C75 400 80 440 115 460" fill="none" stroke="url(#hair-highlight)" strokeWidth="8" strokeLinecap="round" opacity="0.7"/>
              <path d="M305 350 C325 380 320 420 290 460" fill="none" stroke="url(#hair-highlight)" strokeWidth="7" strokeLinecap="round" opacity="0.6"/>

            </g>
          </g>

          {/* Bottom Gradient overlay for UI readability */}
          <rect x="0" y="420" width="400" height="80" fill="url(#ui-grad)"/>
          <linearGradient id="ui-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.8)" />
          </linearGradient>
        </svg>

        {/* UI Overlay */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: "16px 14px 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ color: "white", fontSize: 13, fontWeight: 600, letterSpacing: "0.01em", textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>
            Sarah · AI Interviewer
          </span>
          {isSpeaking && (
            <span style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              color: "#38bdf8",
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em"
            }}>
              <span style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#38bdf8",
                animation: "avatar-speaking-dot 0.9s ease-in-out infinite",
                display: "inline-block",
              }} />
              Speaking
            </span>
          )}
        </div>
      </div>

      <style>{`
        @keyframes avatar-speaking-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.7); }
        }
      `}</style>
    </div>
  );
}