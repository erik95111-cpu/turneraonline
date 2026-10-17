import React from "react";
import { BoardModel, CarScreenModel, RemoteModel, TvModel, useTex } from "./Models";

// Un producto parado sobre el plato giratorio.
// rise: 0 (escondido abajo) → 1 (arriba); spin: rotación en Y.
export const ProductOnTable: React.FC<{ index: number; rise: number; spin: number }> = ({ index, rise, spin }) => {
  const tvScreen = useTex("r3d/screen-logo.png");
  if (rise <= 0.001) return null;
  const y = 0.17 + (rise - 1) * 1.2;
  const s = 0.2 + 0.8 * rise;
  let model: React.ReactNode;
  let lift = 1.1;
  if (index === 0) {
    model = <TvModel screen={tvScreen} brightness={1} />;
    lift = 1.42;
  } else if (index === 1) {
    model = <BoardModel />;
    lift = 1.05;
  } else if (index === 2) {
    model = (
      <group rotation-z={0.12}>
        <RemoteModel glow={0.25} />
      </group>
    );
    lift = 1.05;
  } else {
    model = <CarScreenModel />;
    lift = 0.98;
  }
  return (
    <group position-y={y + lift * s} rotation-y={spin} scale={s}>
      {model}
    </group>
  );
};
