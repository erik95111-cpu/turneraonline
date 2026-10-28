# Capítulo 4 · Reservas y mails (el corazón del sistema)

Con la base y las herramientas listas, se escribe la **lógica del negocio**: cómo se reserva, cómo se confirma la seña, cómo se cancela y qué mails salen.
Todo esto corre **en el servidor**.

---

## `src/lib/turnos.ts` — reservar, confirmar seña, cancelar

### Un problema real: dos clientas, el mismo horario

¿Qué pasa si dos clientas tocan "Reservar" en el **mismo segundo** para el sábado a las 10? Sin cuidado, las dos quedarían anotadas.
La solución es una **transacción SERIALIZABLE**. Es un "paquete" de pasos que la base ejecuta como si nadie más estuviera usándola al mismo tiempo.
Si dos paquetes chocan, la base rechaza uno; el código lo **reintenta** y en el reintento ya ve el horario ocupado.

```ts
import "server-only";                                    // Candado: solo servidor
import { randomBytes } from "node:crypto";              // Para generar el token secreto del turno al azar
import { Prisma } from "@prisma/client";                 // Tipos y errores de Prisma
import { z } from "zod";                                 // Para validar los datos que llegan del formulario
import { prisma } from "./db";                           // La base
import { getConfig } from "./config";                    // La configuración del negocio
import { calcularSlots } from "./slots";                 // El cálculo de horarios libres (capítulo 3)
import { calcularSena, senaPorTransferencia } from "./sena";
                                                         // El cálculo de la seña (capítulo 3)
import { aFechaUTC, diaSemana, fechaISO, sumarDias } from "./tiempo";
                                                         // Herramientas de fechas (capítulo 3)
import { enviarMail } from "./email";                    // Para mandar mails (ver más abajo)
import { ErrorApp, logError } from "./log";              // Errores y registro con etiqueta
import {                                                 // Los textos de cada mail (ver más abajo):
  mailCancelacion,                                       //   turno cancelado
  mailConfirmacionClienta,                               //   turno confirmado (a la clienta)
  mailNuevaReservaProfesional,                           //   nueva reserva esperando seña (a la profesional)
  mailNuevoTurnoProfesional,                             //   nuevo turno confirmado (a la profesional)
  mailReservaPendienteClienta,                           //   "transferí la seña" (a la clienta)
} from "./plantillas-email";                             //

type Tx = Prisma.TransactionClient;                      // Apodo corto para "la base dentro de una transacción"

function esConflicto(err: unknown): boolean {            // ¿El error es un "choque" entre dos reservas simultáneas?
  return err instanceof Prisma.PrismaClientKnownRequestError && (err.code === "P2034" || err.code === "P2002");
                                                         // P2034 = la base rechazó la transacción por choque. P2002 = se intentó crear algo repetido (otra clienta igual al mismo tiempo)
}                                                        // Fin

async function transaccion<T>(fn: (tx: Tx) => Promise<T>, intentos = 4): Promise<T> {
                                                         // Ejecuta los pasos "fn" como un paquete seguro; si choca, reintenta hasta 4 veces. <T> = devuelve lo que devuelva fn
  for (let i = 1; ; i++) {                               // Repite (i = número de intento: 1, 2, 3…). Sin condición de corte: se sale con return o throw
    try {                                                // Intenta…
      return await prisma.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
                                                         // … ejecutar el paquete con el nivel más estricto (Serializable). Si sale bien, devuelve el resultado y termina
    } catch (err) {                                      // Si falló…
      if (!esConflicto(err) || i >= intentos) throw err; // … si no fue un choque, o ya se intentó 4 veces, se rinde y pasa el error para arriba
      await new Promise((r) => setTimeout(r, 20 * i + Math.random() * 50));
                                                         // … si fue un choque, espera un poquito (cada vez más, y un poco al azar para no volver a chocar) y reintenta
    }                                                    //
  }                                                      // Fin
}                                                        // Fin

function filtroOcupa(ahora: Date): Prisma.TurnoWhereInput {
                                                         // Arma el "filtro" de turnos que OCUPAN la agenda
  return {                                               //
    OR: [                                                // Ocupa si cumple alguna de estas condiciones ("OR" = o):
      { estado: { in: ["CONFIRMADO", "COMPLETADO", "AUSENTE"] } },
                                                         //   está confirmado, ya se hizo, o no vino (ese horario ya estaba tomado)
      { estado: "PENDIENTE_PAGO", expiraEn: { gt: ahora } },
                                                         //   o espera la seña y todavía no venció su plazo
    ],                                                   // Los cancelados y las reservas vencidas NO ocupan: ese horario vuelve a estar libre
  };                                                     //
}                                                        // Fin

export async function horariosDisponibles(               // Devuelve los horarios libres de un día para un tratamiento
  servicioId: string,                                    //   qué tratamiento
  fecha: string,                                         //   qué día ("2026-10-03")
  opciones: { db?: Tx; sinLimites?: boolean } = {},      //   opcional: usar una transacción, y "sin límites" (el panel puede reservar sin anticipación ni tope de días)
): Promise<string[]> {                                   // Devuelve ["09:00", "09:30", …]
  const db = opciones.db ?? prisma;                      // Si viene una transacción la usa; si no, la base común
  const cfg = await getConfig();                         // Lee la configuración
  const ahora = new Date();                              // La fecha y hora actual
  const hoy = fechaISO(ahora);                           // Hoy como texto
  const maxDias = opciones.sinLimites ? 366 : cfg.diasMaxReserva;
                                                         // Hasta cuántos días adelante: el panel hasta un año; la clienta, lo configurado (45)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || fecha < hoy || fecha > sumarDias(hoy, maxDias)) return [];
                                                         // Si la fecha tiene mal formato, ya pasó o está demasiado lejos → ningún horario

  const servicio = await db.servicio.findFirst({ where: { id: servicioId, activo: true } });
                                                         // Busca el tratamiento (solo si está activo)
  if (!servicio) return [];                              // Si no existe o está oculto → ningún horario

  const franjas = await db.horarioAtencion.findMany({ where: { diaSemana: diaSemana(fecha) } });
                                                         // Trae las franjas de atención de ese día de la semana
  if (!franjas.length) return [];                        // Si ese día no se atiende → ningún horario

  const desde = aFechaUTC(fecha, "00:00");               // Comienzo del día
  const hasta = aFechaUTC(sumarDias(fecha, 1), "00:00"); // Comienzo del día siguiente

  const [turnos, bloqueos] = await Promise.all([         // Trae dos cosas a la vez:
    db.turno.findMany({                                  //   los turnos…
      where: {                                           //   … que cumplan:
        inicio: { lt: hasta },                           //     empiezan antes de que termine el día ("lt" = menor que)
        fin: { gt: desde },                              //     y terminan después de que empiece ("gt" = mayor que) → o sea, tocan ese día
        ...filtroOcupa(ahora),                           //     y ocupan la agenda (filtro de arriba)
      },                                                 //
      select: { inicio: true, fin: true },               //   solo hace falta su inicio y fin
    }),                                                  //
    db.bloqueo.findMany({ where: { desde: { lt: hasta }, hasta: { gt: desde } }, select: { desde: true, hasta: true } }),
                                                         //   y los bloqueos (vacaciones, feriados) que tocan ese día
  ]);                                                    //

  return calcularSlots({                                 // Hace el cálculo (capítulo 3) con todo lo juntado:
    fecha,                                               //   el día
    franjas,                                             //   las franjas
    duracionMin: servicio.duracionMin,                   //   cuánto dura el tratamiento
    intervaloMin: cfg.intervaloMin,                      //   cada cuántos minutos ofrecer
    ocupados: [...turnos, ...bloqueos.map((b) => ({ inicio: b.desde, fin: b.hasta }))],
                                                         //   lo ocupado: turnos + bloqueos (a los bloqueos se les cambia el nombre de los campos para que tengan inicio/fin)
    minimoInicio: opciones.sinLimites ? ahora : new Date(ahora.getTime() + cfg.anticipacionMinHoras * 3_600_000),
                                                         //   desde cuándo: el panel desde ahora; la clienta, desde ahora + 3 horas (3.600.000 ms = 1 hora)
  });                                                    //
}                                                        // Fin

export const reservaSchema = z.object({                  // EL MOLDE de los datos de una reserva. Todo lo que llega del formulario se revisa contra esto
  servicioId: z.string().min(1),                         // Tratamiento: texto, no vacío
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),        // Fecha: con formato 2026-10-03
  hora: z.string().regex(/^\d{2}:\d{2}$/),               // Hora: con formato 09:30
  nombre: z.string().trim().min(2, "Ingresá tu nombre").max(80),
                                                         // Nombre: sin espacios en las puntas, entre 2 y 80 letras (si no, el mensaje "Ingresá tu nombre")
  email: z.string().trim().toLowerCase().email("Email inválido").max(120),
                                                         // Email: en minúsculas, con formato de email
  telefono: z.string().trim().min(6, "Ingresá un teléfono válido").max(30),
                                                         // Teléfono: entre 6 y 30 caracteres
  notas: z.string().trim().max(500).default(""),         // Comentarios: hasta 500 letras; si no viene, vacío
});                                                      // Fin

export type DatosReserva = z.infer<typeof reservaSchema>;
                                                         // El "tipo" de una reserva, sacado automáticamente del molde (no hay que escribirlo dos veces)

export class ErrorReserva extends ErrorApp {}            // Error ESPERADO de reservas ("ese horario ya no está"): su mensaje se le muestra a la clienta

const incluir = { clienta: true, servicio: true } as const;
                                                         // "Cuando traigas un turno, traé también su clienta y su tratamiento" (los mails los necesitan)

export async function crearReserva(                      // CREA UNA RESERVA
  datos: DatosReserva,                                   //   los datos ya revisados
  opciones: { porAdmin?: boolean; sinSena?: boolean } = {},
                                                         //   opcional: si la carga la profesional, y si es sin seña
): Promise<{ turnoId: string; token: string; pendienteSena: boolean }> {
                                                         // Devuelve el id del turno, su token secreto y si espera seña
  const cfg = await getConfig();                         // Lee la configuración
  const cobrarSena = !opciones.sinSena && senaPorTransferencia(cfg);
                                                         // ¿Se cobra seña? Solo si no se pidió "sin seña" y está configurada con datos para transferir

  const turno = await transaccion(async (tx) => {        // TODO lo que sigue va dentro del paquete seguro (transacción)
      const servicio = await tx.servicio.findFirst({ where: { id: datos.servicioId, activo: true } });
                                                         // Busca el tratamiento
      if (!servicio) throw new ErrorReserva("El tratamiento elegido no está disponible");
                                                         // Si no existe → error con mensaje para la clienta

      const libres = await horariosDisponibles(servicio.id, datos.fecha, { db: tx, sinLimites: opciones.porAdmin });
                                                         // Vuelve a calcular los horarios libres AHORA, dentro del paquete (alguien pudo haberlo tomado recién)
      if (!libres.includes(datos.hora)) {                // Si el horario elegido ya no está libre…
        throw new ErrorReserva("Ese horario ya no está disponible. Elegí otro, por favor.");
                                                         // … error con mensaje para la clienta
      }                                                  //

      const clienta = await tx.clienta.upsert({          // Busca la clienta por email; si no existe, la crea:
        where: { email: datos.email },                   //   buscar por email
        update: {},                                      //   si existe, no cambiar nada (sus datos los edita la profesional desde el panel)
        create: { nombre: datos.nombre, email: datos.email, telefono: datos.telefono },
                                                         //   si no existe, crearla con estos datos
      });                                                //

      const inicio = aFechaUTC(datos.fecha, datos.hora); // Fecha y hora de inicio, en UTC para guardar
      const montoSena = cobrarSena ? calcularSena(servicio.precio, cfg.senaTipo, cfg.senaValor) : 0;
                                                         // Cuánto es la seña (0 si no se cobra)
      const pendiente = montoSena > 0;                   // ¿Queda esperando la seña?
      const limite = Math.min(Date.now() + Math.max(1, cfg.horasParaSena) * 3_600_000, inicio.getTime());
                                                         // Hasta cuándo se guarda el horario: ahora + 24 horas, pero nunca después del turno mismo

      return tx.turno.create({                           // CREA EL TURNO en la base con:
        data: {                                          //
          clientaId: clienta.id,                         //   la clienta
          servicioId: servicio.id,                       //   el tratamiento
          inicio,                                        //   el inicio
          fin: new Date(inicio.getTime() + servicio.duracionMin * 60_000),
                                                         //   el fin (inicio + duración)
          precio: servicio.precio,                       //   el precio de hoy (congelado)
          montoSena,                                     //   la seña
          estado: pendiente ? "PENDIENTE_PAGO" : "CONFIRMADO",
                                                         //   el estado: esperando seña, o directamente confirmado
          expiraEn: pendiente ? new Date(limite) : null, //   el plazo para la seña (o nada)
          notasClienta: datos.notas,                     //   los comentarios
          creadoPorAdmin: Boolean(opciones.porAdmin),    //   si lo cargó la profesional
          token: randomBytes(24).toString("base64url"),  //   la llave secreta: 24 bytes al azar (imposible de adivinar)
        },                                               //
        include: incluir,                                //   y que lo devuelva con la clienta y el tratamiento
      });                                                //
  }).catch((err) => {                                    // Si el paquete falló del todo…
    if (esConflicto(err)) throw new ErrorReserva("Hay mucha demanda en este momento. Probá de nuevo en unos segundos.");
                                                         // … y fue por choques repetidos, mensaje amable
    throw err;                                           // … si fue otra cosa, pasa el error para arriba
  });                                                    //

  const pendienteSena = turno.estado === "PENDIENTE_PAGO";
                                                         // ¿Quedó esperando la seña?
  try {                                                  // PLAN B: los mails van en su propio try (el turno YA está guardado)
    const cfgActual = await getConfig();                 // Lee la configuración
    await Promise.all(                                   // Manda dos mails a la vez:
      pendienteSena                                      //   si espera seña →
        ? [enviarMail(mailReservaPendienteClienta(cfgActual, turno)), enviarMail(mailNuevaReservaProfesional(cfgActual, turno))]
                                                         //     "transferí la seña" a la clienta + aviso a la profesional
        : [enviarMail(mailConfirmacionClienta(cfgActual, turno)), enviarMail(mailNuevoTurnoProfesional(cfgActual, turno))],
                                                         //   si no → "turno confirmado" a la clienta + aviso a la profesional
    );                                                   //
  } catch (err) {                                        // Si fallan los mails…
    logError(`mails de la reserva ${turno.id}`, err);    //   … se anota, pero la reserva sigue valiendo (así no reserva dos veces)
  }                                                      //
  return { turnoId: turno.id, token: turno.token, pendienteSena };
                                                         // Devuelve los datos del turno
}                                                        // Fin

export async function confirmarSena(turnoId: string): Promise<void> {
                                                         // La profesional toca "Seña recibida" en el panel
  const turno = await transaccion(async (tx) => {        // Dentro de un paquete seguro:
    const t = await tx.turno.findUnique({ where: { id: turnoId } });
                                                         //   busca el turno
    if (!t || t.estado !== "PENDIENTE_PAGO") throw new ErrorReserva("Este turno ya no está esperando la seña");
                                                         //   si no existe o no estaba esperando la seña → error

    const choque =                                       //   ¿Hay algo que choque con ese horario? Suma:
      (await tx.turno.count({                            //     turnos que…
        where: { id: { not: t.id }, inicio: { lt: t.fin }, fin: { gt: t.inicio }, ...filtroOcupa(new Date()) },
                                                         //     … no sean este, se superpongan y ocupen la agenda
      })) +                                              //     más…
      (await tx.bloqueo.count({ where: { desde: { lt: t.fin }, hasta: { gt: t.inicio } } }));
                                                         //     … bloqueos que se superpongan
    if (choque) {                                        //   Si hay choque (la reserva había vencido y alguien tomó el horario)…
      throw new ErrorReserva("No se puede confirmar: la reserva había vencido y ese horario ya está ocupado. Coordiná otro horario con la clienta.");
                                                         //   … error con explicación para la profesional
    }                                                    //

    return tx.turno.update({                             //   Si todo bien, actualiza el turno:
      where: { id: t.id },                               //     este turno
      data: { estado: "CONFIRMADO", pagoEstado: "transferencia", expiraEn: null },
                                                         //     confirmado, pagado por transferencia, sin plazo
      include: incluir,                                  //     con clienta y tratamiento (para el mail)
    });                                                  //
  });                                                    // Fin del paquete
  try {                                                  // PLAN B para el mail:
    await enviarMail(mailConfirmacionClienta(await getConfig(), turno));
                                                         //   manda "turno confirmado" a la clienta
  } catch (err) {                                        //   si falla…
    logError(`mail de seña confirmada ${turno.id}`, err);
                                                         //   … se anota; la seña ya quedó confirmada igual
  }                                                      //
}                                                        // Fin

export async function cancelarTurno(turnoId: string, por: "clienta" | "admin"): Promise<void> {
                                                         // Cancela un turno. "por" = quién cancela
  const cfg = await getConfig();                         // Lee la configuración
  const turno = await prisma.turno.findUnique({ where: { id: turnoId }, include: incluir });
                                                         // Busca el turno
  if (!turno || !["CONFIRMADO", "PENDIENTE_PAGO"].includes(turno.estado)) {
                                                         // Si no existe, o ya está cancelado o realizado…
    throw new ErrorReserva("Este turno ya no se puede cancelar");
                                                         // … error
  }                                                      //
  if (por === "clienta" && turno.estado === "CONFIRMADO") {
                                                         // Si cancela la clienta un turno confirmado…
    const limite = turno.inicio.getTime() - cfg.horasParaCancelar * 3_600_000;
                                                         // … calcula hasta cuándo puede (inicio − 24 horas)
    if (Date.now() > limite) {                           // … si ya pasó ese límite…
      throw new ErrorReserva(                            // … no la deja, con este mensaje:
        `Sólo se puede cancelar online hasta ${cfg.horasParaCancelar} hs antes. Escribinos por WhatsApp.`,
      );                                                 //
    }                                                    //
  }                                                      // (La profesional puede cancelar siempre)
  const eraConfirmado = turno.estado === "CONFIRMADO";   // Anota si estaba confirmado (para saber si mandar mails)
  const r = await prisma.turno.updateMany({              // Lo cancela, PERO solo si…
    where: { id: turno.id, estado: turno.estado },       // … sigue en el mismo estado que cuando lo leímos (si justo se confirmó la seña, no se pisa)
    data: { estado: "CANCELADO" },                       // … y le pone estado CANCELADO
  });                                                    //
  if (!r.count) throw new ErrorReserva("El turno cambió de estado. Recargá la página.");
                                                         // Si no cambió ninguna fila (otro lo modificó en el medio) → error

  if (eraConfirmado) {                                   // Si estaba confirmado, avisa por mail:
    try {                                                //   (con plan B)
      await Promise.all([                                //   dos mails a la vez:
        enviarMail(mailCancelacion(cfg, turno, "clienta")),
                                                         //     a la clienta
        enviarMail(mailCancelacion(cfg, turno, "profesional")),
                                                         //     a la profesional
      ]);                                                //
    } catch (err) {                                      //   si fallan…
      logError(`mails de cancelación ${turno.id}`, err); //   … se anota
    }                                                    //
  }                                                      //
}                                                        // Fin
```

