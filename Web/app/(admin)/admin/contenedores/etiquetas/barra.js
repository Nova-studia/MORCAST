"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Printer } from "@phosphor-icons/react/dist/ssr";
import s from "./etiquetas.module.css";

/**
 * Los controles de la hoja de etiquetas. Solo se ven en pantalla: al
 * imprimir se esconden (etiquetas.module.css).
 */
export default function BarraEtiquetas({ seleccion, total, hojas, tam, salto, porHoja }) {
  const router = useRouter();

  // Cambiar el tamaño o el salto reescribe la URL, para que lo que se ve
  // sea lo mismo que sale si alguien recarga o comparte el enlace.
  const cambia = (llave, valor) => {
    const q = new URLSearchParams({ c: seleccion, tam: String(tam), salto: String(salto) });
    q.set(llave, String(valor));
    // La casilla de inicio depende del tamaño: al cambiarlo se vuelve a la 1.
    if (llave === "tam") q.delete("salto");
    router.replace(`/admin/contenedores/etiquetas?${q.toString()}`, { scroll: false });
  };

  return (
    <div className={s.barra}>
      <div className="pt-page-head" style={{ margin: 0 }}>
        <h1>Etiquetas QR</h1>
        <p>
          {total} {total === 1 ? "etiqueta" : "etiquetas"} · {hojas} {hojas === 1 ? "hoja" : "hojas"} tamaño carta
        </p>
      </div>
      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "flex-end" }}>
        <Link href="/admin/contenedores" className="pt-btn" prefetch={false}>
          <ArrowLeft /> Contenedores
        </Link>
        <label style={{ fontSize: "0.8rem", color: "var(--mc-gris)", display: "grid", gap: 4 }}>
          Tamaño
          <select className="pt-input" value={tam} onChange={(e) => cambia("tam", e.target.value)} style={{ padding: "0.45rem 0.7rem" }}>
            <option value={12}>12 por hoja (QR de 4 cm)</option>
            <option value={6}>6 por hoja (QR de 6 cm)</option>
          </select>
        </label>
        <label style={{ fontSize: "0.8rem", color: "var(--mc-gris)", display: "grid", gap: 4 }}>
          Empezar en la casilla
          <select className="pt-input" value={salto} onChange={(e) => cambia("salto", e.target.value)} style={{ padding: "0.45rem 0.7rem" }}>
            {Array.from({ length: porHoja }, (_, i) => (
              <option key={i} value={i}>{i + 1}{i === 0 ? " (hoja nueva)" : ""}</option>
            ))}
          </select>
        </label>
        <button type="button" className="pt-btn pt-btn-naranja" onClick={() => window.print()} disabled={!total}>
          <Printer /> Imprimir
        </button>
      </div>
      <p className={s.nota}>
        Imprime al <strong>100 %</strong> (sin «ajustar a la página») para que el QR salga del tamaño
        pensado. En papel adhesivo para exterior aguanta más la lluvia y el sol.
      </p>
    </div>
  );
}
