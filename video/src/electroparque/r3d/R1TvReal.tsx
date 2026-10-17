import { ThreeCanvas } from "@remotion/three";
import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { bump, clamp } from "../common";
import { CameraRig, mix } from "./CameraRig";
import { ReflectiveFloor, RemoteModel, StudioEnv, TvModel, useTex, VoltWall } from "./Models";

// Realista 1 — "TV 3D": showroom oscuro, el control enciende la TV,
// pasan los productos en pantalla y la cámara entra a la pantalla.

const PRESS_ON = 55;
const TURN_ON = 68;
const CH_START = 150;
const CH_LEN = 30;
const FINAL = 270;
const PRESSES = [PRESS_ON, CH_START - 3, CH_START + CH_LEN - 3, CH_START + 2 * CH_LEN - 3, CH_START + 3 * CH_LEN - 3];
const CHANGES = [CH_START, CH_START + CH_LEN, CH_START + 2 * CH_LEN, CH_START + 3 * CH_LEN, FINAL];

const TV_Y = 1.4;
const REMOTE: [number, number, number] = [1.5, 0.95, 2.2];
const BUTTON: [number, number, number] = [1.26, 1.2, 1.56];

const Scene: React.FC<{ frame: number }> = ({ frame }) => {
  const logo = useTex("r3d/screen-logo.png");
  const slides = [useTex("r3d/screen-0.png"), useTex("r3d/screen-1.png"), useTex("r3d/screen-2.png"), useTex("r3d/screen-3.png")];

  const glow = Math.max(...PRESSES.map((p) => bump(frame, p, 3, 8)));
  const crtX = interpolate(frame, [TURN_ON, TURN_ON + 4], [0, 1], clamp);
  const crtY = interpolate(frame, [TURN_ON + 4, TURN_ON + 12], [0.004, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const flash = Math.max(interpolate(frame, [TURN_ON + 8, TURN_ON + 24], [1.2, 0], clamp), ...CHANGES.map((c) => bump(frame, c, 2, 5) * 1.4));
  const brightness = frame < TURN_ON ? 0 : 1 + flash;

  let screen = logo;
  if (frame >= CH_START && frame < FINAL) screen = slides[Math.floor((frame - CH_START) / CH_LEN)];

  // Cámara: del control (primer plano) a la vista general, y al final entra a la pantalla
  const pull = interpolate(frame, [20, 125], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const drift = interpolate(frame, [125, FINAL], [0, 1], clamp);
  const dolly = interpolate(frame, [FINAL, FINAL + 70], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const close: [number, number, number] = [2.35, 1.75, 3.15];
  const wide: [number, number, number] = [0.7 - drift * 1.1, 1.9 - drift * 0.15, 7.3 - drift * 0.7];
  const end: [number, number, number] = [0, TV_Y, 2.86];
  let pos = mix(close, wide, pull);
  pos = mix(pos, end, dolly);
  let target = mix(BUTTON, [0, TV_Y - 0.05, 0], pull);
  target = mix(target, [0, TV_Y, 0], dolly);

  const on = interpolate(frame, [TURN_ON, TURN_ON + 20], [0, 1], clamp);
  const bob = Math.sin(frame / 18) * 0.03;

  return (
    <>
      <CameraRig position={pos} target={target} fov={35} />
      <color attach="background" args={["#03040b"]} />
      <fog attach="fog" args={["#03040b", 9, 22]} />
      <StudioEnv />
      <ambientLight intensity={0.12} />
      <spotLight position={[0, 6, 4]} angle={0.5} penumbra={1} intensity={30} color="#9fc3ff" />
      <pointLight position={[0, TV_Y, 1.2]} color="#bcd6ff" intensity={on * 6} distance={9} />

      {/* pared y logo VOLT */}
      <mesh position={[0, 3, -1.6]}>
        <planeGeometry args={[30, 8]} />
        <meshStandardMaterial color="#0a0f2a" roughness={0.9} />
      </mesh>
      <VoltWall width={9.5} opacity={0.32 + on * 0.18} position={[0, 2.1, -1.55]} />
      {/* luz azul detrás de la TV */}
      <mesh position={[0, TV_Y, -1.5]}>
        <planeGeometry args={[6, 3.4]} />
        <meshBasicMaterial color="#3B8FE0" transparent opacity={on * 0.18} toneMapped={false} depthWrite={false} />
      </mesh>

      <group position={[0, TV_Y, 0]}>
        <TvModel screen={screen} brightness={brightness} crtX={crtX} crtY={crtY} />
      </group>

      <group position={[REMOTE[0], REMOTE[1] + bob, REMOTE[2]]} rotation-y={0.35}>
        <group rotation-x={-1.2}>
          <RemoteModel glow={glow} />
        </group>
      </group>

      <ReflectiveFloor />
    </>
  );
};

export const R1TvReal: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const fadeIn = interpolate(frame, [0, 15], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ background: "#03040b" }}>
      <AbsoluteFill style={{ opacity: fadeIn }}>
        <ThreeCanvas width={width} height={height} camera={{ fov: 35, near: 0.05, far: 60 }}>
          <Scene frame={frame} />
        </ThreeCanvas>
      </AbsoluteFill>
      {/* viñeta */}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)" }} />
    </AbsoluteFill>
  );
};