---

## `src/lib/email.ts` — el cartero

```ts
import "server-only";                                    // Candado: solo servidor (acá se usa la contraseña de Gmail)
import nodemailer from "nodemailer";                     // La biblioteca que manda mails
import { logError, logWarn } from "./log";               // Registro con etiqueta
import type { Transporter } from "nodemailer";           // El tipo "Transporter": la conexión con el servidor de mail

let transporter: Transporter | null | undefined;         // Acá se guarda la conexión. undefined = todavía no se armó; null = no hay mail configurado

function getTransporter(): Transporter | null {          // Arma (una sola vez) la conexión con Gmail
  if (transporter !== undefined) return transporter;     // Si ya se armó antes, la reusa
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
                                                         // Lee las 4 variables de mail de Vercel
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {          // Si falta alguna…
    transporter = null;                                  // … anota "no hay mail"
    return null;                                         // … y devuelve nada
  }                                                      //
  const port = Number(SMTP_PORT || 465);                 // El puerto (465 si no se dijo otro)
  transporter = nodemailer.createTransport({             // Crea la conexión con:
    host: SMTP_HOST,                                     //   el servidor (smtp.gmail.com)
    port,                                                //   el puerto
    secure: port === 465,                                //   cifrada si es el puerto 465
    auth: { user: SMTP_USER.trim(), pass: SMTP_PASS.replace(/\s+/g, "") },
                                                         //   usuario y contraseña. A la contraseña se le sacan los espacios (Gmail la muestra "xxxx xxxx xxxx xxxx")
  });                                                    //
  return transporter;                                    // Devuelve la conexión
}                                                        // Fin

export interface Mail {                                  // Cómo es un mail:
  to: string;                                            //   para quién
  subject: string;                                       //   asunto
  html: string;                                          //   el contenido con diseño (HTML)
  text: string;                                          //   el contenido en texto simple (para programas de mail viejos)
  attachments?: { filename: string; content: string; contentType: string }[];
                                                         //   adjuntos, opcional (ej: el archivo para agregar al calendario)
}                                                        // Fin

export async function enviarMail(mail: Mail): Promise<boolean> {
                                                         // Manda un mail. Devuelve true si salió. NUNCA tira error (un mail fallido no puede romper una reserva)
  if (!mail.to) return false;                            // Sin destinatario (ej: la profesional no cargó su email) → no manda
  const t = getTransporter();                            // Pide la conexión
  if (!t) {                                              // Si no hay mail configurado…
    logWarn(`email desactivado (faltan SMTP_*) · para ${mail.to} | ${mail.subject}`);
                                                         // … deja un aviso en el log con lo que se hubiera mandado
    return false;                                        // … y devuelve "no salió"
  }                                                      //
  try {                                                  // Intenta…
    await t.sendMail({ from: process.env.EMAIL_FROM || process.env.SMTP_USER, ...mail });
                                                         // … mandarlo, con el remitente configurado y todos los datos del mail
    return true;                                         // … salió
  } catch (err) {                                        // Si falló…
    logError(`email a ${mail.to}`, err);                 // … se anota (aparece como [LIB:nodemailer] = problema de Gmail, no del código)
    return false;                                        // … y devuelve "no salió"
  }                                                      //
}                                                        // Fin

export async function probarEnvio(para: string): Promise<{ ok: boolean; mensaje: string }> {
                                                         // Para el botón "Enviar mail de prueba" del panel: explica claro qué falla
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
                                                         // Lee las variables
  const faltan = [!SMTP_HOST && "SMTP_HOST", !SMTP_USER && "SMTP_USER", !SMTP_PASS && "SMTP_PASS"].filter(Boolean);
                                                         // Arma la lista de las que faltan (filter(Boolean) saca las que sí están)
  if (faltan.length) {                                   // Si falta alguna…
    return { ok: false, mensaje: `Faltan en Vercel las variables: ${faltan.join(", ")}. Cargalas y hacé Redeploy.` };
                                                         // … dice cuáles
  }                                                      //
  const t = getTransporter();                            // Pide la conexión
  if (!t) return { ok: false, mensaje: "El envío de mails no está configurado." };
                                                         // Si no hay, avisa
  try {                                                  // Intenta…
    await t.verify();                                    // … conectarse y loguearse en Gmail, sin mandar nada
  } catch (err) {                                        // Si falla…
    const texto = String((err as Error).message ?? err); // … toma el mensaje del error
    if (/535|Username and Password not accepted|Invalid login/i.test(texto)) {
                                                         // … si es el error típico de usuario/contraseña de Gmail…
      return {                                           // … explica cómo arreglarlo:
        ok: false,                                       //
        mensaje: "Gmail rechazó el usuario o la contraseña. Revisá que SMTP_USER sea el Gmail completo y SMTP_PASS la contraseña de aplicación de 16 letras (no la contraseña normal).",
      };                                                 //
    }                                                    //
    return { ok: false, mensaje: `No se pudo conectar con el servidor de mail: ${texto}` };
                                                         // … si es otro error, lo muestra tal cual
  }                                                      //
  try {                                                  // Si se conectó bien, intenta…
    await t.sendMail({                                   // … mandar el mail de prueba:
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
                                                         //   remitente
      to: para,                                          //   destinatario (el que escribió la profesional)
      subject: "Prueba de mail · Turnos online",         //   asunto
      text: "¡Funciona! Los mails de los turnos se van a enviar desde esta cuenta.",
                                                         //   texto simple
      html: "<p style=\"font:15px Arial,sans-serif\">¡Funciona! Los mails de los turnos se van a enviar desde esta cuenta.</p>",
                                                         //   el mismo texto con formato
    });                                                  //
    return { ok: true, mensaje: `Mail de prueba enviado a ${para}. Si no lo ves, revisá Spam.` };
                                                         // … salió bien
  } catch (err) {                                        // Si el envío falló…
    return { ok: false, mensaje: `La conexión anduvo pero el envío falló: ${(err as Error).message}` };
                                                         // … lo explica
  }                                                      //
}                                                        // Fin
```

