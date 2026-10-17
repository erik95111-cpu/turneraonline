import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { LOGO_RATIO, LogoImage, VoltBackground } from "./Brand";
import { clamp } from "./common";
import { ProductIcon } from "./Icons";
import { C, FONT, PRODUCTS } from "./theme";

// Video 3 — "Energía": circuitos que se cargan, un rayo (guiño a VOLT),
// cortes rápidos por producto y el logo dentro del círculo blanco.

const STRIKE = 60;
const TEXT_START = 66;
const PROD_START = 122;
const PROD_LEN = 32;
const CONVERGE = PROD_START + PROD_LEN * PRODUCTS.length; // 250
const LOGO_START = 266;

const CX = 960;
const CY = 540;

// ---------- Circuitos hacia el centro ----------
const makePaths = () => {
  const paths: string[] = [];
  const n = 18;
  for (let i = 0; i < n; i++) {
    const side = i % 4;
    const r = random(`e${i}`);
    let x = side === 0 ? -20 : side === 1 ? 1940 : 200 + r * 1520;
    let y = side === 2 ? -20 : side === 3 ? 1100 : 100 + r * 880;
    let d = `M ${x.toFixed(0)} ${y.toFixed(0)}`;
    // dos tramos ortogonales y un tramo final hacia el anillo central
    const ang = Math.atan2(y - CY, x - CX);
    const ex = CX + Math.cos(ang) * 110;
    const ey = CY + Math.sin(ang) * 110;
    const mid = 0.35 + random(`m${i}`) * 0.3;
    if (side < 2) {
      const mx = x + (ex - x) * mid;
      d += ` L ${mx.toFixed(0)} ${y.toFixed(0)} L ${mx.toFixed(0)} ${ey.toFixed(0)}`;
    } else {
      const my = y + (ey - y) * mid;
      d += ` L ${x.toFixed(0)} ${my.toFixed(0)} L ${ex.toFixed(0)} ${my.toFixed(0)}`;
    }
    d += ` L ${ex.toFixed(0)} ${ey.toFixed(0)}`;
    x = ex;
    y = ey;
    paths.push(d);
  }
  return paths;
};

const Circuits: React.FC<{ frame: number }> = ({ frame }) => {
  const paths = useMemo(makePaths, []);
  const core = interpolate(frame, [10, STRIKE], [0, 1], clamp);
  return (
    <svg width={1920} height={1080} style={{ position: "absolute" }}>
      <g style={{ filter: `drop-shadow(0 0 10px ${C.electric})` }}>
        {paths.map((d, i) => {
          const p = interpolate(frame, [i * 1.5, i * 1.5 + 34], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) });
          return (
            <g key={i}>
              <path d={d} pathLength={1} stroke={i % 5 === 0 ? C.red : C.electric} strokeWidth={5} fill="none" strokeDasharray="1 1" strokeDashoffset={1 - p} />
              <path
                d={d}
                pathLength={1}
                stroke="#fff"
                strokeWidth={9}
                strokeLinecap="round"
                fill="none"
                strokeDasharray="0.04 0.96"
                strokeDashoffset={-((frame * 0.03 + random(`s${i}`)) % 1)}
                opacity={p}
              />
            </g>
          );
        })}
      </g>
      <circle cx={CX} cy={CY} r={110} fill="none" stroke={C.cyan} strokeWidth={6} opacity={core} style={{ filter: `drop-shadow(0 0 20px ${C.electric})` }} />
      <circle cx={CX} cy={CY} r={40 + core * 50} fill={C.electric} opacity={core * 0.5} style={{ filter: "blur(18px)" }} />
    </svg>
  );
};

const Bolt: React.FC<{ scale: number; opacity: number }> = ({ scale, opacity }) => (
  <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity }}>
    <svg width={420} height={620} viewBox="0 0 140 200" style={{ transform: `scale(${scale})`, filter: `drop-shadow(0 0 30px ${C.electric}) drop-shadow(0 0 8px #fff)` }}>
      <path d="M92 0 L20 112 L66 112 L44 200 L122 76 L74 76 Z" fill="#fff" stroke={C.cyan} strokeWidth={4} strokeLinejoin="round" />
    </svg>
  </AbsoluteFill>
);

