import { ThreeCanvas } from "@remotion/three";
import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, Flare } from "../common";
import { C, FONT, PRODUCTS } from "../theme";
import { CameraRig, mix } from "./CameraRig";
import { LogoPlate, ReflectiveFloor, StudioEnv, Turntable, VoltWall } from "./Models";
import { ProductOnTable } from "./Showcase";

// Realista 2 — "Estudio 3D": como la referencia, objetos 3D girando sobre
// un plato con anillos cromados, y cierre con la placa del logo.

const INTRO = 50;
const LEN = 53;
const FINAL = INTRO + LEN * PRODUCTS.length; // 262

const Scene: React.FC<{ frame: number }> = ({ frame }) => {
  const lights = interpolate(frame, [0, 30], [0.05, 1], clamp);

  // Productos
  let product: React.ReactNode = null;
  if (frame >= INTRO && frame < FINAL) {
    const i = Math.floor((frame - INTRO) / LEN);
    const t = frame - INTRO - i * LEN;
    const rise = Math.min(
      interpolate(t, [0, 14], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.4)) }),
      interpolate(t, [LEN - 9, LEN], [1, 0], { ...clamp, easing: Easing.in(Easing.cubic) }),
    );
    product = <ProductOnTable index={i} rise={rise} spin={-0.9 + t * 0.035} />;
  }

  // Placa final
  const plateT = frame - FINAL;
  const plateIn = interpolate(plateT, [0, 22], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const plateTurn = interpolate(plateT, [0, 30], [-Math.PI / 2, 0], { ...clamp, easing: Easing.out(Easing.cubic) });
  const sweep = frame >= FINAL ? interpolate(plateT, [30, 75], [-9, 9], clamp) : undefined;

  // Cámara: baja desde arriba, orbita, y al final se ubica de frente a la placa
  const crane = interpolate(frame, [0, INTRO + 10], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const orbit = interpolate(frame, [0, FINAL], [0.7, -0.7]);
  const r = 6.6;
  const orbitPos: [number, number, number] = [Math.sin(orbit) * r, 4.8 - crane * 2.6, Math.cos(orbit) * r];
  const front = interpolate(plateT, [0, 35], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const pos = mix(orbitPos, [0, 2.0, 6.2], front);
  const target = mix([0, 1.05, 0], [0, 1.75, 0], front);

  return (
    <>
      <CameraRig position={pos} target={target} fov={36} />
      <color attach="background" args={["#03040b"]} />
      <fog attach="fog" args={["#03040b", 10, 24]} />
      <StudioEnv sweep={sweep} />
      <ambientLight intensity={0.1 * lights} />
      <spotLight position={[0, 7, 2]} angle={0.45} penumbra={1} intensity={60 * lights} color="#cfe0ff" />
      <pointLight position={[-4, 2, 2]} intensity={8 * lights} color="#3B8FE0" distance={10} />
      <pointLight position={[4, 1.5, 2]} intensity={5 * lights} color="#E53225" distance={8} />

      <mesh position={[0, 4, -5.2]}>
        <planeGeometry args={[40, 12]} />
        <meshStandardMaterial color="#080c22" roughness={0.95} />
      </mesh>
      <VoltWall width={12} opacity={0.4 * lights} position={[0, 3.3, -5.1]} />

      <Turntable angle={frame * 0.02} ringAngle={frame * 0.015} />
      {product}
      {frame >= FINAL ? (
        <group position={[0, 1.75 + (1 - plateIn) * -1.5, 0]} rotation-y={plateTurn} scale={0.3 + 0.7 * plateIn}>
          <LogoPlate width={3.4} />
        </group>
      ) : null}

      <ReflectiveFloor />
    </>
  );
};

const LowerThird: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  if (frame < INTRO || frame >= FINAL) return null;
  const i = Math.floor((frame - INTRO) / LEN);
  const t = frame - INTRO - i * LEN;
  const a = spring({ frame: t - 8, fps, config: { damping: 18 } });
  const out = interpolate(t, [LEN - 10, LEN - 2], [0, 1], clamp);
  return (
    <div style={{ position: "absolute", left: 130, bottom: 120, fontFamily: FONT, opacity: a * (1 - out), transform: `translateX(${(1 - a) * -60 - out * 40}px)` }}>
      <div style={{ color: C.cyan, fontWeight: 700, fontSize: 22, letterSpacing: 8 }}>ELECTROPARQUE</div>
      <div style={{ color: C.white, fontWeight: 800, fontSize: 72, lineHeight: 1.1 }}>{PRODUCTS[i].name}</div>
      <div style={{ width: 140 * a, height: 5, background: C.red, marginTop: 10, borderRadius: 3 }} />
    </div>
  );
};

export const R2Studio: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const flare = interpolate(frame, [FINAL + 30, FINAL + 50, FINAL + 75], [0, 0.55, 0], clamp);
  return (
    <AbsoluteFill style={{ background: "#03040b" }}>
      <ThreeCanvas width={width} height={height} camera={{ fov: 36, near: 0.05, far: 60 }}>
        <Scene frame={frame} />
      </ThreeCanvas>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.5) 100%)" }} />
      <LowerThird frame={frame} fps={fps} />
      <Flare x={interpolate(frame, [FINAL + 30, FINAL + 75], [500, 1420], clamp)} y={430} intensity={flare} />
    </AbsoluteFill>
  );
};