---

## `src/lib/plantillas-email.ts` — el texto y el diseño de cada mail

**Cómo leer este archivo:** los mails se escriben en HTML (el idioma de las páginas web), dentro de comillas invertidas `` ` ``.
Todo lo que está entre comillas invertidas es **texto del mail**; `${…}` mete un dato adentro.
En la guía, los `//` de esas líneas son solo explicación: en el archivo real no van.

**Por qué los mails usan tablas (`<table>`):** los programas de mail (Gmail, Outlook) son muy viejos para el diseño. La forma segura de que se vean bien en todos es armar el diseño con tablas y con los estilos escritos en cada elemento.

```ts
import type { Clienta, Configuracion, Servicio, Turno } from "@prisma/client";
                                                         // Los tipos de las fichas de la base
import { formatDuracion, formatPrecio, linkWhatsapp } from "./formato";
                                                         // Formatos de precio, duración y WhatsApp (capítulo 3)
import { fechaHoraLarga } from "./tiempo";               // "sábado 3 de octubre, 09:30 hs"
import { siteUrl } from "./config";                      // La dirección del sitio (para el logo y los links)
import type { Mail } from "./email";                     // Cómo es un mail

type TurnoCompleto = Turno & { clienta: Clienta; servicio: Servicio };
                                                         // Un turno CON su clienta y su tratamiento incluidos

const esc = (s: string) =>                               // "Escapar" texto: convierte símbolos especiales para que no se interpreten como HTML
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
                                                         // SEGURIDAD: si una clienta escribe "<script>" en su nombre, en el mail aparece como texto y no se ejecuta

function layout(cfg: Configuracion, titulo: string, cuerpo: string): string {
                                                         // El "marco" que comparten todos los mails: fondo, logo arriba, título, contenido y pie
  return `<!doctype html><html><body style="margin:0;background:#f4f1ec;font-family:Georgia,'Times New Roman',serif;color:#1a1714">
                                                         // Empieza el HTML: fondo crema, letra Georgia, texto casi negro
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ec;padding:24px 12px"><tr><td align="center">
                                                         // Tabla de fondo, ancho completo, contenido centrado
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden">
                                                         // La "tarjeta" blanca, de 560 px máximo, con puntas redondeadas
