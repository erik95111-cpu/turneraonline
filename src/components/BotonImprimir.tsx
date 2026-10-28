"use client";

export function BotonImprimir() {
  return (
    <button type="button" onClick={() => window.print()} className="btn-linea">
      Imprimir o guardar en PDF
    </button>
  );
}
