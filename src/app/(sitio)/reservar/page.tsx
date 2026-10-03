import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { fechaISO, sumarDias } from "@/lib/tiempo";
import { mpHabilitado } from "@/lib/mercadopago";
import { Reserva } from "@/components/Reserva";
import { reservarTurno } from "@/app/actions/reservas";

export const metadata: Metadata = { title: "Reservar turno" };

export default async function ReservarPage({ searchParams }: { searchParams: Promise<{ servicio?: string }> }) {
  const { servicio } = await searchParams;
  const [cfg, servicios, franjas] = await Promise.all([
    getConfig(),
    prisma.servicio.findMany({
      where: { activo: true },
      orderBy: [{ orden: "asc" }, { nombre: "asc" }],
      select: { id: true, nombre: true, descripcion: true, categoria: true, duracionMin: true, precio: true },
    }),
    prisma.horarioAtencion.findMany({ select: { diaSemana: true } }),
  ]);
  const hoy = fechaISO(new Date());

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="mb-10 text-center">
        <p className="eyebrow">Turnos online</p>
        <h1 className="mt-4 font-serif text-4xl sm:text-5xl">Reservá tu turno</h1>
      </div>
      {servicios.length === 0 || franjas.length === 0 ? (
        <p className="text-center text-piedra">Por el momento no hay turnos disponibles online. Escribinos por WhatsApp.</p>
      ) : (
        <Reserva
          servicios={servicios}
          servicioInicial={servicio}
          diasAtencion={[...new Set(franjas.map((f) => f.diaSemana))]}
          desde={hoy}
          hasta={sumarDias(hoy, cfg.diasMaxReserva)}
          sena={{ tipo: cfg.senaTipo, valor: cfg.senaValor, activa: mpHabilitado() }}
          politica={cfg.politicaCancelacion}
          accion={reservarTurno}
        />
      )}
    </div>
  );
}
