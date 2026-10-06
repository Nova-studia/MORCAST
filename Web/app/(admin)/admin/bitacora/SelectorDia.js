"use client";

import { useRouter } from "next/navigation";
import { CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";
import { moverDia } from "@/lib/bitacora-vista.mjs";

/**
 * El día de la bitácora: ‹ ›, "Hoy", "Ayer", un calendario y el filtro por
 * acción. Solo cambia la dirección (`?dia=…&accion=…`); la página, de
 * servidor, vuelve a consultar ese día en la base.
 */
export default function SelectorDia({ dia, hoy, accion, opciones }) {
  const router = useRouter();
  const ayer = moverDia(hoy, -1);

  const ir = (nuevoDia, nuevaAccion = accion) => {
    const q = new URLSearchParams();
    if (nuevoDia && nuevoDia !== hoy) q.set("dia", nuevoDia);
    if (nuevaAccion) q.set("accion", nuevaAccion);
    const s = q.toString();
    router.push(`/admin/bitacora${s ? `?${s}` : ""}`);
  };

  return (
    <div className="pt-card" style={{ marginBottom: "1.1rem", display: "flex", flexWrap: "wrap", gap: "0.6rem", alignItems: "center" }}>
      <button type="button" className="pt-btn" aria-label="Día anterior" onClick={() => ir(moverDia(dia, -1))} style={{ padding: "0.5rem" }}>
        <CaretLeft />
      </button>
      <div className="pt-segmento" role="group" aria-label="Atajos de día">
        <button type="button" className={dia === hoy ? "activo" : ""} aria-pressed={dia === hoy} onClick={() => ir(hoy)}>Hoy</button>
        <button type="button" className={dia === ayer ? "activo" : ""} aria-pressed={dia === ayer} onClick={() => ir(ayer)}>Ayer</button>
      </div>
      <button
        type="button"
        className="pt-btn"
        aria-label="Día siguiente"
        disabled={dia >= hoy}
        onClick={() => ir(moverDia(dia, 1))}
        style={{ padding: "0.5rem" }}
      >
        <CaretRight />
      </button>
      <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.86rem" }}>
        <span>Día</span>
        <input
          type="date"
          className="pt-input"
          value={dia}
          max={hoy}
          onChange={(e) => e.target.value && ir(e.target.value)}
          style={{ maxWidth: 180 }}
        />
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.86rem", flex: "1 1 220px" }}>
        <span>Acción</span>
        <select className="pt-input" value={accion} onChange={(e) => ir(dia, e.target.value)}>
          <option value="">Todas</option>
          {opciones.map((o) => (
            <option key={o.id} value={o.id}>{o.texto}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
