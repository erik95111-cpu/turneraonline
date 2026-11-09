import { ThreeCanvas } from "@remotion/three";
import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp } from "../common";
import { C, FONT, PRODUCTS } from "../theme";
import { CameraRig } from "./CameraRig";
import { LogoPlate, ReflectiveFloor, StudioEnv, Turntable, VoltWall } from "./Models";
import { ProductOnTable } from "./Showcase";

// Loop "Vitrina 3D": el logo siempre visible y los productos van pasando
// sobre el plato giratorio. Bucle perfecto (duración = 4 × SEG frames).

export const SEG = 112;

const Scene: React.FC<{ frame: number; portrait: boolean; total: number }> = ({ frame, portrait, total }) => {
  const phase = frame / total;
  const ang = phase * Math.PI * 2;
  const i = Math.floor(frame / SEG) % PRODUCTS.length;
  const t = frame % SEG;
  const rise = Math.min(
    interpolate(t, [0, 16], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.3)) }),
    interpolate(t, [SEG - 12, SEG], [1, 0], { ...clamp, easing: Easing.in(Easing.cubic) }),
  );
  const shine = interpolate(frame % (total / 2), [30, 90], [-1, 1], clamp);
  const bob = Math.sin(ang * 2) * 0.05;

  const tablePos: [number, number, number] = portrait ? [0, 0, 0] : [1.7, 0, 0];
  const platePos: [number, number, number] = portrait ? [0, 3.75 + bob, 0.3] : [-2.15, 1.8 + bob, 0.8];
  const cam: [number, number, number] = portrait ? [Math.sin(ang) * 0.4, 2.7, 9.6] : [0.6 + Math.sin(ang) * 0.4, 2.3, 7.6];
  const target: [number, number, number] = portrait ? [0, 2.15, 0] : [0.1, 1.35, 0];

  return (
    <>
      <CameraRig position={cam} target={target} fov={portrait ? 42 : 36} />
      <color attach="background" args={["#03040b"]} />
      <fog attach="fog" args={["#03040b", 11, 26]} />
      <StudioEnv />
      <ambientLight intensity={0.1} />
      <spotLight position={[tablePos[0], 7, 2]} angle={0.45} penumbra={1} intensity={60} color="#cfe0ff" />
      <pointLight position={[tablePos[0], 2.4, 4]} intensity={14} color="#ffffff" distance={12} />
      <pointLight position={[-4, 2, 2]} intensity={8} color="#3B8FE0" distance={10} />
      <pointLight position={[4, 1.5, 2]} intensity={5} color="#E53225" distance={8} />

      <mesh position={[0, 4, -5.2]}>
        <planeGeometry args={[40, 14]} />
        <meshStandardMaterial color="#080c22" roughness={0.95} />
      </mesh>
      <VoltWall width={portrait ? 9 : 12} opacity={0.4} position={portrait ? [0, 4.7, -5.1] : [0, 3.4, -5.1]} />

      <group position={tablePos} scale={portrait ? 0.82 : 1}>
        <Turntable angle={ang * 2} ringAngle={ang * 3} />
        <ProductOnTable index={i} rise={rise} spin={-0.7 + t * 0.014} />
      </group>
      <group position={platePos} rotation-y={portrait ? 0 : 0.32}>
        <LogoPlate width={portrait ? 3.5 : 2.7} shine={shine} />
      </group>

      <ReflectiveFloor />
    </>
  );
};

export const LoopVitrina: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const portrait = height > width;
  const i = Math.floor(frame / SEG) % PRODUCTS.length;
  const t = frame % SEG;
  const label = Math.min(interpolate(t, [14, 26], [0, 1], clamp), interpolate(t, [SEG - 18, SEG - 8], [1, 0], clamp));
  return (
    <AbsoluteFill style={{ background: "#03040b" }}>
      <ThreeCanvas width={width} height={height} camera={{ fov: 36, near: 0.05, far: 60 }}>
        <Scene frame={frame} portrait={portrait} total={durationInFrames} />
      </ThreeCanvas>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.5) 100%)" }} />
      <div
        style={{
          position: "absolute",
          fontFamily: FONT,
          opacity: label,
          transform: `translateY(${(1 - label) * 20}px)`,
          ...(portrait ? { left: 0, right: 0, bottom: 210, textAlign: "center" as const } : { right: 150, bottom: 110, textAlign: "right" as const }),
        }}
      >
        <div style={{ color: C.white, fontWeight: 800, fontSize: portrait ? 84 : 64, lineHeight: 1.1 }}>{PRODUCTS[i].name}</div>
        <div style={{ display: "inline-block", width: 120, height: 5, background: C.red, marginTop: 12, borderRadius: 3 }} />
      </div>
    </AbsoluteFill>
  );
};