// ---------- Texto de impacto ----------
const KineticText: React.FC<{ t: number; fps: number }> = ({ t, fps }) => {
  const a = spring({ frame: t - 4, fps, config: { damping: 9, stiffness: 200 } });
  const b = spring({ frame: t - 18, fps, config: { damping: 9, stiffness: 200 } });
  const shake = (t > 4 && t < 12) || (t > 18 && t < 26) ? Math.sin(t * 9) * 10 : 0;
  const pulse = 1 + Math.sin(t / 3) * 0.06;
  return (
    <AbsoluteFill style={{ fontFamily: FONT, justifyContent: "center", alignItems: "center", transform: `translate(${shake}px, ${shake * 0.6}px)` }}>
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 50%, rgba(59,143,224,0.55) 0%, rgba(27,26,160,0.35) 40%, rgba(5,8,23,0) 75%)` }} />
      <div style={{ position: "absolute", left: 150, top: 380, color: C.red, fontWeight: 900, fontSize: 300, lineHeight: 1, transform: `scale(${a * pulse})`, textShadow: `0 0 40px ${C.red}` }}>+</div>
      <div style={{ position: "absolute", right: 170, top: 380, color: C.white, fontWeight: 900, fontSize: 300, lineHeight: 1, transform: `scale(${b * pulse})`, textShadow: `0 0 40px ${C.electric}` }}>−</div>
      <div style={{ textAlign: "center", color: C.white }}>
        <div style={{ fontWeight: 900, fontStyle: "italic", fontSize: 130, lineHeight: 1, transform: `scale(${interpolate(a, [0, 1], [2.2, 1])})`, opacity: Math.min(1, a * 2) }}>
          EL MUNDO
        </div>
        <div
          style={{
            fontWeight: 900,
            fontStyle: "italic",
            fontSize: 92,
            lineHeight: 1.1,
            marginTop: 10,
            color: C.cyan,
            textShadow: `0 0 30px ${C.electric}`,
            transform: `scale(${interpolate(b, [0, 1], [2.2, 1])})`,
            opacity: Math.min(1, b * 2),
          }}
        >
          DE LA ELECTRÓNICA
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------- Cortes por producto ----------
const BGS = [
  `linear-gradient(135deg, ${C.indigo} 0%, ${C.navy} 100%)`,
  `linear-gradient(135deg, ${C.red} 0%, #8E140C 100%)`,
  `linear-gradient(135deg, #0B1033 0%, #123a7a 100%)`,
  `linear-gradient(135deg, ${C.electric} 0%, ${C.indigo} 100%)`,
];

const ProductCut: React.FC<{ index: number; t: number; fps: number }> = ({ index, t, fps }) => {
  const product = PRODUCTS[index];
  const wipe = interpolate(t, [0, 7], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const icon = spring({ frame: t - 2, fps, config: { damping: 12, stiffness: 150 } });
  const txt = spring({ frame: t - 5, fps, config: { damping: 14, stiffness: 150 } });
  const drift = t * 1.5;
  const edge = interpolate(t, [0, PROD_LEN], [0, 1]);
  // barrido diagonal de entrada
  const k = wipe * 140;
  return (
    <AbsoluteFill style={{ clipPath: `polygon(0 0, ${k}% 0, ${k - 40}% 100%, 0 100%)`, background: BGS[index], fontFamily: FONT }}>
      <VoltBackground opacity={0.12} width={1800} drift={false} />
      <div style={{ position: "absolute", left: 120 - drift, top: 230, transform: `translateX(${(1 - icon) * -500}px) rotate(${(1 - icon) * -25}deg)` }}>
        <ProductIcon icon={product.icon} size={560} glow />
      </div>
      <div style={{ position: "absolute", left: 790 + drift, top: 360, transform: `translateX(${(1 - txt) * 600}px)`, opacity: txt }}>
        <div style={{ color: "rgba(255,255,255,0.75)", fontWeight: 800, fontSize: 40, letterSpacing: 8 }}>0{index + 1} / 04</div>
        <div style={{ color: C.white, fontWeight: 900, fontStyle: "italic", fontSize: product.name.length > 12 ? 110 : 140, lineHeight: 1, textShadow: "0 10px 40px rgba(0,0,0,0.35)" }}>
          {product.name}
        </div>
      </div>
      {/* Líneas eléctricas en los bordes */}
      <div style={{ position: "absolute", top: 40, left: 0, height: 6, width: `${edge * 100}%`, background: C.white, boxShadow: `0 0 18px ${C.cyan}` }} />
      <div style={{ position: "absolute", bottom: 40, right: 0, height: 6, width: `${edge * 100}%`, background: C.white, boxShadow: `0 0 18px ${C.cyan}` }} />
    </AbsoluteFill>
  );
};

// Los cuatro íconos convergen al centro
const Converge: React.FC<{ t: number }> = ({ t }) => {
  const p = interpolate(t, [0, 16], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const starts = [
    [-560, -280],
    [560, -280],
    [-560, 280],
    [560, 280],
  ];
  return (
    <AbsoluteFill>
      {PRODUCTS.map((pr, i) => (
        <div
          key={pr.name}
          style={{
            position: "absolute",
            left: CX - 110 + starts[i][0] * (1 - p),
            top: CY - 110 + starts[i][1] * (1 - p),
            transform: `scale(${1 - p * 0.9})`,
            opacity: 1 - p * 0.5,
          }}
        >
          <ProductIcon icon={pr.icon} size={220} glow />
        </div>
      ))}
    </AbsoluteFill>
  );
};

// ---------- Logo en círculo ----------
const LogoReveal: React.FC<{ t: number; fps: number }> = ({ t, fps }) => {
  const R = 400;
  const cy = 470;
  const grow = spring({ frame: t, fps, config: { damping: 11, stiffness: 90 } });
  const wipe = interpolate(t, [16, 40], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const logoW = 680;
  const logoH = logoW * LOGO_RATIO;
  const text = spring({ frame: t - 40, fps, config: { damping: 16 } });
  const sparkX = CX - logoW / 2 + wipe * logoW;
  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      {/* anillo eléctrico */}
      <svg width={1920} height={1080} style={{ position: "absolute" }}>
        <g transform={`rotate(${t * 1.5} ${CX} ${cy})`} opacity={grow}>
          <circle cx={CX} cy={cy} r={R * grow + 30} fill="none" stroke={C.electric} strokeWidth={8} strokeDasharray="60 26" style={{ filter: `drop-shadow(0 0 14px ${C.electric})` }} />
        </g>
        <g transform={`rotate(${-t * 0.8} ${CX} ${cy})`} opacity={grow}>
          <circle cx={CX} cy={cy} r={R * grow + 52} fill="none" stroke={C.red} strokeWidth={4} strokeDasharray="8 40" />
        </g>
      </svg>
      <div
        style={{
          position: "absolute",
          left: CX - R,
          top: cy - R,
          width: R * 2,
          height: R * 2,
          borderRadius: "50%",
          background: C.white,
          transform: `scale(${grow})`,
          boxShadow: `0 0 80px rgba(59,143,224,0.8)`,
        }}
      />
      <div style={{ position: "absolute", left: CX - logoW / 2, top: cy - logoH / 2, clipPath: `inset(0 ${(1 - wipe) * 100}% 0 0)` }}>
        <LogoImage width={logoW} shine={interpolate(t, [50, 76], [0, 1], clamp)} />
      </div>
      {wipe > 0 && wipe < 1 ? (
        <div
          style={{
            position: "absolute",
            left: sparkX - 40,
            top: cy - logoH / 2 - 30,
            width: 80,
            height: logoH + 60,
            background: `radial-gradient(ellipse, #ffffff 0%, ${C.cyan} 30%, rgba(59,143,224,0) 70%)`,
            filter: "blur(2px)",
          }}
        />
      ) : null}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 950,
          textAlign: "center",
          color: C.white,
          fontWeight: 800,
          fontSize: 36,
          letterSpacing: 2,
          opacity: text,
          transform: `translateY(${(1 - text) * 20}px)`,
        }}
      >
        {PRODUCTS.map((p, i) => (
          <span key={p.name}>
            {i > 0 ? <span style={{ color: C.red, margin: "0 18px" }}>+</span> : null}
            {p.name}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
};

export const V3Energia: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const flash = interpolate(frame, [STRIKE, STRIKE + 2, STRIKE + 12], [0, 1, 0], clamp);
  const bolt = spring({ frame: frame - (STRIKE - 6), fps, config: { damping: 8, stiffness: 220 } });
  const boltOut = interpolate(frame, [STRIKE + 4, TEXT_START + 2], [1, 0], clamp);
  const logoFlash = interpolate(frame, [LOGO_START - 4, LOGO_START, LOGO_START + 10], [0, 0.9, 0], clamp);

  let scene: React.ReactNode = null;
  if (frame < TEXT_START) {
    scene = (
      <>
        <Circuits frame={frame} />
        {frame >= STRIKE - 6 ? <Bolt scale={bolt} opacity={boltOut} /> : null}
      </>
    );
  } else if (frame < PROD_START) {
    scene = <KineticText t={frame - TEXT_START} fps={fps} />;
  } else if (frame < CONVERGE) {
    const i = Math.floor((frame - PROD_START) / PROD_LEN);
    const t = frame - PROD_START - i * PROD_LEN;
    // el corte anterior queda debajo mientras entra el siguiente
    scene = (
      <>
        {i > 0 ? <ProductCut index={i - 1} t={PROD_LEN} fps={fps} /> : null}
        <ProductCut index={i} t={t} fps={fps} />
      </>
    );
  } else if (frame < LOGO_START) {
    scene = <Converge t={frame - CONVERGE} />;
  } else {
    scene = <LogoReveal t={frame - LOGO_START} fps={fps} />;
  }

  return (
    <AbsoluteFill style={{ background: C.night, overflow: "hidden" }}>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 50%, #101a52 0%, #060a22 60%, #020309 100%)" }} />
      <VoltBackground opacity={interpolate(frame, [0, 40], [0.06, 0.2], clamp)} width={1900} blur={1} />
      {scene}
      <AbsoluteFill style={{ background: C.white, opacity: Math.max(flash, logoFlash) }} />
    </AbsoluteFill>
  );
};
