import { prisma } from "@/lib/db";
import { serviciosParaReservar } from "@/lib/combos";
import { fechaISO, sumarDias } from "@/lib/tiempo";
import { Reserva } from "@/components/Reserva";
import { reservarDesdePanel } from "../../../acciones";

export default async function NuevoTurno({ searchParams }: { searchParams: Promise<{ clienta?: string }> }) {
  const { clienta: clientaId } = await searchParams;
  const [servicios, franjas, clienta] = await Promise.all([
    serviciosParaReservar(),
    prisma.horarioAtencion.findMany({ select: { diaSemana: true } }),
    clientaId ? prisma.clienta.findUnique({ where: { id: clientaId }, select: { nombre: true, telefono: true, email: true } }) : null,
  ]);
  const hoy = fechaISO(new Date());
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-serif text-3xl">Nuevo turno{clienta && ` para ${clienta.nombre}`}</h1>
      <p className="mb-6 text-sm text-[#6b635b]">
        Para turnos que te piden por WhatsApp o teléfono. Se confirma sin seña y elegís si avisarle por WhatsApp, por mail o por los dos.
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
        clientaInicial={clienta ? { nombre: clienta.nombre, telefono: clienta.telefono, email: clienta.email ?? "" } : undefined}
      />
    </div>
  );
}
