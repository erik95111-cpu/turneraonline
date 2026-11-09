import { Environment, Lightformer, MeshReflectorMaterial, RoundedBox, useTexture } from "@react-three/drei";
import React, { useMemo } from "react";
import { staticFile } from "remotion";
import * as THREE from "three";

// Modelos 3D construidos con primitivas + materiales físicos.

export const useTex = (path: string) => {
  const tex = useTexture(staticFile(path));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
};

// ---------- Iluminación de estudio (reflejos) ----------
const StudioEnvInner: React.FC = () => (
  <Environment resolution={128} frames={1}>
    <Lightformer intensity={2.2} position={[0, 6, -1]} rotation-x={Math.PI / 2} scale={[12, 5, 1]} />
    <Lightformer intensity={3} color="#7CC4FF" position={[-7, 1.5, 1]} rotation-y={Math.PI / 2} scale={[2.5, 9, 1]} />
    <Lightformer intensity={2.4} color="#3B8FE0" position={[7, 1.5, 1]} rotation-y={-Math.PI / 2} scale={[2.5, 9, 1]} />
    <Lightformer intensity={1.2} color="#E53225" position={[4, -1, 6]} scale={[2, 0.3, 1]} />
  </Environment>
);

// Memorizado: si los props no cambian, el mapa de reflejos no se vuelve a calcular
export const StudioEnv = React.memo(StudioEnvInner);

export const ReflectiveFloor: React.FC<{ color?: string; y?: number }> = ({ color = "#070a1c", y = 0 }) => (
  <mesh rotation-x={-Math.PI / 2} position-y={y}>
    <planeGeometry args={[60, 60]} />
    <MeshReflectorMaterial
      resolution={512}
      mirror={0.75}
      blur={[400, 120]}
      mixBlur={1.2}
      mixStrength={3}
      depthScale={0.6}
      minDepthThreshold={0.6}
      maxDepthThreshold={1.2}
      color={color}
      roughness={0.75}
      metalness={0.5}
    />
  </mesh>
);

const BLACK_GLOSS = { color: "#0b0b0e", metalness: 0.6, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08 };
const ALUMINIUM = { color: "#c3c8d2", metalness: 1, roughness: 0.28 };

// ---------- TV ----------
export const TvModel: React.FC<{
  screen: THREE.Texture | null;
  brightness: number;
  crtX?: number;
  crtY?: number;
}> = ({ screen, brightness, crtX = 1, crtY = 1 }) => {
  const W = 3.2;
  const H = 1.82;
  const color = useMemo(() => new THREE.Color(), []);
  color.setScalar(brightness);
  return (
    <group>
      <RoundedBox args={[W, H, 0.07]} radius={0.025} smoothness={4}>
        <meshPhysicalMaterial {...BLACK_GLOSS} />
      </RoundedBox>
      {/* pantalla apagada */}
      <mesh position-z={0.0355}>
        <planeGeometry args={[W - 0.06, H - 0.06]} />
        <meshPhysicalMaterial color="#020203" roughness={0.08} metalness={0.2} clearcoat={1} />
      </mesh>
      {/* imagen */}
      {screen && brightness > 0 ? (
        <mesh position-z={0.036} scale={[Math.max(0.001, crtX), Math.max(0.002, crtY), 1]}>
          <planeGeometry args={[W - 0.06, H - 0.06]} />
          <meshBasicMaterial map={screen} color={color} toneMapped={false} />
        </mesh>
      ) : null}
      {/* vidrio con reflejos */}
      <mesh position-z={0.037}>
        <planeGeometry args={[W - 0.06, H - 0.06]} />
        <meshPhysicalMaterial color="#000" transparent opacity={0.18} roughness={0.04} clearcoat={1} />
      </mesh>
      {/* pie */}
      <mesh position={[0, -H / 2 - 0.22, -0.06]}>
        <boxGeometry args={[0.14, 0.46, 0.05]} />
        <meshPhysicalMaterial {...ALUMINIUM} />
      </mesh>
      <RoundedBox args={[1.25, 0.035, 0.5]} radius={0.015} position={[0, -H / 2 - 0.45, -0.06]}>
        <meshPhysicalMaterial {...ALUMINIUM} />
      </RoundedBox>
      <mesh position={[W / 2 - 0.12, -H / 2 + 0.012, 0.037]}>
        <circleGeometry args={[0.008, 16]} />
        <meshBasicMaterial color={brightness > 0 ? "#5dff8f" : "#ff3322"} toneMapped={false} />
      </mesh>
    </group>
  );
};

