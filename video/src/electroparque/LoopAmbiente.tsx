import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { LogoCard, VoltBackground } from "./Brand";
import { clamp } from "./common";
import { ProductIcon } from "./Icons";
import { C, PRODUCTS } from "./theme";

// Loop "Ambiente": fondo en bucle perfecto para TV (horizontal) o historias (vertical).
// Todo el movimiento es periódico: el último frame empalma con el primero.

const Traces: React.FC<{ w: number; h: number; phase: number }> = ({ w, h, phase }) => {
  const paths = useMemo(() => {
    const out: string[] = [];
    for (let i = 0; i < 34; i++) {
      let x = Math.round((random(`lx${i}`) * w) / 60) * 60;
      let y = Math.round((random(`ly${i}`) * h) / 60) * 60;
      let d = `M ${x} ${y}`;
      for (let k = 0; k < 4; k++) {
        const len = 120 + random(`ll${i}-${k}`) * 260;
        if (k % 2 === 0) x += (random(`lh${i}-${k}`) > 0.5 ? 1 : -1) * len;
        else y += (random(`lv${i}-${k}`) > 0.5 ? 1 : -1) * len;
        d += ` L ${x.toFixed(0)} ${y.toFixed(0)}`;
      }
      out.push(d);
    }
    return out;
  }, [w, h]);
  return (
    <svg width={w} height={h} style={{ position: "absolute" }}>
      {paths.map((d, i) => (
        <g key={i}>
          <path d={d} stroke="rgba(59,143,224,0.22)" strokeWidth={3} fill="none" />
          <path
            d={d}
            pathLength={1}
            stroke={i % 6 === 0 ? C.red : C.cyan}
            strokeWidth={5}
            strokeLinecap="round"
            fill="none"
            strokeDasharray="0.06 0.94"
            // vueltas enteras por ciclo => bucle perfecto
            strokeDashoffset={-(phase * (1 + (i % 3)) + random(`lo${i}`))}
            style={{ filter: `drop-shadow(0 0 6px ${C.electric})` }}
          />
        </g>
      ))}
    </svg>
  );
};

export const LoopAmbiente: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const portrait = height > width;
  const phase = frame / durationInFrames; // 0 → 1 por ciclo
  const ang = phase * Math.PI * 2;

  const cardW = portrait ? 820 : 860;
  const rx = portrait ? 400 : 780;
  const ry = 330;
  const cx = width / 2;
  const cy = height / 2;

  // brillo del logo dos veces por ciclo
  const cycle = durationInFrames / 2;
  const shine = interpolate(frame % cycle, [40, 80], [0, 1], clamp);
  const breathe = 0.85 + 0.15 * Math.sin(ang * 3);

  const icons = PRODUCTS.map((p, i) => {
    const a = ang + (i * Math.PI) / 2;
    if (!portrait) {
      // órbita horizontal, siempre por fuera del logo
      return { p, x: Math.cos(a) * rx, y: Math.sin(a) * ry, depth: Math.sin(a), fade: 1 };
    }
    // en vertical el logo ocupa casi todo el ancho: los íconos giran por arriba y por abajo
    // y se desvanecen al cruzar por los costados para nunca taparlo
    const sa = Math.sin(a);
    const y = Math.sign(sa) * (330 + Math.abs(sa) * 360);
    const fade = interpolate(Math.abs(sa), [0.12, 0.4], [0, 1], clamp);
    return { p, x: Math.cos(a) * rx, y, depth: -Math.abs(Math.cos(a)) + 0.5, fade };
  });

  const renderIcon = (it: (typeof icons)[number]) => {
    const s = 0.75 + 0.25 * (it.depth + 1) * 0.5 + 0.1;
    const size = portrait ? 210 : 190;
    return (
      <div
        key={it.p.name}
        style={{
          position: "absolute",
          left: cx + it.x - size / 2,
          top: cy + it.y - size / 2,
          width: size,
          height: size,
          borderRadius: "50%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          background: "radial-gradient(circle, rgba(27,26,160,0.9) 0%, rgba(11,16,51,0.85) 70%)",
          border: `3px solid rgba(124,196,255,${0.4 + 0.4 * (it.depth + 1) * 0.5})`,
          boxShadow: `0 0 40px rgba(59,143,224,0.6)`,
          transform: `scale(${s})`,
          opacity: (0.45 + 0.55 * (it.depth + 1) * 0.5) * it.fade,
        }}
      >
        <ProductIcon icon={it.p.icon} size={size * 0.62} glow />
      </div>
    );
  };

  const particles = Array.from({ length: 40 }).map((_, i) => {
    const speed = 1 + (i % 3);
    const y = (((random(`py${i}`) - phase * speed) % 1) + 1) % 1;
    return (
      <div
        key={i}
        style={{
          position: "absolute",
          left: random(`px${i}`) * width,
          top: y * height,
          width: 4 + (i % 3) * 2,
          height: 4 + (i % 3) * 2,
          borderRadius: "50%",
          background: i % 7 === 0 ? C.red : C.cyan,
          opacity: 0.5,
          boxShadow: `0 0 10px ${C.electric}`,
        }}
      />
    );
  });

  return (
    <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 50%, #142060 0%, #070b24 60%, #020309 100%)", overflow: "hidden" }}>
      <Traces w={width} h={height} phase={phase} />
      {particles}
      <VoltBackground opacity={0.2 + 0.04 * Math.sin(ang)} width={portrait ? 1050 : 1800} y={portrait ? -560 : 0} drift={false} blur={1} />
      {icons.filter((it) => it.depth <= 0).map(renderIcon)}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ transform: `translateY(${Math.sin(ang * 2) * 8}px)` }}>
          <LogoCard width={cardW} shine={shine} glow={breathe} />
        </div>
      </AbsoluteFill>
      {icons.filter((it) => it.depth > 0).map(renderIcon)}
    </AbsoluteFill>
  );
};
