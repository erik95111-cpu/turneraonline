import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { LogoCard, VoltBackground } from "./Brand";
import { clamp, Flare } from "./common";
import { ProductIcon } from "./Icons";
import { C, FONT, PRODUCTS } from "./theme";

// Video 2 — "Broadcast": estilo presentación de noticiero, como la referencia.
// Placa de circuito luminosa en perspectiva, anillos metálicos, productos
// en pedestal y cierre con destello y piso reflejante.

const INTRO_END = 96;
const SHOT_LEN = 44;
const FINAL = INTRO_END + SHOT_LEN * PRODUCTS.length; // 272

// ---------- Placa de circuito ----------
type Trace = { d: string; end: [number, number] };

export const makeTraces = (count: number, size: number): Trace[] => {
  const dirs = [
    [1, 0], [0, 1], [-1, 0], [0, -1], [0.7071, 0.7071], [-0.7071, 0.7071], [0.7071, -0.7071], [-0.7071, -0.7071],
  ];
  const traces: Trace[] = [];
  for (let i = 0; i < count; i++) {
    let x = Math.round((random(`x${i}`) * size) / 40) * 40;
    let y = Math.round((random(`y${i}`) * size) / 40) * 40;
    let d = `M ${x} ${y}`;
    const segs = 3 + Math.floor(random(`s${i}`) * 3);
    let dir = Math.floor(random(`d${i}`) * 4);
    for (let k = 0; k < segs; k++) {
      const len = 80 + random(`l${i}-${k}`) * 240;
      x += dirs[dir][0] * len;
      y += dirs[dir][1] * len;
      d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
      // alterna entre recto y diagonal
      dir = dir < 4 ? 4 + Math.floor(random(`n${i}-${k}`) * 4) : Math.floor(random(`n${i}-${k}`) * 4);
    }
    traces.push({ d, end: [x, y] });
  }
  return traces;
};

const PcbPlane: React.FC<{ progress: number; frame: number; opacity?: number }> = ({ progress, frame, opacity = 1 }) => {
  const size = 2600;
  const traces = useMemo(() => makeTraces(110, size), []);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ opacity }}>
      <defs>
        <pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse">
          <path d="M 80 0 L 0 0 0 80" fill="none" stroke="rgba(59,143,224,0.12)" strokeWidth="2" />
        </pattern>
      </defs>
      <rect width={size} height={size} fill="url(#grid)" />
      <g style={{ filter: `drop-shadow(0 0 8px ${C.electric})` }}>
        {traces.map((t, i) => {
          const local = interpolate(progress, [(i % 20) / 40, (i % 20) / 40 + 0.5], [0, 1], clamp);
          return (
            <g key={i}>
              <path d={t.d} pathLength={1} stroke={C.electric} strokeWidth={5} fill="none" strokeDasharray="1 1" strokeDashoffset={1 - local} strokeLinejoin="round" />
              <path
                d={t.d}
                pathLength={1}
                stroke="#E8F4FF"
                strokeWidth={7}
                fill="none"
                strokeLinecap="round"
                strokeDasharray="0.05 0.95"
                strokeDashoffset={-((frame * 0.02 + random(`p${i}`)) % 1)}
                opacity={local}
              />
              <circle cx={t.end[0]} cy={t.end[1]} r={11} fill={C.night} stroke={C.cyan} strokeWidth={5} opacity={local} />
            </g>
          );
        })}
      </g>
    </svg>
  );
};

const PcbScene: React.FC<{ frame: number; tilt?: number; opacity?: number }> = ({ frame, tilt = 62, opacity = 1 }) => (
  <AbsoluteFill style={{ perspective: 1100, perspectiveOrigin: "50% 30%", overflow: "hidden" }}>
    <div
      style={{
        position: "absolute",
        left: 960 - 1300,
        top: 540 - 1300,
        transform: `rotateX(${tilt}deg) translateY(${-frame * 4}px) rotateZ(${frame * 0.08}deg)`,
      }}
    >
      <PcbPlane progress={interpolate(frame, [0, 70], [0, 1], clamp)} frame={frame} opacity={opacity} />
    </div>
  </AbsoluteFill>
);

// ---------- Anillos metálicos ----------
const ring = (r: number, width: number, colors: string) => ({
  position: "absolute" as const,
  left: -r,
  top: -r,
  width: r * 2,
  height: r * 2,
  borderRadius: "50%",
  background: `conic-gradient(${colors})`,
  WebkitMaskImage: `radial-gradient(circle, transparent ${r - width - 1}px, black ${r - width}px, black ${r}px, transparent ${r + 1}px)`,
  maskImage: `radial-gradient(circle, transparent ${r - width - 1}px, black ${r - width}px, black ${r}px, transparent ${r + 1}px)`,
});

