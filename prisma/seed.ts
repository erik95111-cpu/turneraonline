/**
 * Carga datos iniciales: configuración, horarios y tratamientos.
 * Precios tomados de la página actual (octubre 2026). Se editan desde /admin/servicios.
 * Sólo carga tratamientos/horarios si la tabla está vacía.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const servicios = [
  // ─── Faciales ───
  { categoria: "Faciales", nombre: "Higiene básica y renovación cutánea", duracionMin: 60, precio: 45000,
    descripcion: "Limpieza, exfoliación e hidratación para renovar la piel y devolverle luminosidad." },
  { categoria: "Faciales", nombre: "Higiene profunda (con extracciones controladas)", duracionMin: 60, precio: 47000,
    descripcion: "Limpieza en profundidad con extracciones controladas para destapar poros y purificar la piel." },
  { categoria: "Faciales", nombre: "Hidratación intensiva", duracionMin: 60, precio: 45000,
    descripcion: "Protocolo de hidratación profunda para pieles secas, deshidratadas o apagadas." },
  { categoria: "Faciales", nombre: "Tratamiento purificante para piel acneica", duracionMin: 60, precio: 50000,
    descripcion: "Protocolo pensado para pieles con acné: limpia, purifica y ayuda a controlar los brotes." },
  { categoria: "Faciales", nombre: "Protocolo calmante para rosácea y piel sensible", duracionMin: 60, precio: 55000,
    descripcion: "Tratamiento suave que calma el enrojecimiento y fortalece las pieles sensibles." },
  { categoria: "Faciales", nombre: "Protocolo con alta frecuencia", duracionMin: 60, precio: 45000,
    descripcion: "Tratamiento con alta frecuencia, de acción purificante y descongestiva." },
  // ─── Corporales ───
  { categoria: "Corporales", nombre: "Modelación", duracionMin: 40, precio: 25000,
    descripcion: "Tratamiento corporal para modelar la figura." },
  { categoria: "Corporales", nombre: "Celulitis", duracionMin: 30, precio: 24000,
    descripcion: "Tratamiento enfocado en mejorar el aspecto de la piel con celulitis." },
  { categoria: "Corporales", nombre: "Ondas rusas", duracionMin: 40, precio: 24000,
    descripcion: "Electroestimulación para trabajar y tonificar la musculatura." },
  { categoria: "Corporales", nombre: "Tonificación muscular", duracionMin: 40, precio: 24000,
    descripcion: "Sesión para tonificar y dar firmeza a la zona a tratar." },
  { categoria: "Corporales", nombre: "Ganancia de fuerza", duracionMin: 40, precio: 25000,
    descripcion: "Sesión orientada a fortalecer la musculatura." },
  // ─── Capilares ───
  { categoria: "Capilares", nombre: "Premium: bioestimulación capilar con microneedling", duracionMin: 60, precio: 70000,
    descripcion: "Bioestimulación del cuero cabelludo con microneedling para fortalecer el cabello." },
];

async function main() {
  // Seña fija de $10.000, igual que en la página actual
  await prisma.configuracion.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, senaTipo: "FIJO", senaValor: 10000 },
  });

  if ((await prisma.servicio.count()) === 0) {
    await prisma.servicio.createMany({ data: servicios.map((s, i) => ({ ...s, orden: i })) });
    console.log(`✓ ${servicios.length} tratamientos`);
  }

  if ((await prisma.horarioAtencion.count()) === 0) {
    // La profesional atiende sólo los sábados (se cambia desde /admin/horarios)
    await prisma.horarioAtencion.createMany({
      data: [
        { diaSemana: 6, horaInicio: "09:00", horaFin: "13:00" },
        { diaSemana: 6, horaInicio: "14:00", horaFin: "18:00" },
      ],
    });
    console.log("✓ Horarios: sábados 9-13 y 14-18");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
