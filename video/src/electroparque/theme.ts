import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

// Fuente local (Montserrat variable) para no depender de internet al renderizar
loadFont({ family: "Montserrat", url: staticFile("fonts/Montserrat.woff2"), weight: "500 900" });
loadFont({ family: "Montserrat", url: staticFile("fonts/Montserrat-Italic.woff2"), weight: "700 800", style: "italic" });

const fontFamily = "Montserrat";

export const FONT = fontFamily;

export const C = {
  night: "#050817",
  navy: "#0B1033",
  indigo: "#1B1AA0", // azul del logo Electroparque
  electric: "#3B8FE0", // azul del logo VOLT
  cyan: "#7CC4FF",
  red: "#E53225", // rojo del logo Electroparque
  white: "#FFFFFF",
  paper: "#EEF2F8",
};

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
// 12 segundos
export const DURATION = 360;

export type Product = { name: string; icon: "tv" | "board" | "remote" | "carplay" };

export const PRODUCTS: Product[] = [
  { name: "Televisores", icon: "tv" },
  { name: "Placas madre", icon: "board" },
  { name: "Controles remotos", icon: "remote" },
  { name: "CarPlay", icon: "carplay" },
];
