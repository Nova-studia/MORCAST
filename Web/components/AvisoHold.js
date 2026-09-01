"use client";

import { Warning } from "@phosphor-icons/react/dist/ssr";
import { HOLD, enHold } from "@/lib/estado-sistema";

/**
 * La banda de "sistema en espera".
 *
 * Es una BANDA, no un modal, a proposito: hay que poder trabajar con ella
 * puesta. Un modal obligaria a cerrarlo en cada carga de pagina y a los dos
 * dias nadie lo leeria.
 *
 * `lado="admin"` agrega la linea que le falta al equipo de Morcast: saber que
 * esto MISMO lo esta viendo su cliente.
 */
export default function AvisoHold({ lado = "portal" }) {
  if (!enHold()) return null;

  return (
    <div
      role="status"
      style={{
        display: "flex",
        gap: "0.7rem",
        alignItems: "flex-start",
        background: "#fff8e1",
        border: "1px solid #f0c36d",
        borderRadius: "10px",
        padding: "0.8rem 1rem",
        marginBottom: "1.2rem",
        color: "#6b4e00",
        fontSize: "0.9rem",
        lineHeight: 1.45,
      }}
    >
      <Warning size={20} weight="fill" style={{ flexShrink: 0, marginTop: "0.1rem" }} />
      <div>
        <strong>{HOLD.titulo}.</strong> {HOLD.motivo}
        {lado === "admin" && (
          <div style={{ marginTop: "0.35rem", opacity: 0.85 }}>
            Tus clientes ven este mismo aviso en su portal, y las cifras están
            ocultas de su lado. Aquí siguen visibles.
          </div>
        )}
      </div>
    </div>
  );
}
