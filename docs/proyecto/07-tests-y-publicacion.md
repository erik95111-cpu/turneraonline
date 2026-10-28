# Capítulo 7 · Las pruebas y la publicación

El último paso de construir algo es **comprobar que funciona** y **publicarlo**.

---

## ¿Qué es un test?

Un **test** es un pedacito de código que usa el código real y comprueba que el resultado sea el esperado.
Se corren con `npm test`. Si alguien cambia algo y rompe un cálculo, el test lo avisa **antes** de que llegue a las clientas.

| Palabra | Qué hace |
|---|---|
| `describe("nombre", () => {…})` | Agrupa pruebas de un mismo tema |
| `it("qué debería pasar", () => {…})` | Una prueba. El texto describe lo que se comprueba |
| `expect(x).toBe(y)` | "Espero que x sea exactamente y" |
| `expect(x).toEqual([…])` | "Espero que x tenga este contenido" (para listas y objetos) |
| `expect(x).toContain(y)` | "Espero que la lista x incluya y" |
| `.not.` | Lo contrario: `expect(x).not.toContain(y)` |
| `expect(promesa).rejects.toThrow(…)` | "Espero que esto FALLE con tal error" |
| `beforeAll` / `beforeEach` | Preparar algo antes de todas las pruebas / antes de cada una |
| `afterAll` | Limpiar al final |
| `vi.mock(…)` | Reemplazar una pieza por una de mentira (ej: no mandar mails de verdad durante las pruebas) |

Hay **dos tipos** de pruebas en el proyecto:
- **Unitarias:** prueban funciones sueltas, sin base de datos (`slots.test.ts`, partes de `auth.test.ts` y `seguridad.test.ts`). Corren siempre.
- **De integración:** usan una base de datos **de prueba**, que se borra en cada corrida (`turnos.test.ts`, partes de `auth.test.ts` y `seguridad.test.ts`). Solo corren si existe la variable `TEST_DATABASE_URL`. En GitHub corren siempre.

---

## `src/lib/slots.test.ts` — pruebas de los cálculos (completo)

