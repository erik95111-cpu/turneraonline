/**
 * Carga datos iniciales: configuración, horarios y tratamientos de ejemplo.
 * Los precios son ORIENTATIVOS: editalos desde el panel (/admin/servicios).
 * Sólo carga tratamientos/horarios si la tabla está vacía.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const servicios = [
  { categoria: "Faciales", nombre: "Limpieza facial profunda", duracionMin: 60, precio: 30000,
    descripcion: "Higiene completa con extracción, exfoliación, mascarilla según tu tipo de piel e hidratación final." },
  { categoria: "Faciales", nombre: "Limpieza facial express", duracionMin: 40, precio: 22000,
    descripcion: "Higiene, exfoliación suave e hidratación. Ideal para mantenimiento entre sesiones." },
  { categoria: "Faciales", nombre: "Hidratación profunda", duracionMin: 50, precio: 28000,
    descripcion: "Protocolo de hidratación intensiva con activos humectantes para pieles deshidratadas o apagadas." },
  { categoria: "Faciales", nombre: "Tratamiento para acné", duracionMin: 60, precio: 32000,
    descripcion: "Limpieza, extracción y activos seborreguladores para controlar brotes y marcas." },
  { categoria: "Renovación", nombre: "Peeling químico", duracionMin: 45, precio: 35000,
    descripcion: "Renovación celular para manchas, textura irregular y marcas de acné. Requiere evaluación previa." },
  { categoria: "Renovación", nombre: "Dermaplaning", duracionMin: 45, precio: 30000,
    descripcion: "Exfoliación mecánica que elimina células muertas y vello fino. Piel suave y luminosa al instante." },
  { categoria: "Renovación", nombre: "Microneedling (Dermapen)", duracionMin: 60, precio: 45000,
    descripcion: "Estimula colágeno para mejorar cicatrices, poros y firmeza." },
  { categoria: "Anti-age", nombre: "Radiofrecuencia facial", duracionMin: 45, precio: 30000,
    descripcion: "Tensado y firmeza a través de calor controlado. Recomendado en series de sesiones." },
  { categoria: "Evaluación", nombre: "Consulta y diagnóstico de piel", duracionMin: 30, precio: 15000,
    descripcion: "Evaluamos tu piel y armamos un plan de tratamiento y rutina en casa a tu medida." },
];

async function main() {
  await prisma.configuracion.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

  if ((await prisma.servicio.count()) === 0) {
    await prisma.servicio.createMany({ data: servicios.map((s, i) => ({ ...s, orden: i })) });
    console.log(`✓ ${servicios.length} tratamientos de ejemplo`);
  }

  if ((await prisma.horarioAtencion.count()) === 0) {
    const franjas = [1, 2, 3, 4, 5].flatMap((d) => [
      { diaSemana: d, horaInicio: "09:00", horaFin: "13:00" },
      { diaSemana: d, horaInicio: "15:00", horaFin: "19:00" },
    ]);
    franjas.push({ diaSemana: 6, horaInicio: "09:00", horaFin: "13:00" });
    await prisma.horarioAtencion.createMany({ data: franjas });
    console.log("✓ Horarios: lunes a viernes 9-13 y 15-19, sábados 9-13");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