<tr><td style="background:#0b0a0c;padding:28px;text-align:center">
                                                         // Franja negra de arriba
<img src="${siteUrl()}/logo.png" width="96" height="96" alt="${esc(cfg.nombreNegocio)}" style="border-radius:50%">
                                                         // El logo redondo (se carga desde la página)
</td></tr>                                               // Fin de la franja
<tr><td style="padding:32px 28px">                       // Zona del contenido
<h1 style="margin:0 0 16px;font-size:22px;font-weight:normal;color:#8a6d3b">${titulo}</h1>
                                                         // El título, en dorado
${cuerpo}                                                // Acá va el contenido propio de cada mail
</td></tr>                                               // Fin del contenido
<tr><td style="padding:18px 28px;border-top:1px solid #eee;font:12px Arial,sans-serif;color:#888;text-align:center">
                                                         // Pie de página, letra chica gris
${esc(cfg.nombreNegocio)}${cfg.direccion ? ` · ${esc(cfg.direccion)}` : ""}${cfg.whatsapp ? ` · WhatsApp ${esc(cfg.whatsapp)}` : ""}
                                                         // Nombre del negocio, y si están cargados, dirección y WhatsApp
</td></tr></table></td></tr></table></body></html>`;     // Cierra todo
}                                                        // Fin

function detalle(t: TurnoCompleto): string {             // La tablita con los datos del turno
  const fila = (k: string, v: string) =>                 // Mini función que arma una fila: título a la izquierda, valor a la derecha
    `<tr><td style="padding:6px 0;color:#888;font:14px Arial,sans-serif;width:120px">${k}</td><td style="padding:6px 0;font:15px Arial,sans-serif">${v}</td></tr>`;
  return `<table cellpadding="0" cellspacing="0" style="width:100%;margin:16px 0;border-top:1px solid #eee;border-bottom:1px solid #eee">
                                                         // La tabla, con una línea arriba y otra abajo
