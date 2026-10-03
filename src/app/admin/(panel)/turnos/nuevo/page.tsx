import { prisma } from "@/lib/db";
import { fechaISO, sumarDias } from "@/lib/tiempo";
import { Reserva } from "@/components/Reserva";
import { reservarDesdePanel } from "../../../acciones";

export default async function NuevoTurno() {
  const [servicios, franjas] = await Promise.all([
    prisma.servicio.findMany({
      where: { activo: true },
      orderBy: [{ orden: "asc" }, { nombre: "asc" }],
      select: { id: true, nombre: true, descripcion: true, categoria: true, duracionMin: true, precio: true },
    }),
    prisma.horarioAtencion.findMany({ select: { diaSemana: true } }),
  ]);
  const hoy = fechaISO(new Date());
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-serif text-3xl">Nuevo turno</h1>
      <p className="mb-6 text-sm text-[#6b635b]">
        Para turnos que te piden por WhatsApp o teléfono. Se confirma sin seña y la clienta recibe el mail de confirmación.
      </p>
      <Reserva
        tema="claro"
        servicios={servicios}
        diasAtencion={[...new Set(franjas.map((f) => f.diaSemana))]}
        desde={hoy}
        hasta={sumarDias(hoy, 365)}
        sena={{ tipo: "NINGUNA", valor: 0, activa: false }}
        politica=""
        accion={reservarDesdePanel}
      />
    </div>
  );
}
