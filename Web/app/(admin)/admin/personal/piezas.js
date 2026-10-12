"use client";

import { useState } from "react";
import { fotoDelPanel } from "@/lib/foto-gafete";
import s from "./personal.module.css";

/** Las piezas que comparten las pantallas de Personal. */

/** Silueta gris para quien todavía no tiene foto. */
export function Silueta() {
  return (
    <svg viewBox="0 0 100 125" aria-hidden="true">
      <rect width="100" height="125" fill="#DCE0DF" />
      <circle cx="50" cy="49" r="20.5" fill="#B8BFBE" />
      <path d="M11 125c0-25 17.5-40.5 39-40.5S89 100 89 125z" fill="#B8BFBE" />
    </svg>
  );
}

/**
 * La foto de un empleado en el panel, o la silueta. `vista` es una dirección
 * local (blob:) para enseñar la que se acaba de escoger antes de guardarla.
 */
export function Foto({ empleado, vista = null, tam = "" }) {
  const [fallo, setFallo] = useState(null);
  const origen = vista || fotoDelPanel(empleado);
  return (
    <span className={`${s.foto} ${tam === "grande" ? s.fotoGrande : tam === "media" ? s.fotoMedia : ""}`}>
      {origen && fallo !== origen ? (
        // <img> y no next/image: la sirve una ruta privada del panel, sin optimizador.
        <img src={origen} alt="" onError={() => setFallo(origen)} loading="lazy" />
      ) : (
        <Silueta />
      )}
    </span>
  );
}

/**
 * `.pt-badge` trae ok / alerta / mal, pero no una apagada (de baja, sin
 * gafete). Se pinta aquí con los tokens de siempre en vez de tocar
 * portal.css, que comparten todas las pantallas (igual que en Unidades).
 */
export function Insignia({ clase = "", children }) {
  const apagada = clase ? undefined : { background: "rgba(255,255,255,0.06)", color: "var(--mc-gris)" };
  return <span className={`pt-badge ${clase}`} style={apagada}>{children}</span>;
}

/** Las insignias del gafete de un empleado de la lista. */
export function EstadoGafete({ empleado }) {
  if (empleado.estado === "baja") return <Insignia>De baja</Insignia>;
  if (!empleado.gafete) return <Insignia clase="alerta">Sin gafete</Insignia>;
  return empleado.gafete.chip_grabado_en
    ? <Insignia clase="ok">Chip grabado</Insignia>
    : <Insignia clase="alerta">Chip pendiente</Insignia>;
}

/** Dónde se guarda la selección para la hoja de impresión (ver imprimir/page.js). */
export const LLAVE_IMPRESION = "morcast-gafetes-por-imprimir";

/** Deja anotados los empleados por imprimir y devuelve a dónde ir. */
export function prepararImpresion(ids) {
  try {
    sessionStorage.setItem(LLAVE_IMPRESION, JSON.stringify(ids));
  } catch {
    // Sin almacenamiento (modo privado estricto) van en la dirección.
    return `/admin/personal/imprimir?ids=${ids.join(",")}`;
  }
  return "/admin/personal/imprimir";
}
