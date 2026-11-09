import React from "react";
import { C, Product } from "./theme";

type IconProps = { size: number; color?: string; accent?: string; glow?: boolean };

const Frame: React.FC<IconProps & { children: React.ReactNode }> = ({ size, color = C.white, glow, children }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 200 200"
    fill="none"
    stroke={color}
    strokeWidth={7}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ overflow: "visible", filter: glow ? `drop-shadow(0 0 14px ${C.electric}) drop-shadow(0 0 4px ${C.cyan})` : undefined }}
  >
    {children}
  </svg>
);

export const TvIcon: React.FC<IconProps> = (p) => (
  <Frame {...p}>
    <rect x={18} y={36} width={164} height={104} rx={10} />
    <rect x={30} y={48} width={140} height={80} rx={4} fill={p.accent ?? C.electric} fillOpacity={0.35} strokeWidth={4} />
    <path d="M50 62 L80 62" strokeWidth={5} opacity={0.7} />
    <path d="M75 140 L62 164 M125 140 L138 164 M50 164 L150 164" />
  </Frame>
);

export const BoardIcon: React.FC<IconProps> = (p) => (
  <Frame {...p}>
    <rect x={28} y={28} width={144} height={144} rx={10} />
    <rect x={70} y={70} width={52} height={52} rx={4} fill={p.accent ?? C.electric} fillOpacity={0.35} />
    <rect x={82} y={82} width={28} height={28} rx={2} strokeWidth={4} />
    <path d="M140 46 L140 154 M154 46 L154 154" strokeWidth={6} />
    <rect x={44} y={138} width={24} height={18} rx={2} strokeWidth={5} />
    <path d="M44 50 L60 50 L60 70 M96 46 L96 70 M70 96 L48 96 L48 120 M96 122 L96 138 L80 138 M122 96 L132 96" strokeWidth={4} />
    {[78, 88, 98, 108, 118].map((x) => (
      <path key={x} d={`M${x} 64 L${x} 70`} strokeWidth={3} />
    ))}
  </Frame>
);

export const RemoteIcon: React.FC<IconProps> = (p) => (
  <Frame {...p}>
    <rect x={68} y={14} width={64} height={172} rx={30} />
    <circle cx={100} cy={44} r={9} fill={C.red} stroke={C.red} />
    <circle cx={100} cy={88} r={19} />
    <circle cx={100} cy={88} r={6} fill={p.color ?? C.white} />
    {[124, 146, 166].map((y) =>
      [86, 114].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r={4.5} fill={p.accent ?? C.electric} strokeWidth={3} />),
    )}
  </Frame>
);

export const CarPlayIcon: React.FC<IconProps> = (p) => (
  <Frame {...p}>
    <rect x={22} y={46} width={156} height={106} rx={18} />
    {[0, 1, 2, 3].map((col) =>
      [0, 1].map((row) => (
        <rect
          key={`${col}-${row}`}
          x={40 + col * 32}
          y={64 + row * 36}
          width={22}
          height={22}
          rx={6}
          strokeWidth={4}
          fill={col === 0 && row === 0 ? C.red : (p.accent ?? C.electric)}
          fillOpacity={col === 0 && row === 0 ? 0.9 : 0.4}
        />
      )),
    )}
    <path d="M84 152 L78 172 L122 172 L116 152" />
  </Frame>
);

export const ProductIcon: React.FC<IconProps & { icon: Product["icon"] }> = ({ icon, ...p }) => {
  if (icon === "tv") return <TvIcon {...p} />;
  if (icon === "board") return <BoardIcon {...p} />;
  if (icon === "remote") return <RemoteIcon {...p} />;
  return <CarPlayIcon {...p} />;
};
