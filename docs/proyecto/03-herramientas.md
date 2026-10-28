# Capítulo 3 · Herramientas (`src/lib/`)

Antes de armar reservas y pantallas, conviene tener **herramientas chiquitas** que hagan una sola cosa bien:
convertir fechas, mostrar precios, calcular horarios libres.
Así no se repite el mismo código en veinte lugares.

> Los archivos de seguridad de esta carpeta (`db.ts`, `auth.ts`, `token.ts`, `passwords.ts`, `log.ts`, `limite-login.ts`) están en la guía de seguridad.

---

## `src/lib/env-db.ts` — acomodar los nombres de la base

Neon, Prisma Postgres y otras bases de Vercel llaman distinto a la misma variable. Esta función los unifica.

```ts
export function completarVariablesDB(env: NodeJS.ProcessEnv = process.env) {
                                                         // Recibe las variables de entorno (si no le pasan nada, usa las reales)
  env.DATABASE_URL ||= env.POSTGRES_PRISMA_URL || env.POSTGRES_URL || "";
                                                         // "||=" = "si está vacía, completala con…". Si DATABASE_URL no existe, usa POSTGRES_PRISMA_URL, o POSTGRES_URL
  env.DATABASE_URL_UNPOOLED ||= env.POSTGRES_URL_NON_POOLING || env.DATABASE_URL;
                                                         // Lo mismo para la conexión directa; si no hay ninguna, usa la común
}                                                        // Fin
```

---

## `src/lib/dias.ts` — nombres de días y meses

```ts
export const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
                                                         // Lista de días. La posición es el número: DIAS[0] = "Domingo", DIAS[6] = "Sábado"
export const DIAS_PLURAL = ["Domingos", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábados"];
                                                         // En plural, para "Sábados · 9 a 13"
export const DIAS_CORTO = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"];
                                                         // Abreviados, para el encabezado del calendario
export const ORDEN_SEMANA = [1, 2, 3, 4, 5, 6, 0];       // Orden de la semana empezando el lunes (el domingo, 0, al final)
export const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
                                                         // Meses. MESES[0] = "Enero"
```

---

## `src/lib/tiempo.ts` — fechas y horas de Argentina

**El problema que resuelve:** el servidor de Vercel no está en Argentina, y la base guarda las horas en **UTC** (la hora "universal", 3 horas más que Argentina).
Estas funciones traducen entre "lo que ve la clienta" (hora argentina) y "lo que guarda la base" (UTC).

```ts
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
                                                         // Herramientas de fechas con zona horaria
import { es } from "date-fns/locale";                    // Idioma español (para "sábado", "octubre")

export const TZ = "America/Argentina/Buenos_Aires";      // La zona horaria de Argentina

export function aFechaUTC(fecha: string, hora: string): Date {
                                                         // "2026-10-03" + "09:30" (hora argentina) → la fecha en UTC que se guarda en la base
  return fromZonedTime(`${fecha}T${hora}:00`, TZ);       // Arma "2026-10-03T09:30:00" y lo interpreta como hora de Argentina
}                                                        // Fin

export function fechaISO(d: Date): string {              // Una fecha → "2026-10-03" (en hora argentina)
  return formatInTimeZone(d, TZ, "yyyy-MM-dd");          // yyyy = año, MM = mes, dd = día
}                                                        // Fin

export function horaAR(d: Date): string {                // Una fecha → "09:30" (en hora argentina)
  return formatInTimeZone(d, TZ, "HH:mm");               // HH = hora (0-23), mm = minutos
}                                                        // Fin

export function diaSemana(fecha: string): number {       // "2026-10-03" → número de día (0 = domingo … 6 = sábado)
  return Number(formatInTimeZone(aFechaUTC(fecha, "12:00"), TZ, "i")) % 7;
                                                         // "i" da 1 = lunes … 7 = domingo. "% 7" (resto de dividir por 7) convierte el 7 en 0. Se usa el mediodía para no tener problemas de zona horaria
}                                                        // Fin

export function sumarDias(fecha: string, dias: number): string {
                                                         // "2026-10-03" + 2 → "2026-10-05"
  const d = aFechaUTC(fecha, "12:00");                   // Toma el mediodía de esa fecha
  return fechaISO(new Date(d.getTime() + dias * 86_400_000));
                                                         // Le suma los días en milisegundos (86.400.000 ms = 1 día) y lo vuelve a texto
}                                                        // Fin

export function fechaLarga(d: Date): string {            // Una fecha → "sábado 3 de octubre"
  return formatInTimeZone(d, TZ, "EEEE d 'de' MMMM", { locale: es });
                                                         // EEEE = nombre del día, d = número, 'de' = texto fijo, MMMM = nombre del mes, en español
}                                                        // Fin

export function fechaHoraLarga(d: Date): string {        // Una fecha → "sábado 3 de octubre, 09:30 hs"
  return `${fechaLarga(d)}, ${horaAR(d)} hs`;            // Junta las dos funciones de arriba
}                                                        // Fin

export function horaAMinutos(hora: string): number {     // "09:30" → 570 (minutos desde la medianoche). Sirve para hacer cuentas con horas
  const [h, m] = hora.split(":").map(Number);            // Separa "09" y "30" y los convierte a número
  return h * 60 + m;                                     // 9 × 60 + 30 = 570
}                                                        // Fin
```

