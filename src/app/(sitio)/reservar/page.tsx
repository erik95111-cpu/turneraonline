import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { fechaISO, sumarDias } from "@/lib/tiempo";
import { pideSena } from "@/lib/sena";
import { Reserva } from "@/components/Reserva";
import { reservarTurno } from "@/app/actions/reservas";

export const metadata: Metadata = { title: "Reservar turno" };

export default async function ReservarPage({ searchParams }: { searchParams: Promise<{ servicio?: string; gift?: string }> }) {
  const { servicio, gift } = await searchParams;
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
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
      {servicios.length === 0 || franjas.length === 0 ? (
        <p className="text-center text-piedra">Por el momento no hay turnos disponibles online. Escribinos por WhatsApp.</p>
      ) : (
        <Reserva
          servicios={servicios}
          servicioInicial={servicio}
          diasAtencion={[...new Set(franjas.map((f) => f.diaSemana))]}
          desde={hoy}
          hasta={sumarDias(hoy, cfg.diasMaxReserva)}
          sena={{ tipo: cfg.senaTipo, valor: cfg.senaValor, activa: pideSena(cfg) }}
          politica={cfg.politicaCancelacion}
          accion={reservarTurno}
          giftInicial={gift?.slice(0, 20)}
        />
      )}
    </div>
  );
}