const METAL = "#1c2440, #dfeaff 12%, #4a5878 25%, #0d1430 40%, #9fb8e0 55%, #2a3350 70%, #ffffff 82%, #1c2440";
const BLUE = "#0d1430, #3B8FE0 20%, #0d1430 45%, #7CC4FF 70%, #0d1430";

const Rings: React.FC<{ frame: number; x: number; y: number; scale?: number; tilt?: number }> = ({ frame, x, y, scale = 1, tilt = 72 }) => {
  const rings = [
    { r: 520, w: 26, c: METAL, s: 0.5 },
    { r: 470, w: 8, c: BLUE, s: -1.1 },
    { r: 420, w: 40, c: METAL, s: 0.8 },
    { r: 350, w: 12, c: "#E53225, #3a0b08 30%, #E53225 60%, #3a0b08 85%, #E53225", s: -1.6 },
    { r: 300, w: 30, c: METAL, s: 1.3 },
    { r: 230, w: 6, c: BLUE, s: -2 },
  ];
  return (
    <div style={{ position: "absolute", left: x, top: y, perspective: 1200, transform: `scale(${scale})` }}>
      <div style={{ transform: `rotateX(${tilt}deg)`, transformStyle: "preserve-3d" }}>
        <div
          style={{
            position: "absolute",
            left: -260,
            top: -260,
            width: 520,
            height: 520,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(124,196,255,0.7) 0%, rgba(59,143,224,0.25) 40%, rgba(59,143,224,0) 70%)",
          }}
        />
        {rings.map((r, i) => (
          <div key={i} style={{ ...ring(r.r, r.w, r.c), transform: `rotateZ(${frame * r.s}deg)` }} />
        ))}
      </div>
    </div>
  );
};

