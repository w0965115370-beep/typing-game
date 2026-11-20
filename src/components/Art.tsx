// 和風手繪插圖（原創 SVG）。墨線＋水彩色塊，再套上 #rough 濾鏡讓線條有手繪的抖動感。
import { useMemo, type CSSProperties } from "react";

const INK = "#3b3a36";
type P = { size?: number; className?: string; style?: CSSProperties };

/** 放在畫面最上層一次：手繪抖動與水彩暈染濾鏡 */
export function ArtDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
      <defs>
        <filter id="rough"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="3" /><feDisplacementMap in="SourceGraphic" scale="2.2" /></filter>
        <filter id="wash"><feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="3" seed="8" /><feDisplacementMap in="SourceGraphic" scale="6" /></filter>
      </defs>
    </svg>
  );
}

/** 嚮導阿禾：戴斗笠的小朋友 */
export function Guide({ size = 56, wink = false, ...p }: P & { wink?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} {...p} aria-label="嚮導阿禾" role="img">
      <g filter="url(#rough)" stroke={INK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 58c2-10 9-15 18-15s16 5 18 15" fill="#7d9fc4" />
        <circle cx="32" cy="34" r="14" fill="#fbe6d0" />
        <path d="M6 24c8-12 44-12 52 0c-14 3-38 3-52 0z" fill="#e6c27a" />
        <path d="M22 16c4-8 16-8 20 0" fill="#e6c27a" />
        {wink ? <path d="M24 35q3-2 6 0" fill="none" /> : <circle cx="27" cy="35" r="1.6" fill={INK} />}
        <circle cx="37" cy="35" r="1.6" fill={INK} />
        <path d="M28 41q4 3 8 0" fill="none" />
      </g>
      <circle cx="23" cy="39" r="2.6" fill="#f2a7a0" opacity=".7" />
      <circle cx="41" cy="39" r="2.6" fill="#f2a7a0" opacity=".7" />
    </svg>
  );
}

/** 毛筆畫的箭頭（向下） */
export function Arrow({ size = 64, ...p }: P) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} {...p} aria-hidden>
      <path filter="url(#rough)" d="M26 4c4-1 9-1 12 0l1 30h13c2 0 3 2 1 4L34 60c-1 1-3 1-4 0L11 38c-2-2-1-4 1-4h13z"
        fill="#ef8a5a" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d="M30 9v24" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".6" />
    </svg>
  );
}

export function Star({ on, size = 22 }: { on: boolean; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path filter="url(#rough)" d="M12 2l3 6.5 7 .8-5.2 4.8 1.5 7L12 17.6 5.7 21l1.5-7L2 9.3l7-.8z"
        fill={on ? "#f2c14e" : "#efe6d2"} stroke={on ? INK : "#b9ad94"} strokeWidth="1.6" strokeLinejoin="round"
        strokeDasharray={on ? undefined : "3 2"} />
    </svg>
  );
}

export function Lock({ size = 30 }: P) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden>
      <g filter="url(#rough)" stroke={INK} strokeWidth="2" strokeLinejoin="round">
        <path d="M10 15v-4a6 6 0 0 1 12 0v4" fill="none" />
        <rect x="6" y="14" width="20" height="14" rx="3" fill="#d9c7a3" />
        <circle cx="16" cy="21" r="2" fill={INK} />
      </g>
    </svg>
  );
}

/** 紅色印章「過」 */
export function Stamp({ size = 44, text = "過" }: P & { text?: string }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className="stamp" aria-label="已過關">
      <g opacity=".9">
        <circle cx="24" cy="24" r="20" fill="rgba(255,255,255,.6)" stroke="#c8402f" strokeWidth="3.5" filter="url(#rough)" />
        <text x="24" y={text.length > 1 ? 29 : 32} textAnchor="middle" fontSize={text.length > 1 ? 15 : 24} fontWeight="bold" fill="#c8402f" fontFamily="'LXGW WenKai TC', serif">{text}</text>
      </g>
    </svg>
  );
}