---

## `src/lib/formato.ts` — precios, duraciones, links de WhatsApp

```ts
import { DIAS_PLURAL, ORDEN_SEMANA } from "./dias";      // Nombres de días (ver arriba)

const pesos = new Intl.NumberFormat("es-AR", {           // Crea un "formateador" de números al estilo argentino…
  style: "currency",                                     // … como dinero…
  currency: "ARS",                                       // … en pesos argentinos…
  maximumFractionDigits: 0,                              // … sin centavos
});                                                      // Fin

export function formatPrecio(monto: number): string {    // 45000 → "$ 45.000"
  return pesos.format(monto);                            // Usa el formateador de arriba
}                                                        // Fin

export function formatDuracion(min: number): string {    // 90 → "1 h 30 min"
  if (min < 60) return `${min} min`;                     // Menos de una hora: "40 min"
  const h = Math.floor(min / 60);                        // Horas enteras (Math.floor = redondear para abajo): 90/60 = 1
  const m = min % 60;                                    // Minutos que sobran: 90 % 60 = 30
  return m ? `${h} h ${m} min` : `${h} h`;               // Si sobran minutos: "1 h 30 min"; si no: "1 h"
}                                                        // Fin

export function numeroWhatsapp(numero: string): string { // Convierte un celular argentino escrito de cualquier forma al formato de WhatsApp: 549 + área + número
  const internacional = /^\s*(\+|00)/.test(numero);      // ¿Empieza con "+" o "00"? (formato internacional)
  let d = numero.replace(/\D/g, "");                     // Se queda solo con los dígitos (\D = "todo lo que no es dígito", se borra)
  if (d.startsWith("00")) d = d.slice(2);                // Si empieza con 00, lo saca
  if (d.startsWith("54") && (internacional || d.length >= 12)) {
                                                         // Si empieza con 54 (Argentina) y es claramente internacional…
    d = d.slice(2);                                      // … saca el 54 (se vuelve a poner al final)
  } else if (internacional) {                            // Si es internacional pero NO de Argentina…
    return d;                                            // … lo deja como está
  }                                                      // Fin
  if (d.startsWith("0")) d = d.slice(1);                 // "011…" → "11…" (saca el 0 de larga distancia)
  if (d.startsWith("9")) d = d.slice(1);                 // "9 11…" → "11…" (saca el 9 de celular; se vuelve a poner al final)
  for (const area of [2, 3, 4]) {                        // Prueba códigos de área de 2, 3 y 4 dígitos (11, 351, 2944…)
    if (d.length === 12 && d.slice(area, area + 2) === "15") {
                                                         // Si tiene 12 dígitos y justo después del área hay un "15" (formato viejo: 11 15 6405 2481)…
      d = d.slice(0, area) + d.slice(area + 2);          // … saca ese "15"
      break;                                             // … y deja de probar
    }                                                    //
  }                                                      // Fin
  return d.length === 10 ? `549${d}` : d;                // Si quedó un número argentino de 10 dígitos, le agrega "549" adelante
}                                                        // Fin

export function linkWhatsapp(numero: string, texto?: string): string {
                                                         // Arma el link para abrir un chat de WhatsApp, con un mensaje ya escrito (opcional)
  const limpio = numeroWhatsapp(numero);                 // Número en formato WhatsApp
  const q = texto ? `?text=${encodeURIComponent(texto)}` : "";
                                                         // Si hay mensaje, lo agrega "codificado" (los espacios y acentos se escriben de forma segura para un link)
  return `https://wa.me/${limpio}${q}`;                  // Ej: https://wa.me/5491164052481?text=Hola…
}                                                        // Fin