// ---------- Control remoto ----------
export const RemoteModel: React.FC<{ glow: number }> = ({ glow }) => {
  const red = useMemo(() => new THREE.Color("#E53225"), []);
  const buttons: [number, number][] = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) buttons.push([(c - 1) * 0.11, -0.12 - r * 0.13]);
  return (
    <group>
      <RoundedBox args={[0.42, 1.9, 0.13]} radius={0.06} smoothness={6}>
        <meshPhysicalMaterial color="#111217" metalness={0.25} roughness={0.42} clearcoat={0.4} clearcoatRoughness={0.3} />
      </RoundedBox>
      {/* panel superior brillante */}
      <RoundedBox args={[0.36, 0.5, 0.02]} radius={0.008} position={[0, 0.62, 0.062]}>
        <meshPhysicalMaterial {...BLACK_GLOSS} />
      </RoundedBox>
      {/* botón de encendido */}
      <mesh position={[0, 0.74, 0.075]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.05, 0.05, 0.025, 32]} />
        <meshStandardMaterial color={red} emissive={red} emissiveIntensity={0.3 + glow * 6} toneMapped={glow < 0.05} />
      </mesh>
      {glow > 0.01 ? <pointLight position={[0, 0.74, 0.25]} color="#ff3a2a" intensity={glow * 3} distance={2} /> : null}
      {/* cruceta */}
      <mesh position={[0, 0.32, 0.068]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.13, 0.13, 0.02, 48]} />
        <meshPhysicalMaterial color="#25272f" roughness={0.35} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.32, 0.08]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.055, 0.055, 0.02, 32]} />
        <meshPhysicalMaterial {...ALUMINIUM} />
      </mesh>
      {buttons.map(([x, y], i) => (
        <mesh key={i} position={[x, y, 0.07]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.038, 0.038, 0.02, 24]} />
          <meshPhysicalMaterial color={i === 9 ? "#3B8FE0" : "#2a2c35"} roughness={0.6} />
        </mesh>
      ))}
      {/* ventana infrarroja */}
      <mesh position={[0, 0.95, 0]}>
        <boxGeometry args={[0.2, 0.012, 0.06]} />
        <meshPhysicalMaterial color="#2a0505" roughness={0.05} clearcoat={1} />
      </mesh>
    </group>
  );
};

// ---------- Placa madre ----------
export const BoardModel: React.FC = () => {
  const pcb = useTex("r3d/pcb.png");
  const caps: [number, number][] = [];
  for (let i = 0; i < 8; i++) caps.push([-0.55 + (i % 4) * 0.1, 0.55 - Math.floor(i / 4) * 0.12]);
  return (
    <group>
      <mesh>
        <boxGeometry args={[2.2, 1.9, 0.04]} />
        <meshPhysicalMaterial map={pcb} emissiveMap={pcb} emissive="#ffffff" emissiveIntensity={0.55} roughness={0.45} metalness={0.3} clearcoat={0.6} />
      </mesh>
      {/* disipador del procesador */}
      <RoundedBox args={[0.62, 0.62, 0.06]} radius={0.02} position={[-0.05, 0.25, 0.05]}>
        <meshPhysicalMaterial {...ALUMINIUM} />
      </RoundedBox>
      {Array.from({ length: 9 }).map((_, i) => (
        <mesh key={i} position={[-0.31 + i * 0.065, 0.25, 0.16]}>
          <boxGeometry args={[0.025, 0.56, 0.18]} />
          <meshPhysicalMaterial color="#d7dbe3" metalness={1} roughness={0.22} />
        </mesh>
      ))}
      {/* memorias RAM */}
      {[0, 1, 2, 3].map((i) => (
        <group key={i} position={[0.55 + i * 0.1, 0.2, 0.1]}>
          <mesh>
            <boxGeometry args={[0.05, 1.1, 0.16]} />
            <meshPhysicalMaterial color={i % 2 ? "#14161d" : "#1B1AA0"} metalness={0.5} roughness={0.35} clearcoat={0.5} />
          </mesh>
          <mesh position={[0, 0, 0.085]}>
            <boxGeometry args={[0.052, 1.0, 0.01]} />
            <meshPhysicalMaterial color="#E53225" emissive="#E53225" emissiveIntensity={0.6} />
          </mesh>
        </group>
      ))}
      {/* condensadores */}
      {caps.map(([x, y], i) => (
        <mesh key={i} position={[x, y, 0.08]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.035, 0.035, 0.13, 20]} />
          <meshPhysicalMaterial color="#b9bec8" metalness={1} roughness={0.3} />
        </mesh>
      ))}
      {/* ranuras PCIe */}
      {[0, 1].map((i) => (
        <mesh key={i} position={[-0.15, -0.38 - i * 0.28, 0.04]}>
          <boxGeometry args={[1.4, 0.07, 0.06]} />
          <meshPhysicalMaterial color="#1a1c22" roughness={0.5} metalness={0.4} />
        </mesh>
      ))}
      {/* chipset */}
      <RoundedBox args={[0.34, 0.34, 0.05]} radius={0.01} position={[0.55, -0.6, 0.05]}>
        <meshPhysicalMaterial color="#20232b" metalness={0.8} roughness={0.25} />
      </RoundedBox>
      {/* panel de conectores */}
      <mesh position={[-1.02, 0.35, 0.12]}>
        <boxGeometry args={[0.16, 1.0, 0.22]} />
        <meshPhysicalMaterial {...ALUMINIUM} />
      </mesh>
    </group>
  );
};

