import React, { useMemo } from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { LogoImage } from "../Brand";
import { C, FONT } from "../theme";
import { ChannelScreen } from "../V1Encendido";
import { makeTraces } from "../V2Broadcast";

// Imágenes fijas que se usan como texturas en las escenas 3D.
// Se generan con `npm run textures` y quedan en public/r3d/.

export const ScreenSlide: React.FC<{ slide: number }> = ({ slide }) => {
  const { fps } = useVideoConfig();
  if (slide < 0) {
    return (
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, #ffffff 45%, #dbe5f6 100%)", justifyContent: "center", alignItems: "center" }}>
        <LogoImage width={800} />
      </AbsoluteFill>
    );
  }
  return <ChannelScreen index={slide} t={60} fps={fps} />;
};

const Glyph: React.FC<{ kind: number }> = ({ kind }) => {
  const s = { stroke: "#fff", strokeWidth: 7, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (kind === 0) return <path d="M38 70 L38 30 L70 24 L70 64 M38 70 a9 9 0 1 1 -1 -1 M70 64 a9 9 0 1 1 -1 -1" {...s} />;
  if (kind === 1) return <path d="M32 28 C32 60 44 72 72 72 L72 60 L60 54 L54 60 C46 56 42 52 40 44 L46 38 L40 26 Z" {...s} />;
  if (kind === 2) return <path d="M50 76 C36 58 30 50 30 40 a20 20 0 0 1 40 0 C70 50 64 58 50 76 Z M50 40 m-6 0 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0" {...s} />;
  if (kind === 3) return <path d="M26 32 L74 32 L74 62 L46 62 L34 72 L34 62 L26 62 Z" {...s} />;
  if (kind === 4) return <path d="M30 50 a20 20 0 1 0 40 0 a20 20 0 1 0 -40 0 M50 38 L50 50 L58 56" {...s} />;
  return <path d="M28 66 L28 40 M42 66 L42 30 M56 66 L56 46 M70 66 L70 36" {...s} />;
};

export const CarUi: React.FC = () => {
  const tiles = ["#E53225", "#2BB673", "#3B8FE0", "#34C759", "#F5A623", "#8E5CF0"];
  return (
    <AbsoluteFill style={{ background: "linear-gradient(160deg, #1a1d29 0%, #08090e 100%)", fontFamily: FONT, flexDirection: "row" }}>
      <div style={{ width: 120, background: "rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 30, gap: 30 }}>
        <div style={{ color: "#fff", fontWeight: 700, fontSize: 34 }}>12:30</div>
        {[0, 2, 1].map((k) => (
          <svg key={k} width={70} height={70} viewBox="0 0 100 100" style={{ background: tiles[k], borderRadius: 18 }}>
            <Glyph kind={k} />
          </svg>
        ))}
      </div>
      <div style={{ flex: 1, display: "flex", padding: 40, gap: 36 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 150px)", gap: 34, alignContent: "center" }}>
          {tiles.map((c, i) => (
            <svg key={i} width={150} height={150} viewBox="0 0 100 100" style={{ background: c, borderRadius: 34, boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}>
              <Glyph kind={i} />
            </svg>
          ))}
        </div>
        <div style={{ flex: 1, borderRadius: 30, overflow: "hidden", background: "#22314a", position: "relative" }}>
          <svg width="100%" height="100%" viewBox="0 0 500 420" preserveAspectRatio="xMidYMid slice">
            <rect width={500} height={420} fill="#1d2a40" />
            <path d="M-20 300 C120 260 200 330 520 200" stroke="#3a4d6e" strokeWidth={30} fill="none" />
            <path d="M120 -20 C160 140 120 300 220 440" stroke="#3a4d6e" strokeWidth={22} fill="none" />
            <path d="M-20 120 L520 160" stroke="#2f405c" strokeWidth={16} />
            <path d="M140 400 C150 300 160 240 260 230 C360 220 400 180 430 120" stroke={C.electric} strokeWidth={12} fill="none" strokeLinecap="round" />
            <circle cx={430} cy={120} r={16} fill={C.red} />
            <circle cx={140} cy={396} r={14} fill="#fff" stroke={C.electric} strokeWidth={6} />
          </svg>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Textura de placa de circuito (pistas doradas sobre fondo oscuro)
export const PcbTexture: React.FC = () => {
  const traces = useMemo(() => makeTraces(160, 2048), []);
  return (
    <AbsoluteFill style={{ background: "#0b0f14" }}>
      <svg width={2048} height={2048}>
        {traces.map((t, i) => (
          <g key={i}>
            <path d={t.d} stroke={i % 3 === 0 ? "#c9a24a" : "#7d8a99"} strokeWidth={i % 3 === 0 ? 6 : 4} fill="none" opacity={0.85} />
            <circle cx={t.end[0]} cy={t.end[1]} r={9} fill="#c9a24a" />
          </g>
        ))}
      </svg>
    </AbsoluteFill>
  );
};
