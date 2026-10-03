/** Muestra un video de YouTube, Vimeo o un archivo .mp4 */
export function urlEmbed(url: string): { tipo: "iframe" | "video"; src: string } | null {
  const u = url.trim();
  if (!u) return null;
  const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return { tipo: "iframe", src: `https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0` };
  const vimeo = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return { tipo: "iframe", src: `https://player.vimeo.com/video/${vimeo[1]}` };
  if (/\.(mp4|webm|mov)(\?.*)?$/i.test(u)) return { tipo: "video", src: u };
  return null;
}

export function VideoPresentacion({ url, vertical = false }: { url: string; vertical?: boolean }) {
  const e = urlEmbed(url);
  if (!e) return null;
  const esShort = /shorts\//.test(url);
  const aspecto = vertical || esShort ? "aspect-[9/16] max-w-sm" : "aspect-video max-w-4xl";
  return (
    <div className={`relative mx-auto w-full ${aspecto} overflow-hidden rounded-2xl border border-gold/30 shadow-[0_0_80px_-20px_rgba(201,169,110,0.35)]`}>
      {e.tipo === "iframe" ? (
        <iframe
          src={e.src}
          title="Video de presentación"
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      ) : (
        <video src={e.src} controls playsInline preload="metadata" poster="/og.jpg" className="absolute inset-0 h-full w-full object-cover" />
      )}
    </div>
  );
}
