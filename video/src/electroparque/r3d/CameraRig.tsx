import { useThree } from "@react-three/fiber";
import React, { useLayoutEffect } from "react";
import * as THREE from "three";

// Posiciona la cámara en cada frame (todo sale de useCurrentFrame, sin estado).
export const CameraRig: React.FC<{ position: [number, number, number]; target: [number, number, number]; fov?: number }> = ({
  position,
  target,
  fov = 35,
}) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useLayoutEffect(() => {
    camera.position.set(...position);
    camera.fov = fov;
    camera.updateProjectionMatrix();
    camera.lookAt(...target);
  });
  return null;
};

export const mix = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
