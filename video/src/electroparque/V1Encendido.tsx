import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { LogoImage, VoltBackground } from "./Brand";
import { bump, clamp, TvStatic } from "./common";
import { ProductIcon } from "./Icons";
import { C, FONT, PRODUCTS } from "./theme";

// Video 1 — "Encendido": una mano con el control enciende la TV,
// cambia de canal por los productos y termina con el logo.

const TV = { x: 460, y: 150, w: 1000, h: 580, bezel: 16 };
const SCREEN = { w: TV.w - TV.bezel * 2, h: TV.h - TV.bezel * 2 };

const PRESSES = [62, 147, 178, 209, 240];
const TURN_ON = 76;
const CH_START = 150;
const CH_LEN = 31;
const FINAL = CH_START + CH_LEN * PRODUCTS.length; // 274

const SKIN = "#F1C29C";
const SKIN_SHADE = "#CF9670";

const Hand: React.FC<{ press: number; irFrames: number[] }> = ({ press, irFrames }) => {
  const tipX = interpolate(press, [0, 1], [196, 210]);
  const tipY = interpolate(press, [0, 1], [158, 120]);
  return (
    <svg width={420} height={900} viewBox="0 0 420 900" style={{ overflow: "visible" }}>
      {/* Ondas infrarrojas */}
      {irFrames.map((t, i) =>
        [0, 1, 2].map((k) => {
          const p = t - k * 3;
          if (p < 0 || p > 18) return null;
          const r = 40 + p * 32;
          const a0 = (-140 * Math.PI) / 180;
          const a1 = (-40 * Math.PI) / 180;
          const d = `M ${210 + r * Math.cos(a0)} ${40 + r * Math.sin(a0)} A ${r} ${r} 0 0 1 ${210 + r * Math.cos(a1)} ${40 + r * Math.sin(a1)}`;
          return (
            <path
              key={`${i}-${k}`}
              d={d}
              stroke={C.cyan}
              strokeWidth={10}
              strokeLinecap="round"
              fill="none"
              opacity={interpolate(p, [0, 4, 18], [0, 0.9, 0])}
              style={{ filter: `drop-shadow(0 0 10px ${C.electric})` }}
            />
          );
        }),
      )}
      {/* Manga */}
      <rect x={105} y={560} width={230} height={420} rx={34} fill={C.indigo} />
      <rect x={105} y={560} width={230} height={46} rx={20} fill="#2826C8" />
      {/* Control remoto */}
      <rect x={150} y={36} width={120} height={420} rx={52} fill="#15171F" stroke="#3A3F52" strokeWidth={4} />
      <rect x={160} y={48} width={100} height={396} rx={44} fill="none" stroke="#262A38" strokeWidth={3} />
      <circle cx={210} cy={50} r={7} fill="#4A1010" />
      <circle cx={210} cy={112} r={17} fill={C.red} style={{ filter: press > 0.3 ? `drop-shadow(0 0 ${16 * press}px ${C.red})` : undefined }} />
      <path d="M210 104 L210 113 M203 108 A10 10 0 1 0 217 108" stroke="#fff" strokeWidth={3} fill="none" strokeLinecap="round" />
      <circle cx={210} cy={205} r={36} fill="#232633" stroke="#3A3F52" strokeWidth={3} />
      <circle cx={210} cy={205} r={13} fill="#3A3F52" />
      {/* Palma y dedos */}
      <ellipse cx={220} cy={480} rx={128} ry={132} fill={SKIN} />
      <ellipse cx={250} cy={500} rx={90} ry={100} fill={SKIN_SHADE} opacity={0.35} />
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x={196 - i * 4}
          y={318 + i * 50}
          width={120}
          height={48}
          rx={24}
          fill={SKIN}
          stroke={SKIN_SHADE}
          strokeWidth={3}
        />
      ))}
      {/* Pulgar */}
      <path d={`M118 430 Q130 280 ${tipX} ${tipY}`} stroke={SKIN_SHADE} strokeWidth={60} strokeLinecap="round" fill="none" />
      <path d={`M118 430 Q130 280 ${tipX} ${tipY}`} stroke={SKIN} strokeWidth={52} strokeLinecap="round" fill="none" />
      <ellipse cx={tipX - 2} cy={tipY + 10} rx={14} ry={18} fill="#F8DCC4" />
    </svg>
  );
};