```ts
import { describe, expect, it } from "vitest";           // Herramientas de prueba
import { calcularSlots } from "./slots";                 // Lo que se prueba: horarios libres
import { aFechaUTC, diaSemana, sumarDias } from "./tiempo";
                                                         // Lo que se prueba: fechas
import { calcularSena, senaPorTransferencia } from "./sena";
                                                         // Lo que se prueba: seña

const base = {                                           // Datos base para las pruebas de horarios:
  fecha: "2026-10-05",                                   //   un lunes
  franjas: [{ horaInicio: "09:00", horaFin: "12:00" }],  //   atención de 9 a 12
  intervaloMin: 30,                                      //   cada 30 minutos
  ocupados: [],                                          //   nada ocupado
  minimoInicio: new Date(0),                             //   sin anticipación mínima (la fecha 0 es del año 1970)
};                                                       //

describe("calcularSlots", () => {                        // GRUPO: horarios libres
  it("genera horarios que entran completos en la franja", () => {
    expect(calcularSlots({ ...base, duracionMin: 60 })).toEqual([
                                                         // Tratamiento de 60 min entre 9 y 12…
      "09:00", "09:30", "10:00", "10:30", "11:00",       // … el último es 11:00 (termina justo a las 12). 11:30 NO entra
    ]);                                                  //
  });                                                    //

  it("excluye horarios que se superponen con turnos ocupados", () => {
    const ocupados = [{ inicio: aFechaUTC(base.fecha, "10:00"), fin: aFechaUTC(base.fecha, "11:00") }];
                                                         // Un turno ocupado de 10 a 11
    expect(calcularSlots({ ...base, duracionMin: 60, ocupados })).toEqual(["09:00", "11:00"]);
                                                         // Quedan solo 9:00 (termina a las 10) y 11:00 (empieza cuando termina el otro)
  });                                                    //

  it("respeta la anticipación mínima", () => {           //
    const minimoInicio = aFechaUTC(base.fecha, "10:15"); // No se puede reservar antes de las 10:15
    expect(calcularSlots({ ...base, duracionMin: 30, minimoInicio })).toEqual(["10:30", "11:00", "11:30"]);
                                                         // El primero disponible es 10:30
  });                                                    //

  it("combina varias franjas sin duplicar", () => {      //
    const franjas = [                                    // Dos franjas:
      { horaInicio: "09:00", horaFin: "10:00" },         //   de 9 a 10
      { horaInicio: "15:00", horaFin: "16:00" },         //   de 15 a 16
    ];                                                   //
    expect(calcularSlots({ ...base, franjas, duracionMin: 60 })).toEqual(["09:00", "15:00"]);
                                                         // Un horario en cada una
  });                                                    //
});                                                      //

describe("tiempo", () => {                               // GRUPO: fechas
  it("interpreta las horas en zona horaria de Argentina", () => {
    expect(aFechaUTC("2026-10-05", "09:00").toISOString()).toBe("2026-10-05T12:00:00.000Z");
                                                         // Las 9 de Argentina son las 12 en UTC (3 horas más)
  });                                                    //
  it("calcula el día de la semana", () => {              //
    expect(diaSemana("2026-10-05")).toBe(1); // lunes
    expect(diaSemana("2026-10-04")).toBe(0); // domingo
  });                                                    //
  it("suma días cruzando meses", () => {                 //
    expect(sumarDias("2026-10-31", 1)).toBe("2026-11-01");
                                                         // 31 de octubre + 1 = 1 de noviembre
  });                                                    //
});                                                      //

describe("calcularSena", () => {                         // GRUPO: seña
  it("calcula porcentaje redondeado a la centena", () => {
    expect(calcularSena(35_000, "PORCENTAJE", 30)).toBe(10_500);
                                                         // 30% de 35.000 = 10.500
    expect(calcularSena(33_333, "PORCENTAJE", 30)).toBe(10_000);
                                                         // 30% de 33.333 = 9.999,9 → redondeado a 10.000
  });                                                    //
  it("no supera el precio con monto fijo", () => {       //
    expect(calcularSena(5_000, "FIJO", 10_000)).toBe(5_000);
                                                         // Seña fija de 10.000 sobre un tratamiento de 5.000 → 5.000
  });                                                    //
  it("devuelve 0 sin seña", () => {                      //
    expect(calcularSena(35_000, "NINGUNA", 30)).toBe(0); //
  });                                                    //
});                                                      //

import { linkWhatsapp, numeroWhatsapp, resumenHorarios } from "./formato";
                                                         // Lo que se prueba: formatos

describe("resumenHorarios", () => {                      // GRUPO: texto de horarios
  it("agrupa franjas de los sábados", () => {            //
    expect(                                              //
      resumenHorarios([                                  // Dos franjas el sábado (6), cargadas desordenadas…
        { diaSemana: 6, horaInicio: "14:00", horaFin: "18:00" },
        { diaSemana: 6, horaInicio: "09:00", horaFin: "13:00" },
      ]),                                                //
    ).toEqual(["Sábados · 09:00 a 13:00 y 14:00 a 18:00"]);
                                                         // … salen ordenadas y en un solo renglón
  });                                                    //
  it("agrupa días con el mismo horario", () => {         //
    expect(                                              //
      resumenHorarios([                                  //
        { diaSemana: 1, horaInicio: "09:00", horaFin: "13:00" },
        { diaSemana: 2, horaInicio: "09:00", horaFin: "13:00" },
        { diaSemana: 6, horaInicio: "10:00", horaFin: "12:00" },
      ]),                                                //
    ).toEqual(["Lunes, Martes · 09:00 a 13:00", "Sábados · 10:00 a 12:00"]);
                                                         // Lunes y martes juntos (mismo horario), sábado aparte
  });                                                    //
});                                                      //

describe("senaPorTransferencia", () => {                 // GRUPO: ¿se pide seña?
  const base = { senaTipo: "FIJO" as const, senaValor: 10000, cbu: "", alias: "" };
                                                         // Seña fija de 10.000, sin alias ni CBU
  it("pide seña sólo si hay alias o CBU cargado", () => {
    expect(senaPorTransferencia(base)).toBe(false);      // Sin alias ni CBU → no
    expect(senaPorTransferencia({ ...base, alias: "mc.skin" })).toBe(true);
                                                         // Con alias → sí
    expect(senaPorTransferencia({ ...base, cbu: "000123" })).toBe(true);
                                                         // Con CBU → sí
  });                                                    //
  it("no pide seña si está configurado 'sin seña' o en 0", () => {
    expect(senaPorTransferencia({ ...base, alias: "x", senaTipo: "NINGUNA" })).toBe(false);
    expect(senaPorTransferencia({ ...base, alias: "x", senaValor: 0 })).toBe(false);
  });                                                    //
});                                                      //

describe("numeroWhatsapp", () => {                       // GRUPO: números de WhatsApp
  it("completa el 549 en celulares argentinos escritos de cualquier forma", () => {
    for (const n of ["9 11 6405-2481", "11 6405-2481", "1164052481", "011 6405-2481", "+54 9 11 6405 2481",
      "54 11 6405 2481", "011 15 6405-2481", "11 15 6405 2481", "0054 9 11 6405 2481"]) {
                                                         // Nueve formas distintas de escribir el mismo celular…
      expect(numeroWhatsapp(n), n).toBe("5491164052481");
                                                         // … todas tienen que dar el mismo resultado
    }                                                    //
  });                                                    //
  it("funciona con códigos de área del interior", () => {
    expect(numeroWhatsapp("351 15 555 1234")).toBe("5493515551234");
                                                         // Córdoba (351), con el 15 viejo
    expect(numeroWhatsapp("0351 555-1234")).toBe("5493515551234");
                                                         // Córdoba con el 0 adelante
  });                                                    //
  it("arma el link con el mensaje", () => {              //
    expect(linkWhatsapp("9 11 6405-2481", "Hola!")).toBe("https://wa.me/5491164052481?text=Hola!");
  });                                                    //
});                                                      //
```