// ---------- Pantalla CarPlay ----------
export const CarScreenModel: React.FC = () => {
  const ui = useTex("r3d/car-ui.png");
  return (
    <group>
      <RoundedBox args={[2.5, 1.12, 0.09]} radius={0.06} smoothness={4}>
        <meshPhysicalMaterial {...BLACK_GLOSS} />
      </RoundedBox>
      <mesh position-z={0.046}>
        <planeGeometry args={[2.34, 0.975]} />
        <meshBasicMaterial map={ui} toneMapped={false} />
      </mesh>
      <mesh position-z={0.047}>
        <planeGeometry args={[2.34, 0.975]} />
        <meshPhysicalMaterial color="#000" transparent opacity={0.15} roughness={0.04} clearcoat={1} />
      </mesh>
      {/* soporte */}
      <mesh position={[0, -0.72, -0.1]} rotation-x={0.25}>
        <boxGeometry args={[0.5, 0.4, 0.08]} />
        <meshPhysicalMaterial color="#1a1c22" metalness={0.6} roughness={0.3} />
      </mesh>
    </group>
  );
};

// ---------- Placa con el logo ----------
// Banda de luz suave (para el brillo que recorre la placa)
const useShineTexture = () =>
  useMemo(() => {
    const w = 256;
    const data = new Uint8Array(w * 4);
    for (let x = 0; x < w; x++) {
      const d = (x - w / 2) / (w * 0.12);
      const v = Math.round(255 * Math.exp(-d * d));
      data.set([255, 255, 255, v], x * 4);
    }
    const tex = new THREE.DataTexture(data, w, 1);
    tex.needsUpdate = true;
    return tex;
  }, []);

// shine: posición del brillo, de -1 (izquierda, fuera) a 1 (derecha, fuera)
export const LogoPlate: React.FC<{ width?: number; shine?: number }> = ({ width = 3.6, shine }) => {
  const logo = useTex("electroparque-white.png");
  const shineTex = useShineTexture();
  const h = width * 0.3;
  shineTex.offset.x = -(shine ?? -1);
  return (
    <group>
      <RoundedBox args={[width, h, 0.14]} radius={0.06} smoothness={6}>
        <meshPhysicalMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.6} roughness={0.18} metalness={0} clearcoat={1} clearcoatRoughness={0.05} />
      </RoundedBox>
      <mesh position-z={0.0705}>
        <planeGeometry args={[width * 0.9, width * 0.9 * (510 / 2190)]} />
        <meshBasicMaterial map={logo} toneMapped={false} />
      </mesh>
      {shine !== undefined && shine > -1 && shine < 1 ? (
        <mesh position-z={0.072}>
          <planeGeometry args={[width - 0.05, h - 0.05]} />
          <meshBasicMaterial map={shineTex} transparent opacity={0.55} color="#bfe0ff" blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      ) : null}
      {/* borde azul */}
      <mesh position-z={-0.01}>
        <planeGeometry args={[width + 0.08, h + 0.08]} />
        <meshBasicMaterial color="#3B8FE0" toneMapped={false} />
      </mesh>
    </group>
  );
};

// ---------- Logo VOLT de fondo ----------
export const VoltWall: React.FC<{ width?: number; opacity?: number; position?: [number, number, number] }> = ({
  width = 12,
  opacity = 0.35,
  position = [0, 3, -6],
}) => {
  const volt = useTex("volt-alpha.png");
  return (
    <mesh position={position}>
      <planeGeometry args={[width, width * (952 / 2358)]} />
      <meshBasicMaterial map={volt} transparent opacity={opacity} toneMapped={false} depthWrite={false} />
    </mesh>
  );
};

// ---------- Plato giratorio con anillos ----------
export const Turntable: React.FC<{ angle: number; ringAngle: number }> = ({ angle, ringAngle }) => (
  <group>
    <group rotation-y={angle}>
      <mesh position-y={0.08}>
        <cylinderGeometry args={[1.7, 1.78, 0.16, 96]} />
        <meshPhysicalMaterial color="#0d1022" metalness={0.7} roughness={0.2} clearcoat={1} />
      </mesh>
      <mesh position-y={0.165} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[1.5, 1.56, 96]} />
        <meshBasicMaterial color="#3B8FE0" toneMapped={false} />
      </mesh>
    </group>
    <mesh position-y={0.02} rotation-x={-Math.PI / 2}>
      <torusGeometry args={[1.86, 0.025, 16, 128]} />
      <meshBasicMaterial color="#E53225" toneMapped={false} />
    </mesh>
    {[2.3, 2.6].map((r, i) => (
      <mesh key={r} position-y={0.9 + i * 0.25} rotation={[Math.PI / 2 + 0.25 * (i ? -1 : 1), 0, ringAngle * (i ? -1 : 1)]}>
        <torusGeometry args={[r, 0.035, 24, 160]} />
        <meshPhysicalMaterial color="#e8eef8" metalness={1} roughness={0.12} />
      </mesh>
    ))}
  </group>
);