const LogoScreen: React.FC<{ t: number; fps: number }> = ({ t, fps }) => {
  const s = spring({ frame: t, fps, config: { damping: 12, stiffness: 120 } });
  return (
    <AbsoluteFill
      style={{
        background: "radial-gradient(ellipse at center, #ffffff 40%, #dfe8f7 100%)",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div style={{ transform: `scale(${0.6 + 0.4 * s})`, opacity: s }}>
        <LogoImage width={780} shine={interpolate(t, [18, 45], [0, 1], clamp)} />
      </div>
    </AbsoluteFill>
  );
};

const ChannelScreen: React.FC<{ index: number; t: number; fps: number }> = ({ index, t, fps }) => {
  const product = PRODUCTS[index];
  const pop = spring({ frame: t, fps, config: { damping: 11, stiffness: 160 } });
  const slide = spring({ frame: t - 3, fps, config: { damping: 16 } });
  return (
    <AbsoluteFill style={{ background: `linear-gradient(135deg, ${C.navy} 0%, ${C.indigo} 100%)`, fontFamily: FONT }}>
      <AbsoluteFill style={{ background: "radial-gradient(circle at 28% 50%, rgba(59,143,224,0.45) 0%, rgba(59,143,224,0) 45%)" }} />
      <div style={{ position: "absolute", left: 90, top: 120, transform: `scale(${pop})` }}>
        <ProductIcon icon={product.icon} size={300} glow />
      </div>
      <div style={{ position: "absolute", left: 440, top: 190, transform: `translateX(${(1 - slide) * 80}px)`, opacity: slide }}>
        <div style={{ color: C.cyan, fontWeight: 700, fontSize: 26, letterSpacing: 6 }}>ELECTROPARQUE</div>
        <div style={{ color: C.white, fontWeight: 900, fontSize: product.name.length > 12 ? 62 : 76, lineHeight: 1.05, marginTop: 6 }}>
          {product.name}
        </div>
        <div style={{ height: 8, width: 260 * slide, background: C.red, borderRadius: 4, marginTop: 18 }} />
      </div>
      <div
        style={{
          position: "absolute",
          right: 40,
          top: 28,
          color: "#9DFFB0",
          fontWeight: 800,
          fontSize: 34,
          textShadow: "0 0 10px rgba(157,255,176,0.8)",
          opacity: t < 20 ? 1 : 0,
        }}
      >
        CH 0{index + 2}
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 50,
          background: C.red,
          color: C.white,
          fontWeight: 700,
          fontSize: 20,
          letterSpacing: 4,
          display: "flex",
          alignItems: "center",
          paddingLeft: 40,
        }}
      >
        IMPORTACIÓN Y DISTRIBUCIÓN · EL MUNDO DE LA ELECTRÓNICA
      </div>
    </AbsoluteFill>
  );
};

