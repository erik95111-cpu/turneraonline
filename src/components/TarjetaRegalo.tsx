import Image from "next/image";

/** Gift card modelo “Oro pleno”. Escala sola con el ancho del contenedor. */
export function TarjetaRegalo(p: { titulo: string; monto?: string; para: string; de: string; codigo?: string; className?: string }) {
  return (
    <div className={`gift ${p.className ?? ""}`} role="img" aria-label={`Gift card ${p.titulo}${p.monto ? ` de ${p.monto}` : ""} para ${p.para || "…"}`}>
      <div className="gift-cara">
        <div className="gift-centro">
          <Image src="/logo.png" alt="" width={160} height={160} className="gift-logo" />
          <div className="min-w-0">
            <div className="gift-rotulo">Gift card</div>
            <div className="gift-titulo" style={{ fontSize: p.titulo.length > 32 ? "5.4cqw" : p.titulo.length > 16 ? "7cqw" : undefined }}>{p.titulo}</div>
          </div>
        </div>
        <div className="gift-fila">
          <div className="min-w-0">
            <div className="gift-rotulo">Para · De</div>
            <div className="gift-dato">{p.para || "…"} · {p.de || "…"}</div>
          </div>
          {p.monto && <div className="gift-monto">{p.monto}</div>}
        </div>
        {p.codigo && <div className="gift-codigo">{p.codigo}</div>}
      </div>
    </div>
  );
}