${fila("Tratamiento", esc(t.servicio.nombre))}           // Fila: tratamiento
${fila("Fecha", esc(fechaHoraLarga(t.inicio)))}          // Fila: fecha y hora
${fila("Duración", formatDuracion(t.servicio.duracionMin))}
                                                         // Fila: duración
${fila("Precio", formatPrecio(t.precio))}                // Fila: precio
${t.montoSena ? fila(t.estado === "PENDIENTE_PAGO" ? "Seña a transferir" : "Seña abonada", formatPrecio(t.montoSena)) : ""}
                                                         // Fila de la seña, solo si hay: dice "a transferir" o "abonada" según el estado
</table>`;                                               // Fin de la tabla
}                                                        // Fin

function boton(href: string, texto: string): string {    // Arma un botón (en realidad, un link con forma de botón)
  return `<p style="margin:24px 0"><a href="${href}" style="background:#0b0a0c;color:#e6cf9f;padding:12px 22px;border-radius:999px;text-decoration:none;font:14px Arial,sans-serif;letter-spacing:.5px">${texto}</a></p>`;
                                                         // Fondo negro, letra dorada, puntas totalmente redondas
}                                                        // Fin

function p(texto: string): string {                      // Arma un párrafo con el estilo de los mails
  return `<p style="font:15px/1.6 Arial,sans-serif;margin:0 0 12px">${texto}</p>`;
}                                                        // Fin

function textoPlano(t: TurnoCompleto): string {          // Los datos del turno en texto simple (para la versión sin diseño)
  return [                                               // Una lista de renglones:
    `Tratamiento: ${t.servicio.nombre}`,                 //
    `Fecha: ${fechaHoraLarga(t.inicio)}`,                //
    `Duración: ${formatDuracion(t.servicio.duracionMin)}`,
                                                         //
    `Precio: ${formatPrecio(t.precio)}`,                 //
    t.montoSena ? `${t.estado === "PENDIENTE_PAGO" ? "Seña a transferir" : "Seña abonada"}: ${formatPrecio(t.montoSena)}` : "",
                                                         // La seña, solo si hay
  ].filter(Boolean).join("\n");                          // Saca los renglones vacíos y los une con saltos de línea
}                                                        // Fin

export function linkTurno(t: Turno): string {            // El link para que la clienta vea o cancele su turno
  return `${siteUrl()}/reserva/${t.id}?t=${t.token}`;    // Dirección del sitio + /reserva/<id>?t=<token secreto>
}                                                        // Fin

export function archivoIcs(cfg: Configuracion, t: TurnoCompleto): string {
                                                         // Arma el archivo .ics (el formato universal de calendario): tocándolo, el turno se agrega al calendario del celular
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
                                                         // Formato de fecha que pide el .ics: "20261003T123000Z" (sin guiones, dos puntos ni milisegundos)
  return [                                               // Renglones del archivo:
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Healthy Skin//Turnos//ES", "METHOD:PUBLISH",
                                                         // Encabezado obligatorio del formato
    "BEGIN:VEVENT",                                      // Empieza el evento
    `UID:${t.id}@healthyskin`,                           // Identificador único del evento
    `DTSTAMP:${f(new Date())}`,                          // Cuándo se generó
    `DTSTART:${f(t.inicio)}`,                            // Inicio del turno
    `DTEND:${f(t.fin)}`,                                 // Fin del turno
    `SUMMARY:${t.servicio.nombre} - ${cfg.nombreNegocio}`,
                                                         // Título que se ve en el calendario
    cfg.direccion ? `LOCATION:${cfg.direccion}` : "",    // Lugar, si hay dirección
    `DESCRIPTION:Ver o cancelar: ${linkTurno(t)}`,       // Descripción, con el link al turno
    "END:VEVENT", "END:VCALENDAR",                       // Cierre obligatorio
  ].filter(Boolean).join("\r\n");                        // Saca los vacíos y une con el salto de línea que exige el formato
}                                                        // Fin

export function mailConfirmacionClienta(cfg: Configuracion, t: TurnoCompleto): Mail {
                                                         // MAIL: "¡Tu turno está confirmado!" (a la clienta)
  const nombre = esc(t.clienta.nombre.split(" ")[0]);    // Solo el primer nombre ("Lucía Gómez" → "Lucía")
  const html = layout(cfg, "¡Tu turno está confirmado!", `
                                                         // Usa el marco con este título y este contenido:
${p(`Hola ${nombre}, te esperamos para tu sesión. Estos son los datos de tu reserva:`)}
                                                         //   saludo
${detalle(t)}                                            //   tablita con los datos
${cfg.direccion ? p(`📍 <strong>Dirección:</strong> ${esc(cfg.direccion)}`) : ""}
                                                         //   dirección, si hay
${p("Te recomendamos llegar 5 minutos antes y venir sin maquillaje en el rostro.")}
                                                         //   recomendación
${boton(linkTurno(t), "Ver o cancelar mi turno")}        //   botón al turno
${cfg.politicaCancelacion ? `<p style="font:12px/1.5 Arial,sans-serif;color:#888">${esc(cfg.politicaCancelacion)}</p>` : ""}`);
                                                         //   política de cancelación en letra chica, si hay
  return {                                               // Devuelve el mail armado:
    to: t.clienta.email,                                 //   para la clienta
    subject: `Turno confirmado · ${t.servicio.nombre} · ${fechaHoraLarga(t.inicio)}`,
                                                         //   asunto
    html,                                                //   el diseño de arriba
    text: `Hola ${t.clienta.nombre}, tu turno está confirmado.\n\n${textoPlano(t)}\n\nVer o cancelar: ${linkTurno(t)}`,
                                                         //   versión de texto simple ("\n" = salto de línea)
    attachments: [{ filename: "turno.ics", content: archivoIcs(cfg, t), contentType: "text/calendar" }],
                                                         //   adjunto: el archivo para el calendario
  };                                                     //
}                                                        // Fin
```