const FinalScreen: React.FC<{ t: number; fps: number }> = ({ t, fps }) => {
  const s = spring({ frame: t, fps, config: { damping: 14 } });
  return (
    <AbsoluteFill
      style={{
        background: "radial-gradient(ellipse at 50% 40%, #ffffff 45%, #dbe5f6 100%)",
        alignItems: "center",
        fontFamily: FONT,
      }}
    >
      <div style={{ marginTop: 110, transform: `scale(${0.8 + 0.2 * s})`, opacity: s }}>
        <LogoImage width={820} shine={interpolate(t, [30, 60], [0, 1], clamp)} />
      </div>
      <div style={{ display: "flex", gap: 46, marginTop: 34 }}>
        {PRODUCTS.map((p, i) => {
          const a = spring({ frame: t - 14 - i * 5, fps, config: { damping: 14 } });
          return (
            <div
              key={p.name}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                opacity: a,
                transform: `translateY(${(1 - a) * 30}px)`,
              }}
            >
              <ProductIcon icon={p.icon} size={70} color={C.indigo} accent={C.electric} />
              <div style={{ color: C.indigo, fontWeight: 800, fontSize: 19, marginTop: 4 }}>{p.name}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const Screen: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  if (frame < TURN_ON) {
    return (
      <AbsoluteFill style={{ background: "linear-gradient(160deg, #1a1f30 0%, #07080d 60%)" }}>
        <AbsoluteFill
          style={{ background: "linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.06) 38%, transparent 46%)" }}
        />
      </AbsoluteFill>
    );
  }
  let content: React.ReactNode;
  let staticOpacity = 0;
  if (frame < CH_START) {
    content = <LogoScreen t={frame - (TURN_ON + 12)} fps={fps} />;
  } else if (frame < FINAL) {
    const i = Math.floor((frame - CH_START) / CH_LEN);
    const t = frame - CH_START - i * CH_LEN;
    content = <ChannelScreen index={i} t={t - 4} fps={fps} />;
    staticOpacity = interpolate(t, [0, 5], [1, 0], clamp);
  } else {
    const t = frame - FINAL;
    content = <FinalScreen t={t - 5} fps={fps} />;
    staticOpacity = interpolate(t, [0, 6], [1, 0], clamp);
  }
  // Efecto de encendido tipo CRT
  const lineW = interpolate(frame, [TURN_ON, TURN_ON + 5], [0, 1], clamp);
  const lineH = interpolate(frame, [TURN_ON + 5, TURN_ON + 12], [0.008, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const flash = interpolate(frame, [TURN_ON + 10, TURN_ON + 20], [1, 0], clamp);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ clipPath: `inset(${((1 - lineH) / 2) * 100}% ${((1 - lineW) / 2) * 100}%)` }}>
        {content}
        {staticOpacity > 0 ? <TvStatic frame={frame} opacity={staticOpacity} /> : null}
        <AbsoluteFill style={{ background: "#fff", opacity: flash }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const V1Encendido: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const press = Math.max(...PRESSES.map((p) => bump(frame, p, 4, 7)));
  const irFrames = PRESSES.map((p) => frame - p).filter((t) => t >= 0 && t < 26);

  const handIn = spring({ frame: frame - 8, fps, config: { damping: 15, stiffness: 70 } });
  const handOut = interpolate(frame, [250, 280], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const handX = (1 - handIn) * 520 + handOut * 640;
  const handY = (1 - handIn) * 620 + handOut * 760;

  const zoom = interpolate(frame, [FINAL, FINAL + 32], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const scale = 1 + zoom * 0.62;
  const tvCenterY = TV.y + TV.h / 2;
  const on = interpolate(frame, [TURN_ON + 4, TURN_ON + 30], [0, 1], clamp);
  const intro = interpolate(frame, [0, 18], [0, 1], clamp);

  return (
    <AbsoluteFill style={{ background: C.night, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          opacity: intro,
          transformOrigin: `960px ${tvCenterY}px`,
          transform: `translateY(${zoom * (540 - tvCenterY)}px) scale(${scale})`,
        }}
      >
        {/* Pared */}
        <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 38%, #18225e 0%, #0a0e2a 55%, #04060f 100%)" }} />
        <VoltBackground opacity={0.2 + on * 0.12} width={1820} y={-40} />
        {/* Luz ambiental de la TV */}
        <div
          style={{
            position: "absolute",
            left: TV.x - 240,
            top: TV.y - 180,
            width: TV.w + 480,
            height: TV.h + 360,
            borderRadius: "50%",
            background: "radial-gradient(ellipse, rgba(59,143,224,0.55) 0%, rgba(59,143,224,0) 65%)",
            opacity: on,
          }}
        />
        {/* Mueble */}
        <div style={{ position: "absolute", left: 0, right: 0, top: 830, bottom: 0, background: "linear-gradient(180deg, #0d1230 0%, #03040a 100%)" }} />
        <div style={{ position: "absolute", left: 360, width: 1200, top: 800, height: 34, borderRadius: 8, background: "linear-gradient(180deg, #2a2f48, #12152a)" }} />
        {/* Pie de la TV */}
        <div style={{ position: "absolute", left: 930, width: 60, top: TV.y + TV.h - 4, height: 60, background: "#1c1f2c" }} />
        <div style={{ position: "absolute", left: 800, width: 320, top: TV.y + TV.h + 50, height: 18, borderRadius: 9, background: "#262a3b" }} />
        {/* TV */}
        <div
          style={{
            position: "absolute",
            left: TV.x,
            top: TV.y,
            width: TV.w,
            height: TV.h,
            borderRadius: 18,
            background: "linear-gradient(180deg, #2b2f3f 0%, #0d0f16 100%)",
            boxShadow: "0 30px 80px rgba(0,0,0,0.7), inset 0 0 0 2px #3c4157",
            padding: TV.bezel,
          }}
        >
          <div style={{ position: "relative", width: SCREEN.w, height: SCREEN.h, borderRadius: 6, overflow: "hidden" }}>
            <Screen frame={frame} fps={fps} />
          </div>
          <div style={{ position: "absolute", right: 30, bottom: 4, width: 8, height: 8, borderRadius: 4, background: frame >= TURN_ON ? "#4dff88" : C.red }} />
        </div>
      </AbsoluteFill>

      {/* Mano con control */}
      <div
        style={{
          position: "absolute",
          left: 1400,
          top: 540,
          transformOrigin: "210px 600px",
          transform: `translate(${handX}px, ${handY}px) rotate(-40deg) scale(0.9)`,
        }}
      >
        <Hand press={press} irFrames={irFrames} />
      </div>
    </AbsoluteFill>
  );
};