// ---------- Escenas ----------
const Intro: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const words = ["EL", "MUNDO", "DE", "LA"];
  const big = spring({ frame: frame - 34, fps, config: { damping: 13 } });
  const ringsIn = spring({ frame, fps, config: { damping: 20, stiffness: 40 } });
  return (
    <AbsoluteFill>
      <PcbScene frame={frame} />
      <Rings frame={frame} x={960} y={650} scale={0.6 + 0.6 * ringsIn} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", fontFamily: FONT, color: C.white }}>
        <div style={{ display: "flex", gap: 22, fontWeight: 700, fontSize: 46, letterSpacing: 10, marginBottom: 6 }}>
          {words.map((w, i) => {
            const a = spring({ frame: frame - 14 - i * 4, fps, config: { damping: 15 } });
            return (
              <span key={w} style={{ opacity: a, transform: `translateY(${(1 - a) * 40}px)`, display: "inline-block", textShadow: "0 4px 20px rgba(0,0,0,0.8)" }}>
                {w}
              </span>
            );
          })}
        </div>
        <div
          style={{
            fontWeight: 900,
            fontSize: 150,
            letterSpacing: interpolate(big, [0, 1], [60, 4]),
            opacity: big,
            filter: `blur(${(1 - big) * 12}px)`,
            textShadow: `0 0 40px ${C.electric}, 0 6px 30px rgba(0,0,0,0.8)`,
          }}
        >
          ELECTRÓNICA
        </div>
        <div style={{ height: 10, width: 520 * big, background: C.red, borderRadius: 5, marginTop: 10, boxShadow: `0 0 20px ${C.red}` }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const ProductShot: React.FC<{ index: number; t: number; frame: number; fps: number }> = ({ index, t, frame, fps }) => {
  const product = PRODUCTS[index];
  const enter = interpolate(t, [0, 9], [1, 0], { ...clamp, easing: Easing.out(Easing.cubic) });
  const exit = interpolate(t, [SHOT_LEN - 7, SHOT_LEN], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const x = enter * 1100 - exit * 1100;
  const blur = (enter + exit) * 18;
  const pop = spring({ frame: t - 4, fps, config: { damping: 10, stiffness: 120 } });
  const bar = spring({ frame: t - 10, fps, config: { damping: 16 } });
  const bob = Math.sin(frame / 7) * 10;
  const turn = Math.cos(t / 14);
  return (
    <AbsoluteFill>
      <PcbScene frame={frame} tilt={70} opacity={0.5} />
      <AbsoluteFill style={{ transform: `translateX(${x}px)`, filter: `blur(${blur}px)` }}>
        <Rings frame={frame} x={960} y={760} scale={0.95} tilt={76} />
        <div
          style={{
            position: "absolute",
            left: 960 - 200,
            top: 230 + bob,
            transform: `scale(${pop}) scaleX(${0.75 + 0.25 * Math.abs(turn)})`,
          }}
        >
          <ProductIcon icon={product.icon} size={400} glow />
        </div>
      </AbsoluteFill>
      {/* Zócalo tipo noticiero */}
      <div
        style={{
          position: "absolute",
          left: 120,
          bottom: 110,
          display: "flex",
          alignItems: "stretch",
          fontFamily: FONT,
          transform: `translateX(${(1 - bar) * -900}px)`,
          opacity: 1 - exit,
        }}
      >
        <div style={{ background: C.red, color: C.white, fontWeight: 900, fontSize: 54, padding: "14px 28px", display: "flex", alignItems: "center" }}>
          0{index + 1}
        </div>
        <div
          style={{
            background: `linear-gradient(90deg, ${C.indigo} 0%, ${C.electric} 100%)`,
            color: C.white,
            padding: "10px 46px 12px 30px",
            boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 20, letterSpacing: 6, opacity: 0.85 }}>ELECTROPARQUE</div>
          <div style={{ fontWeight: 900, fontSize: 58, lineHeight: 1.05 }}>{product.name}</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Final: React.FC<{ t: number; fps: number }> = ({ t, fps }) => {
  const card = spring({ frame: t - 6, fps, config: { damping: 12, stiffness: 90 } });
  const rays = t * 0.4;
  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, #7e8aa3 0%, #c9d3e3 45%, #eef2f8 62%)", overflow: "hidden" }}>
      <VoltBackground opacity={0.2} width={1500} y={-250} blur={1} />
      {/* Rayos de luz */}
      <AbsoluteFill
        style={{
          background: `repeating-conic-gradient(from ${rays}deg at 50% 46%, rgba(255,255,255,0.55) 0deg 4deg, rgba(255,255,255,0) 4deg 14deg)`,
          WebkitMaskImage: "radial-gradient(circle at 50% 46%, black 0%, transparent 55%)",
          maskImage: "radial-gradient(circle at 50% 46%, black 0%, transparent 55%)",
          opacity: card,
        }}
      />
      {/* Piso reflejante */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 640, bottom: 0, perspective: 600, overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            left: -1000,
            right: -1000,
            top: 0,
            height: 1400,
            transformOrigin: "50% 0%",
            transform: "rotateX(70deg)",
            background:
              "repeating-linear-gradient(90deg, rgba(27,26,160,0.18) 0 3px, transparent 3px 160px), repeating-linear-gradient(0deg, rgba(27,26,160,0.18) 0 3px, transparent 3px 160px), linear-gradient(180deg, #dfe7f2, #aebbd0)",
          }}
        />
      </div>
      {/* Tarjeta y reflejo */}
      <AbsoluteFill style={{ alignItems: "center" }}>
        <div style={{ marginTop: 300, transform: `scale(${0.3 + 0.7 * card})`, opacity: card }}>
          <LogoCard width={900} shine={interpolate(t, [34, 62], [0, 1], clamp)} />
        </div>
        <div
          style={{
            marginTop: 26,
            transform: `scale(${0.3 + 0.7 * card}) scaleY(-1)`,
            opacity: card * 0.22,
            WebkitMaskImage: "linear-gradient(0deg, black 0%, transparent 60%)",
            maskImage: "linear-gradient(0deg, black 0%, transparent 60%)",
          }}
        >
          <LogoCard width={900} glow={0} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const V2Broadcast: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  let scene: React.ReactNode;
  if (frame < INTRO_END) {
    scene = <Intro frame={frame} fps={fps} />;
  } else if (frame < FINAL) {
    const i = Math.floor((frame - INTRO_END) / SHOT_LEN);
    scene = <ProductShot index={i} t={frame - INTRO_END - i * SHOT_LEN} frame={frame} fps={fps} />;
  } else {
    scene = <Final t={frame - FINAL} fps={fps} />;
  }

  const darkBg = frame < FINAL;
  const whiteFlash = interpolate(frame, [FINAL - 4, FINAL, FINAL + 14], [0, 1, 0], clamp);
  const introFade = interpolate(frame, [0, 12], [0, 1], clamp);
  const flare = Math.max(
    interpolate(frame, [FINAL - 6, FINAL + 2, FINAL + 30], [0, 1, 0], clamp),
    interpolate(frame, [FINAL + 34, FINAL + 46, FINAL + 64], [0, 0.6, 0], clamp),
  );

  return (
    <AbsoluteFill style={{ background: C.night, overflow: "hidden" }}>
      {darkBg ? (
        <>
          <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 35%, #142060 0%, #070b24 55%, #020309 100%)" }} />
          <VoltBackground opacity={0.22} width={1900} y={-160} blur={2} />
        </>
      ) : null}
      <AbsoluteFill style={{ opacity: introFade }}>{scene}</AbsoluteFill>
      <Flare x={960} y={interpolate(frame, [FINAL - 6, FINAL + 64], [520, 300], clamp)} intensity={flare} />
      <AbsoluteFill style={{ background: C.white, opacity: whiteFlash }} />
    </AbsoluteFill>
  );
};