export function linkInstagram(usuario: string): string { // Arma el link de Instagram
  if (usuario.startsWith("http")) return usuario;        // Si ya es un link, lo deja
  return `https://instagram.com/${usuario.replace(/^@/, "")}`;
                                                         // Si es "@usuario", saca la @ y arma el link
}                                                        // Fin

export function resumenHorarios(franjas: { diaSemana: number; horaInicio: string; horaFin: string }[]): string[] {
                                                         // Arma el texto de horarios para el pie de página: ["Sábados · 09:00 a 13:00 y 14:00 a 18:00"]
  const porDia = new Map<number, string>();              // Un "Map" es una tabla clave → valor. Acá: día → "09:00 a 13:00 y 14:00 a 18:00"
  for (const d of ORDEN_SEMANA) {                        // Por cada día, empezando el lunes…
    const del = franjas                                  // … de todas las franjas…
      .filter((f) => f.diaSemana === d)                  // … se queda con las de ese día…
      .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))
                                                         // … las ordena por hora de inicio…
      .map((f) => `${f.horaInicio} a ${f.horaFin}`);     // … y las convierte a texto "09:00 a 13:00"
    if (del.length) porDia.set(d, del.join(" y "));      // Si ese día tiene franjas, las une con " y " y las anota
  }                                                      // Fin
  const grupos = new Map<string, number[]>();            // Otra tabla: horario → lista de días que tienen ESE mismo horario
  for (const [d, h] of porDia) grupos.set(h, [...(grupos.get(h) ?? []), d]);
                                                         // Agrupa: si lunes y martes tienen el mismo horario, quedan juntos
  return [...grupos].map(([h, dias]) => `${dias.map((d) => DIAS_PLURAL[d]).join(", ")} · ${h}`);
                                                         // Arma el texto final: "Lunes, Martes · 09:00 a 13:00"
}                                                        // Fin
```

---

## `src/lib/sena.ts` — calcular la seña

```ts
import type { TipoSena } from "@prisma/client";          // Trae el tipo "TipoSena" (NINGUNA / PORCENTAJE / FIJO) del plano de la base

export function calcularSena(precio: number, tipo: TipoSena, valor: number): number {
                                                         // Calcula cuánto es la seña de un tratamiento
  if (tipo === "NINGUNA" || valor <= 0) return 0;        // Sin seña → 0
  if (tipo === "FIJO") return Math.min(valor, precio);   // Monto fijo, pero nunca más que el precio (Math.min = el menor de los dos)
  return Math.min(precio, Math.round((precio * Math.min(valor, 100)) / 100 / 100) * 100);
                                                         // Porcentaje: precio × % ÷ 100, redondeado a la centena ($4.537 → $4.500), y nunca más que el precio
}                                                        // Fin

export function senaPorTransferencia(cfg: { senaTipo: TipoSena; senaValor: number; cbu: string; alias: string }): boolean {
                                                         // ¿Hay que pedir seña? Solo si está configurada Y hay datos para transferir
  return cfg.senaTipo !== "NINGUNA" && cfg.senaValor > 0 && Boolean(cfg.cbu.trim() || cfg.alias.trim());
                                                         // Tipo distinto de NINGUNA, valor mayor a 0, y CBU o alias cargado. Si falta el CBU, no se le puede pedir que transfiera
}                                                        // Fin
```

---

## `src/lib/slots.ts` — calcular los horarios libres

**Es el cálculo más importante de la agenda.** Recibe las franjas de atención del día, los turnos y bloqueos ya ocupados y la duración del tratamiento.
Devuelve los horarios en los que el tratamiento **entra completo** sin pisar nada.

**Ejemplo:** franja de 9:00 a 13:00, tratamiento de 60 minutos, intervalo de 30.
Se prueban 9:00, 9:30, 10:00… hasta 12:00 (la última que termina a las 13:00). Las que pisan un turno ocupado se descartan.

```ts
import { aFechaUTC, horaAMinutos } from "./tiempo";      // Herramientas de fechas (ver arriba)