Los demás mails siguen **exactamente el mismo patrón**: `layout(…)` con un título, el contenido armado con `p(…)`, `detalle(t)` y `boton(…)`, y al final `{ to, subject, html, text }`.

| Función | Cuándo sale | Para quién | Qué dice |
|---|---|---|---|
| `mailNuevoTurnoProfesional` | Turno confirmado sin seña | Profesional | Quién reservó, datos del turno, email y WhatsApp de la clienta, su comentario, botón "Abrir la agenda" |
| `mailCancelacion` | Se cancela un turno confirmado | Clienta **o** profesional (`para`) | "Tu turno fue cancelado" / "Se canceló el turno de…", con botón "Reservar otro turno" solo para la clienta |
| `mailRecordatorio` | El día anterior (cron) | Clienta | "Te esperamos mañana" con los datos y el botón al turno |
| `mailReservaPendienteClienta` | Reserva que espera seña | Clienta | Datos para transferir (alias, CBU, titular, banco), plazo y botón para mandar el comprobante por WhatsApp |
| `mailNuevaReservaProfesional` | Reserva que espera seña | Profesional | Quién reservó y "cuando llegue la captura, tocá *Seña recibida*" |

Y dos funciones auxiliares:

```ts
export function mensajeComprobante(t: TurnoCompleto): string {
                                                         // El mensaje que se escribe solo en WhatsApp cuando la clienta toca "Enviar comprobante"
  return `Hola! Te envío el comprobante de la seña de mi turno:\n${t.servicio.nombre} - ${fechaHoraLarga(t.inicio)}\nA nombre de: ${t.clienta.nombre}`;
                                                         // Así la profesional sabe de qué turno es la transferencia
}                                                        // Fin

function datosTransferencia(cfg: Configuracion, t: TurnoCompleto): string {
                                                         // Cuadro con los datos para transferir la seña
  const fila = (k: string, v: string) =>                 // Arma una fila…
    v ? `<tr><td style="padding:5px 0;color:#888;font:14px Arial,sans-serif;width:120px">${k}</td><td style="padding:5px 0;font:15px Arial,sans-serif"><strong>${esc(v)}</strong></td></tr>` : "";
                                                         // … solo si el dato está cargado (si no, nada)
  return `<table cellpadding="0" cellspacing="0" style="width:100%;margin:8px 0 16px;background:#fbf7ef;border-radius:8px;padding:8px 12px">
                                                         // Cuadro con fondo crema