/** 工具列小圖示 */
export function Icon({ name, size = 30 }: { name: "scroll" | "fan" | "brush" | "help"; size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden>
      <g filter="url(#rough)" stroke={INK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {name === "scroll" && <>
          <rect x="7" y="5" width="18" height="22" fill="#f6efdc" />
          <path d="M5 5h22M5 27h22" strokeWidth="3" stroke="#8a5a3b" />
          <path d="M11 11h10M11 16h7M11 21h9" />
        </>}
        {name === "fan" && <>
          <path d="M16 28L3 12a18 18 0 0 1 26 0z" fill="#e9a6a6" />
          <path d="M16 28L10 8M16 28V6M16 28l6-20" />
        </>}
        {name === "brush" && <>
          <path d="M22 4l6 6-12 12-6-6z" fill="#c9a26b" />
          <path d="M10 16l6 6c-2 5-7 7-12 6c-1-5 1-10 6-12z" fill={INK} />
        </>}
        {name === "help" && <>
          <circle cx="16" cy="16" r="13" fill="#f2c14e" />
          <path d="M12 12a4 4 0 1 1 6 3c-2 1-2 2-2 4" fill="none" strokeWidth="2.6" />
          <circle cx="16" cy="24" r="1.4" fill={INK} />
        </>}
      </g>
    </svg>
  );
}

/** 每一區的水彩風景橫幅：草原（山丘與太陽）、森林（竹林）、天空（雲與遠山） */
export function ZoneScene({ zone }: { zone: number }) {
  return (
    <svg className="zone-scene" viewBox="0 0 600 90" preserveAspectRatio="xMidYMax slice" aria-hidden>
      {zone === 0 && <g filter="url(#wash)">
        <circle cx="520" cy="30" r="20" fill="#f4a261" opacity=".55" />
        <path d="M0 70q90-40 190-10t200-5 210 5v30H0z" fill="#a7c58a" opacity=".7" />
        <path d="M0 80q120-25 260-5t340-10v25H0z" fill="#7fa865" opacity=".7" />
      </g>}
      {zone === 1 && <g filter="url(#wash)">
        {[30, 70, 120, 420, 470, 540, 575].map((x, i) => <g key={x} opacity={0.45 + (i % 3) * 0.15}>
          <rect x={x} y={10 + (i % 3) * 8} width="9" height="90" fill="#5f8a5a" />
          <path d={`M${x} ${30 + i * 4}h9M${x} ${55 + i * 3}h9`} stroke="#3e6340" strokeWidth="2" />
          <path d={`M${x + 9} ${28 + i * 4}q16-6 24 2`} fill="none" stroke="#5f8a5a" strokeWidth="4" />
        </g>)}
        <path d="M0 82q150-18 300-4t300-6v20H0z" fill="#6d9562" opacity=".6" />
      </g>}
      {zone === 2 && <g filter="url(#wash)">
        <path d="M330 90l90-70 40 25 30-12 110 57z" fill="#9db4cf" opacity=".6" />
        <path d="M410 28l10-8 18 12-10 2z" fill="#fff" opacity=".8" />
        {[[80, 35], [220, 22], [520, 60]].map(([x, y]) => <path key={x} d={`M${x} ${y}q10-14 26-4q14-12 28 2q14 0 12 12H${x - 6}q-10-2-6-10z`} fill="#fff" opacity=".85" />)}
      </g>}
    </svg>
  );
}

/** 過關時飄落的櫻花瓣 */
export function Petals({ count }: { count: number }) {
  const petals = useMemo(() => Array.from({ length: count }, (_, i) => ({
    left: Math.random() * 100, delay: Math.random() * 1.8, dur: 3.2 + Math.random() * 2.5,
    size: 14 + Math.random() * 14, rot: Math.random() * 360, color: ["#f6c1c7", "#f3a9b3", "#fbd9dc"][i % 3],
  })), [count]);
  return (
    <div className="petals" aria-hidden>
      {petals.map((p, i) => (
        <svg key={i} className="petal" viewBox="0 0 20 20" width={p.size} height={p.size}
          style={{ left: `${p.left}%`, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`, rotate: `${p.rot}deg` }}>
          <path d="M10 2c4 3 7 8 3 15c-1-1-2-2-3-2s-2 1-3 2C3 10 6 5 10 2z" fill={p.color} stroke="#d98a96" strokeWidth=".8" />
        </svg>
      ))}
    </div>
  );
}
