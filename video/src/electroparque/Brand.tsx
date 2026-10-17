import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { C } from "./theme";

// Proporción del recorte del logo (2190x510)
export const LOGO_RATIO = 510 / 2190;

// Logo Electroparque sobre fondo blanco, con un brillo que lo recorre.
// `shine` va de 0 a 1 (posición del brillo); fuera de ese rango no se ve.
export const LogoImage: React.FC<{ width: number; shine?: number }> = ({ width, shine = -1 }) => {
  const height = width * LOGO_RATIO;
  return (
    <div style={{ position: "relative", width, height, overflow: "hidden" }}>
      <Img src={staticFile("electroparque.png")} style={{ width, height, display: "block" }} />
      {shine >= 0 && shine <= 1 ? (
        <div
          style={{
            position: "absolute",
            top: -height,
            bottom: -height,
            width: width * 0.18,
            left: -width * 0.3 + shine * width * 1.5,
            transform: "rotate(20deg)",
            background:
              "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(160,210,255,0.95) 50%, rgba(255,255,255,0) 100%)",
            mixBlendMode: "screen",
          }}
        />
      ) : null}
    </div>
  );
};

// Tarjeta blanca con el logo, borde luminoso azul.
export const LogoCard: React.FC<{ width: number; shine?: number; glow?: number }> = ({
  width,
  shine,
  glow = 1,
}) => (
  <div
    style={{
      padding: `${width * 0.045}px ${width * 0.06}px`,
      background: C.white,
      borderRadius: width * 0.035,
      boxShadow: `0 0 ${60 * glow}px rgba(59,143,224,${0.75 * glow}), 0 0 ${8 * glow}px rgba(124,196,255,${glow}), 0 30px 80px rgba(0,0,0,0.45)`,
    }}
  >
    <LogoImage width={width} shine={shine} />
  </div>
);

// Logo VOLT (fondo transparente) en segundo plano.
export const VoltBackground: React.FC<{
  opacity?: number;
  width?: number;
  y?: number;
  blur?: number;
  drift?: boolean;
}> = ({ opacity = 0.16, width = 1650, y = 0, blur = 0, drift = true }) => {
  const frame = useCurrentFrame();
  const s = drift ? 1 + frame * 0.0006 : 1;
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", pointerEvents: "none" }}>
      <Img
        src={staticFile("volt-alpha.png")}
        style={{
          width,
          opacity,
          transform: `translateY(${y}px) scale(${s})`,
          filter: `blur(${blur}px) drop-shadow(0 0 30px rgba(59,143,224,0.6))`,
        }}
      />
    </AbsoluteFill>
  );
};
