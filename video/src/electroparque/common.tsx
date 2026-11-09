import React from "react";
import { AbsoluteFill, interpolate, random } from "remotion";

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// Pulso 0→1→0 alrededor de `at`
export const bump = (frame: number, at: number, rise = 4, fall = 6) =>
  interpolate(frame, [at - rise, at, at + fall], [0, 1, 0], clamp);

// Ruido de TV (estática)
export const TvStatic: React.FC<{ frame: number; opacity?: number }> = ({ frame, opacity = 1 }) => (
  <AbsoluteFill style={{ opacity }}>
    <svg width="100%" height="100%">
      <filter id={`noise-${frame}`}>
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={Math.floor(random(frame) * 1000)} />
        <feColorMatrix type="saturate" values="0" />
        <feComponentTransfer>
          <feFuncA type="linear" slope={1} />
        </feComponentTransfer>
      </filter>
      <rect width="100%" height="100%" fill="#777" />
      <rect width="100%" height="100%" filter={`url(#noise-${frame})`} />
    </svg>
    <AbsoluteFill
      style={{
        background: "repeating-linear-gradient(0deg, rgba(0,0,0,0.25) 0px, rgba(0,0,0,0.25) 2px, transparent 2px, transparent 5px)",
      }}
    />
  </AbsoluteFill>
);

// Destello de lente horizontal
export const Flare: React.FC<{ x: number; y: number; intensity: number; color?: string }> = ({
  x,
  y,
  intensity,
  color = "124,196,255",
}) => (
  <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "screen", opacity: intensity }}>
    <div
      style={{
        position: "absolute",
        left: x - 1100,
        top: y - 10,
        width: 2200,
        height: 20,
        borderRadius: 10,
        background: `radial-gradient(ellipse at center, rgba(255,255,255,1) 0%, rgba(${color},0.8) 25%, rgba(${color},0) 70%)`,
        filter: "blur(4px)",
      }}
    />
    <div
      style={{
        position: "absolute",
        left: x - 260,
        top: y - 260,
        width: 520,
        height: 520,
        borderRadius: "50%",
        background: `radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(${color},0.5) 25%, rgba(${color},0) 65%)`,
      }}
    />
  </AbsoluteFill>
);