---

## `src/lib/turnos.test.ts` — pruebas del circuito de reservas (con base de datos)

Este archivo tiene 266 líneas, y casi todas las pruebas siguen el mismo patrón: preparar → ejecutar → comprobar.
Acá van explicados línea por línea la preparación y una prueba completa. El resto va en una tabla con **qué comprueba cada una**.

### La preparación

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
                                                         // Herramientas de prueba

const mails = vi.hoisted(() => [] as { to: string; subject: string }[]);
                                                         // Una lista donde se van a "guardar" los mails en vez de mandarlos
vi.mock("./email", () => ({                              // REEMPLAZA el cartero real por uno de mentira:
  enviarMail: vi.fn(async (m: { to: string; subject: string }) => {
    mails.push({ to: m.to, subject: m.subject });        //   en vez de mandar, anota a quién y con qué asunto
    return true;                                         //   y dice "salió bien"
  }),                                                    //
}));                                                     // Así se puede comprobar qué mails saldrían, sin mandar ninguno

const conDB = Boolean(process.env.TEST_DATABASE_URL);    // ¿Hay base de prueba?
const d = conDB ? describe : describe.skip;              // Si no hay, estas pruebas se saltean (describe.skip)

d("circuito de reservas", async () => {                  // GRUPO PRINCIPAL
  const { prisma } = await import("./db");               //   la base (de prueba)
  const t = await import("./turnos");                    //   lo que se prueba
  const { fechaISO, sumarDias, diaSemana, aFechaUTC } = await import("./tiempo");

  let sabado = sumarDias(fechaISO(new Date()), 2);       //   busca el próximo sábado (con 2 días de margen)…
  while (diaSemana(sabado) !== 6) sabado = sumarDias(sabado, 1);
                                                         //   … avanzando de a un día hasta que sea sábado (6)
  let martes = sabado;                                   //   y un martes (día en que NO se atiende)
  while (diaSemana(martes) !== 2) martes = sumarDias(martes, 1);

  let facial: string; // 60 min                          //   acá se guardan los ids de dos tratamientos de prueba
  let corporal: string; // 30 min

  const datos = (extra: Partial<Parameters<typeof t.crearReserva>[0]> = {}) => ({
                                                         //   ATAJO: los datos de una reserva típica, con la opción de cambiar alguno
    servicioId: facial,                                  //
    fecha: sabado,                                       //
    hora: "10:00",                                       //
    nombre: "Lucía Gómez",                               //
    email: "lucia@example.com",                          //
    telefono: "1155554444",                              //
    notas: "",                                           //
    ...extra,                                            //   (lo que se pase en "extra" pisa lo de arriba)
  });                                                    //

  beforeAll(async () => {                                //   ANTES DE TODO: vacía la base de prueba y carga datos conocidos
    await prisma.turno.deleteMany();                     //     borra turnos
    await prisma.clienta.deleteMany();                   //     clientas
    await prisma.servicio.deleteMany();                  //     tratamientos
    await prisma.horarioAtencion.deleteMany();           //     horarios
    await prisma.bloqueo.deleteMany();                   //     bloqueos
    await prisma.configuracion.deleteMany();             //     configuración
    await prisma.configuracion.create({                  //     crea una configuración de prueba
      data: { id: 1, senaTipo: "FIJO", senaValor: 10000, emailProfesional: "pro@example.com", intervaloMin: 30 },
    });                                                  //
    await prisma.horarioAtencion.createMany({            //     sábados de 9 a 13 y de 14 a 18
      data: [                                            //
        { diaSemana: 6, horaInicio: "09:00", horaFin: "13:00" },
        { diaSemana: 6, horaInicio: "14:00", horaFin: "18:00" },
      ],                                                 //
    });                                                  //
    facial = (await prisma.servicio.create({ data: { nombre: "Higiene profunda", duracionMin: 60, precio: 47000 } })).id;
                                                         //     un facial de 60 minutos
    corporal = (await prisma.servicio.create({ data: { nombre: "Celulitis", duracionMin: 30, precio: 24000, categoria: "Corporales" } })).id;
                                                         //     un corporal de 30 minutos
  });                                                    //

  beforeEach(async () => {                               //   ANTES DE CADA PRUEBA: deja todo limpio
    await prisma.turno.deleteMany();                     //     sin turnos
    await prisma.bloqueo.deleteMany();                   //     sin bloqueos
    mails.length = 0;                                    //     sin mails anotados
    await prisma.configuracion.update({ where: { id: 1 }, data: { alias: "", cbu: "", horasParaSena: 24 } });
                                                         //     sin alias ni CBU (o sea, sin seña)
  });                                                    //

  afterAll(async () => {                                 //   AL FINAL:
    await prisma.$disconnect();                          //     cierra la conexión
  });                                                    //
```

### Una prueba completa: dos clientas al mismo tiempo

```ts
  it("dos reservas simultáneas al mismo horario: sólo una gana", async () => {
    const resultados = await Promise.allSettled(         // Lanza a la vez…
      Array.from({ length: 5 }, (_, i) => t.crearReserva(datos({ hora: "15:00", email: `c${i}@example.com` }))),
                                                         // … CINCO reservas para el mismo sábado a las 15:00, de cinco clientas distintas
    );                                                   // (allSettled = espera a todas, salgan bien o mal)
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
                                                         // Comprueba: solo UNA salió bien
    for (const r of resultados.filter((r) => r.status === "rejected")) {
                                                         // Y las otras cuatro…
      expect((r as PromiseRejectedResult).reason).toBeInstanceOf(t.ErrorReserva);
                                                         // … fallaron con un error "esperado" (el mensaje amable), no con un error técnico
    }                                                    //
    expect(await prisma.turno.count({ where: { estado: "CONFIRMADO" } })).toBe(1);
                                                         // Y en la base quedó UN solo turno
  });                                                    //
```

### Todas las pruebas y qué comprueba cada una

| Prueba | Qué comprueba |
|---|---|
| sólo hay horarios los sábados | Un martes no hay horarios. El sábado arranca 9:00, termina 17:00, y no ofrece 12:30 (terminaría fuera de la franja) |
| no ofrece fechas pasadas ni fuera del rango | Fechas viejas, muy lejanas o tratamientos inexistentes → ningún horario |
| sin alias/CBU cargado confirma el turno… | Sin datos para transferir, el turno queda confirmado directo, con token secreto largo, y salen mails a la clienta y a la profesional |
| no permite reservar un horario superpuesto | Con un turno de 10 a 11, no deja reservar 10:30 ni 9:30 (pisarían). Un tratamiento de 30 min a las 9:30 sí entra |
| dos reservas simultáneas… sólo una gana | La de arriba: de 5 reservas al mismo tiempo, queda una |
| una reserva con el email de otra clienta no pisa su ficha | Si alguien reserva con el email de Lucía y otro nombre, la ficha de Lucía no cambia |
| la misma clienta nueva reservando dos cosas a la vez | No da error y no la crea dos veces |
| respeta los bloqueos | Un feriado bloqueado → ningún horario ese día |
| rechaza datos inválidos | Email mal escrito, nombre vacío, teléfono corto u hora mal formada → rechazados |
| **con seña:** deja el turno apartado… | Queda "esperando seña", con $10.000 de seña y 24 horas de plazo; sale el mail "pendiente de seña" y el horario queda ocupado |
| el plazo nunca pasa del horario del turno | Aunque se configuren 168 horas, el plazo termina cuando empieza el turno |
| al marcar "Seña recibida"… | Pasa a confirmado, sale el mail "Turno confirmado", y no se puede confirmar dos veces |
| si no manda la seña a tiempo, el horario se libera | Con el plazo vencido, el horario vuelve a ofrecerse |
| seña tardía con el horario libre | Se puede confirmar igual |
| seña tardía con el horario ya tomado | No deja confirmar ("ocupado") y el turno sigue esperando |
| dos confirmaciones simultáneas de reservas vencidas | Solo una gana |
| la profesional puede cancelar una reserva que espera la seña | Queda cancelada y el horario se libera |
| los turnos cargados desde el panel no piden seña | Quedan confirmados directo |
| con "sin seña" se confirma directo | Si la configuración dice "sin seña", no se pide |
| **cancelaciones:** la clienta puede cancelar con anticipación | Se cancela, salen 2 mails, el horario se libera |
| la clienta no puede cancelar dentro de las 24 hs | A 5 horas del turno, a la clienta no la deja; a la profesional sí |
| no se puede cancelar dos veces | La segunda vez da error |

### Las otras pruebas

- **`src/lib/auth.test.ts`:** contraseñas (que el hash funcione, que dos hashes de la misma contraseña sean distintos, comparación segura), ingreso (email sin importar mayúsculas, usuarios desactivados rechazados, acceso de emergencia) y sesión (cerrar sesión, cambio de `ADMIN_PASSWORD`, bloqueo por intentos).
- **`src/lib/seguridad.test.ts`:** etiquetas `[APP]`/`[LIB]` y que **todas** las tablas tengan RLS.

---

## `.github/workflows/ci.yml` — GitHub prueba todo solo

**CI** (integración continua) significa que cada vez que se sube código a GitHub, una computadora de GitHub instala todo, corre las pruebas y compila.
Si algo falla, avisa con una ✗ roja.

```yaml
name: CI                                                 # Nombre del proceso

on:                                                      # CUÁNDO corre:
  push:                                                  #   cuando se sube código…
    branches: [master, main]                             #   … a la rama principal
  pull_request:                                          #   y en cada pull request (propuesta de cambios)

jobs:                                                    # LOS TRABAJOS:
  build:                                                 #   uno llamado "build"
    runs-on: ubuntu-latest                               #   en una computadora con Linux (Ubuntu)
    services:                                            #   con un servicio extra:
      postgres:                                          #     una base PostgreSQL de prueba
        image: postgres:16                               #     versión 16
        env:                                             #     con este usuario, contraseña y nombre:
          POSTGRES_USER: hs                              #
          POSTGRES_PASSWORD: hs                          #
          POSTGRES_DB: healthyskin                       #
        ports: ["5432:5432"]                             #     en el puerto 5432 (el de siempre de Postgres)
        options: >-                                      #     y que espere a que la base esté lista antes de seguir
          --health-cmd pg_isready --health-interval 5s --health-timeout 5s --health-retries 10
    env:                                                 #   VARIABLES para las pruebas (todas de mentira, solo para esta base descartable):
      DATABASE_URL: postgresql://hs:hs@localhost:5432/healthyskin
      DATABASE_URL_UNPOOLED: postgresql://hs:hs@localhost:5432/healthyskin
      TEST_DATABASE_URL: postgresql://hs:hs@localhost:5432/healthyskin
                                                         #   con esto se activan las pruebas de integración
      AUTH_SECRET: ci-secret-ci-secret-ci-secret-0123    #
      ADMIN_PASSWORD: ci                                 #
    steps:                                               #   LOS PASOS, en orden:
      - uses: actions/checkout@v4                        #     1. baja el código
      - uses: actions/setup-node@v4                      #     2. instala Node…
        with:                                            #
          node-version: 22                               #        versión 22
          cache: npm                                     #        y recuerda las bibliotecas para la próxima vez (más rápido)
      - run: npm ci                                      #     3. instala las bibliotecas exactas de package-lock.json
      - run: npx prisma migrate deploy                   #     4. crea las tablas en la base de prueba
      - run: npm run lint                                #     5. TypeScript revisa errores
      - run: npm test                                    #     6. corre TODAS las pruebas
      - run: npm run db:seed                             #     7. carga los datos iniciales
      - run: npm run build                               #     8. compila la página
      - name: Ninguna clave en los archivos del navegador
        run: node scripts/verificar-secretos.mjs         #     9. revisa que ninguna clave haya quedado en el navegador
```

---

## La publicación en Vercel

Cuando se aprueba un cambio en GitHub, Vercel lo publica solo, ejecutando `npm run vercel-build`, que corre `scripts/vercel-build.sh`.
Ese script está explicado línea por línea en la [guía de seguridad](../guia-codigo-seguridad.md). Hace esto:

1. Acomoda las variables de la base.
2. Genera el código de Prisma.
3. Aplica las migraciones pendientes (cambios en las tablas).
4. Vuelve a activar RLS en todas las tablas.
5. Carga los datos iniciales, solo si la base está vacía.
6. Compila la página.
7. Revisa que ninguna clave haya quedado en los archivos del navegador. Si encuentra una, **corta el deploy**.

Si cualquier paso falla, Vercel **no publica** y la página sigue funcionando con la versión anterior.

---

## Resumen: el camino completo de un cambio

```
Escribís código en tu compu
   ↓  npm run dev       → lo ves funcionando en http://localhost:3000
   ↓  npm run lint      → TypeScript revisa errores
   ↓  npm test          → las pruebas comprueban que nada se rompió
   ↓  git push          → se sube a GitHub
   ↓  CI de GitHub      → vuelve a probar todo en una compu limpia (✓ o ✗)
   ↓  Vercel            → migra la base, compila, revisa claves y publica
La página nueva está en internet
```
