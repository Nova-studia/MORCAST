"use client";

import { useEffect, useState } from "react";
import { Clock, CalendarBlank, Megaphone, X } from "@phosphor-icons/react/dist/ssr";
import { avisosDelCliente } from "@/lib/datos-avisos";
import { sinOcultos, textoMotivo, fechaEnMatamoros } from "@/lib/avisos.mjs";
import { fechaLarga } from "@/lib/portal-datos";

/**
 * AVISOS DE MORCAST arriba del portal del cliente.
 *
 * Los manda la administración desde /admin/avisos (retraso, reagenda,
 * general). Cuáles le tocan a este cliente lo decide la base; aquí se
 * enseñan los vigentes y se pueden cerrar.
 *
 * Cerrar es POR SESIÓN del navegador (sessionStorage), no para siempre: si
 * el cliente cierra "la ruta va tarde" y vuelve mañana con el aviso todavía
 * vigente, se le vuelve a enseñar. Un aviso que se pierde con un clic por
 * error es peor que uno que se repite. Tampoco se guarda en la base: no hay
 * tabla de "leídos" y no hace falta para esto.
 */

const LLAVE_OCULTOS = "morcast_avisos_ocultos";

/**
 * El color sigue al MOTIVO (DESIGN.md: los estados informan, no decoran).
 * Retraso en ámbar (alerta); reagenda en el azul de "programado"; el general,
 * neutro. Nunca naranja: en el portal el naranja es "en ruta".
 */
const TONO = {
  retraso: { icono: Clock, color: "var(--pt-alerta)", tinte: "var(--pt-alerta-tinte)" },
  reagenda: { icono: CalendarBlank, color: "var(--pt-accion-txt)", tinte: "var(--pt-accion-tinte)" },
  general: { icono: Megaphone, color: "var(--mc-gris)", tinte: "rgba(255, 255, 255, 0.06)" },
};

function leerOcultos() {
  try {
    return JSON.parse(sessionStorage.getItem(LLAVE_OCULTOS) || "[]");
  } catch {
    // Ventana privada o almacenamiento bloqueado: simplemente no se recuerda.
    return [];
  }
}

function guardarOcultos(ids) {
  try {
    sessionStorage.setItem(LLAVE_OCULTOS, JSON.stringify(ids));
  } catch {
    /* sin almacenamiento, el aviso vuelve al recargar; no pasa nada */
  }
}

/**
 * Una tarjeta de aviso, tal como la ve el cliente. Se exporta para que el
 * panel enseñe la MISMA tarjeta como vista previa antes de mandar: lo que ve
 * la administración es exactamente lo que va a ver el cliente.
 */
export function TarjetaAviso({ aviso, alCerrar }) {
  const tono = TONO[aviso.motivo] || TONO.general;
  const Icono = tono.icono;
  const dia = aviso.creado ? fechaLarga(fechaEnMatamoros(aviso.creado)) : "";
  return (
    <div
      role="status"
      style={{
        display: "flex",
        gap: "0.85rem",
        alignItems: "flex-start",
        background: "var(--mc-superficie)",
        border: "1px solid var(--mc-linea)",
        borderLeft: `4px solid ${tono.color}`,
        borderRadius: 8,
        padding: "0.9rem 1rem",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          flexShrink: 0,
          display: "grid",
          placeItems: "center",
          width: 34,
          height: 34,
          borderRadius: 8,
          background: tono.tinte,
          color: tono.color,
          fontSize: "1.15rem",
        }}
      >
        <Icono weight="bold" />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.3rem 0.6rem", marginBottom: "0.25rem" }}>
          <span
            style={{
              color: tono.color,
              fontSize: "0.72rem",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
            }}
          >
            {textoMotivo(aviso.motivo)}
          </span>
          {dia && <span style={{ color: "var(--mc-gris)", fontSize: "0.78rem" }}>{dia}</span>}
        </div>
        <strong style={{ display: "block", fontSize: "0.98rem", lineHeight: 1.35, overflowWrap: "anywhere" }}>
          {aviso.titulo || "Título del aviso"}
        </strong>
        {/* pre-line: el admin escribe en párrafos y así se respetan, sin
            meter HTML que habría que escapar. */}
        <p style={{ margin: "0.3rem 0 0", color: "var(--mc-gris)", fontSize: "0.88rem", lineHeight: 1.55, whiteSpace: "pre-line", overflowWrap: "anywhere", maxWidth: "70ch" }}>
          {aviso.mensaje || "El mensaje aparece aquí."}
        </p>
        {aviso.vigente_hasta && (
          <div style={{ marginTop: "0.4rem", color: "var(--mc-gris)", fontSize: "0.78rem" }}>
            Aplica hasta el {fechaLarga(aviso.vigente_hasta)}
          </div>
        )}
      </div>
      {alCerrar && (
        <button
          type="button"
          className="pt-btn"
          onClick={alCerrar}
          aria-label={`Ocultar el aviso «${aviso.titulo}»`}
          title="Ocultar"
          style={{ padding: "0.4rem", flexShrink: 0 }}
        >
          <X />
        </button>
      )}
    </div>
  );
}

export default function AvisosCliente() {
  const [avisos, setAvisos] = useState([]);
  const [ocultos, setOcultos] = useState([]);

  useEffect(() => {
    let vivo = true;
    // sessionStorage se lee aquí y no al iniciar el estado: en el servidor no
    // existe, y leerlo antes de hidratar haría que la primera pintura del
    // servidor y la del navegador no coincidieran.
    setOcultos(leerOcultos());
    avisosDelCliente()
      .then((l) => { if (vivo) setAvisos(l || []); })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);

  const visibles = sinOcultos(avisos, ocultos);
  if (!visibles.length) return null;

  const ocultar = (id) => {
    const nuevos = [...ocultos, id];
    setOcultos(nuevos);
    guardarOcultos(nuevos);
  };

  return (
    <section aria-label="Avisos de Morcast" style={{ display: "grid", gap: "0.6rem", marginBottom: "1.1rem" }}>
      {visibles.map((a) => (
        <TarjetaAviso key={a.id} aviso={a} alCerrar={() => ocultar(a.id)} />
      ))}
    </section>
  );
}