${fila("Monto", formatPrecio(t.montoSena))}              // Monto de la seña
${fila("Alias", cfg.alias)}                              // Alias
${fila("CBU / CVU", cfg.cbu)}                            // CBU
${fila("Titular", cfg.titularCuenta)}                    // Titular
${fila("Banco", cfg.banco)}                              // Banco
</table>`;                                               // Fin
}                                                        // Fin
```

---

## `src/app/api/cron/recordatorios/route.ts` — los recordatorios automáticos

Vercel llama a esta dirección todos los días a las 10:00 (ver `vercel.json`, capítulo 1).

```ts
import { NextResponse } from "next/server";              // Para armar la respuesta
import { prisma } from "@/lib/db";                       // La base
import { getConfig } from "@/lib/config";                // La configuración
import { enviarMail } from "@/lib/email";                // El cartero
import { mailRecordatorio } from "@/lib/plantillas-email";
                                                         // El texto del recordatorio
import { logError } from "@/lib/log";                    // Registro con etiqueta
import { igualesSeguro } from "@/lib/passwords";         // Comparación segura
import { aFechaUTC, fechaISO, sumarDias } from "@/lib/tiempo";
                                                         // Herramientas de fechas

export async function GET(req: Request) {                // Responde cuando Vercel llama a esta dirección
  const secreto = process.env.CRON_SECRET;               // Lee la clave que solo conoce Vercel
  if (!secreto || !igualesSeguro(req.headers.get("authorization") ?? "", `Bearer ${secreto}`)) {
                                                         // Si no hay clave configurada, o quien llama no la trae (no es Vercel)…
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
                                                         // … lo rechaza (401 = no autorizado). Así nadie puede disparar mails de más
  }                                                      //

  const manana = sumarDias(fechaISO(new Date()), 1);     // La fecha de mañana
  const turnos = await prisma.turno.findMany({           // Busca los turnos…
    where: {                                             //   que cumplan:
      estado: "CONFIRMADO",                              //     estén confirmados
      recordatorioEnviado: false,                        //     todavía no tengan recordatorio
      inicio: { gte: aFechaUTC(manana, "00:00"), lt: aFechaUTC(sumarDias(manana, 1), "00:00") },
                                                         //     y sean mañana (desde las 00:00 de mañana hasta las 00:00 de pasado). "gte" = mayor o igual
    },                                                   //
    include: { clienta: true, servicio: true },          //   con clienta y tratamiento
  });                                                    //

  const cfg = await getConfig();                         // Lee la configuración
  let enviados = 0;                                      // Contador de enviados
  let fallidos = 0;                                      // Contador de fallidos
  for (const t of turnos) {                              // Por cada turno de mañana…
    try {                                                //   (PLAN B: si falla uno, sigue con los demás)
      if (await enviarMail(mailRecordatorio(cfg, t))) {  //   … manda el recordatorio; si salió…
        await prisma.turno.update({ where: { id: t.id }, data: { recordatorioEnviado: true } });
                                                         //     … anota que ya se mandó (así no se repite)
        enviados++;                                      //     … y suma uno a enviados ("++" = sumar 1)
      } else fallidos++;                                 //   si no salió, suma uno a fallidos
    } catch (err) {                                      //   si algo explotó…
      logError(`recordatorio ${t.id}`, err);             //     … se anota
      fallidos++;                                        //     … y cuenta como fallido
    }                                                    //
  }                                                      // Fin
  return NextResponse.json({ revisados: turnos.length, enviados, fallidos });
                                                         // Responde un resumen: cuántos revisó, cuántos mandó y cuántos fallaron (se ve en Vercel)
}                                                        // Fin
```