export interface Franja {                                // Describe una franja de atención:
  horaInicio: string;                                    //   desde ("09:00")
  horaFin: string;                                       //   hasta ("13:00")
}                                                        // Fin

export interface Ocupado {                               // Describe algo que ocupa la agenda (un turno o un bloqueo):
  inicio: Date;                                          //   cuándo empieza
  fin: Date;                                             //   cuándo termina
}                                                        // Fin

export interface ParametrosSlots {                       // Todo lo que necesita el cálculo:
  fecha: string;                                         //   el día ("2026-10-03")
  franjas: Franja[];                                     //   las franjas de atención de ese día
  duracionMin: number;                                   //   cuánto dura el tratamiento
  intervaloMin: number;                                  //   cada cuántos minutos se ofrecen horarios
  ocupados: Ocupado[];                                   //   los turnos y bloqueos de ese día
  minimoInicio: Date;                                    //   no ofrecer nada antes de este momento (anticipación mínima)
}                                                        // Fin

export function calcularSlots(p: ParametrosSlots): string[] {
                                                         // La función. Devuelve la lista de horarios libres: ["09:00", "09:30", …]
  const resultado = new Set<string>();                   // Un "Set" es una lista que no repite (si dos franjas dan el mismo horario, queda una vez)
  const paso = Math.max(5, p.intervaloMin);              // De a cuántos minutos avanzar (mínimo 5, para que no quede trabado)

  for (const franja of p.franjas) {                      // Por cada franja del día…
    const ini = horaAMinutos(franja.horaInicio);         // … su inicio en minutos (09:00 → 540)
    const fin = horaAMinutos(franja.horaFin);            // … su fin en minutos (13:00 → 780)

    for (let m = ini; m + p.duracionMin <= fin; m += paso) {
                                                         // Prueba cada horario: empieza en "ini", avanza de a "paso", y solo mientras el tratamiento termine antes del fin de la franja
      const hora = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
                                                         // Convierte minutos a texto: 570 → "09:30" (padStart agrega el 0 adelante: "9" → "09")
      const inicio = aFechaUTC(p.fecha, hora);           // Ese horario como fecha real
      const termina = new Date(inicio.getTime() + p.duracionMin * 60_000);
                                                         // A qué hora terminaría (inicio + duración)

      if (inicio < p.minimoInicio) continue;             // Si es demasiado pronto (antes de la anticipación mínima), lo salta ("continue" = pasar al siguiente)
      const pisa = p.ocupados.some((o) => inicio < o.fin && termina > o.inicio);
                                                         // ¿Se superpone con algo ocupado? Dos períodos se pisan si uno empieza antes de que el otro termine, y viceversa
      if (!pisa) resultado.add(hora);                    // Si no pisa nada → horario libre, se agrega
    }                                                    // Fin del recorrido de horarios
  }                                                      // Fin del recorrido de franjas

  return [...resultado].sort();                          // Devuelve los horarios ordenados ("09:00" antes que "10:00")
}                                                        // Fin
```

---

## `src/lib/config.ts` — la configuración del negocio

```ts
import { cache } from "react";                           // Para no consultar la base dos veces en la misma carga de página
import { prisma } from "./db";                           // La base

export const getConfig = cache(async () => {             // Devuelve la configuración del negocio (la fila 1)
  return prisma.configuracion.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
                                                         // Si existe la devuelve; si no existe, la crea con los valores por defecto del plano
});                                                      // Fin

export function siteUrl(): string {                      // Devuelve la dirección pública del sitio (para los links de los mails)
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
                                                         // Vercel avisa su dominio de producción en esta variable
  const url = process.env.NEXT_PUBLIC_SITE_URL || (vercel ? `https://${vercel}` : "http://localhost:3000");
                                                         // Usa la que configuraste; si no hay, la de Vercel; si tampoco, la de tu compu
  return url.replace(/\/$/, "");                         // Le saca la "/" del final si la tiene
}                                                        // Fin
```
