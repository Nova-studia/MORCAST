"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { MagnifyingGlass, X } from "@phosphor-icons/react/dist/ssr";
import { etiquetaEstado, normalizarNombre, TIPOS_CONTENEDOR, MEDIDAS_SUGERIDAS } from "@/lib/contenedores.mjs";

/**
 * Piezas que comparten la lista, las herramientas de alta y la edición de
 * contenedores. Viven junto a la página porque solo las usa ella.
 */

/**
 * `.pt-badge` trae ok / prog / ruta / mal, pero no "alerta" (dañado) ni una
 * apagada (baja). Se pintan aquí con los tokens de estado en vez de tocar
 * portal.css, que comparten todas las pantallas.
 */
const ESTILO_INSIGNIA = {
  alerta: { background: "var(--pt-alerta-tinte)", color: "var(--pt-alerta)" },
  "": { background: "rgba(255,255,255,0.06)", color: "var(--mc-gris)" },
};

export function InsigniaEstado({ estado }) {
  const e = etiquetaEstado(estado);
  return <span className={`pt-badge ${e.clase}`} style={ESTILO_INSIGNIA[e.clase]}>{e.texto}</span>;
}

/**
 * Monta una ventana (`.pt-modal-fondo`) directo en `.pt-body`.
 *
 * Sin esto quedaría dentro de `.mc-pagina`, que lleva la animación de
 * entrada con `transform`: un ancestro animando `transform` se vuelve el
 * bloque contenedor de lo `position: fixed`, así que el fondo oscuro no
 * cubría la barra de arriba y la ventana quedaba cortada por la orilla de
 * la página. En `.pt-body` siguen valiendo las variables del panel
 * (--pt-accion…), que en `document.body` no existen.
 */
export function Ventana({ children }) {
  const destino = typeof document !== "undefined" ? document.querySelector(".pt-body") : null;
  return destino ? createPortal(children, destino) : children;
}

/** Listas de sugerencias para los campos de texto libre (tipo y medida). */
export function Sugerencias() {
  return (
    <>
      <datalist id="cont-tipos">{TIPOS_CONTENEDOR.map((t) => <option key={t} value={t} />)}</datalist>
      <datalist id="cont-medidas">{MEDIDAS_SUGERIDAS.map((m) => <option key={m} value={m} />)}</datalist>
    </>
  );
}

/** Texto de error debajo de un campo. */
export function ErrorCampo({ children }) {
  if (!children) return null;
  return <span style={{ display: "block", color: "var(--pt-error)", fontSize: "0.78rem", marginTop: 4 }}>{children}</span>;
}

/** "Industrias del Golfo · Planta 1" para un id de domicilio. */
export function nombrePunto(clientes, domicilioId) {
  for (const c of clientes) {
    const p = c.puntos.find((x) => x.id === domicilioId);
    if (p) return { cliente: c, punto: p };
  }
  return null;
}

/**
 * Elegir el punto de un contenedor: primero se busca la EMPRESA (son decenas
 * y se reconocen por nombre) y luego se escoge cuál de sus puntos. Un solo
 * menú con todos los puntos de todos los clientes serían cien renglones de
 * "Planta 1", "Matriz", "Planta 1"… sin saber de quién es cada uno.
 */
export function ElegirPunto({ clientes, valor, onCambio, id = "cont-punto" }) {
  const actual = useMemo(() => nombrePunto(clientes, valor), [clientes, valor]);
  const [busqueda, setBusqueda] = useState("");
  const [clienteId, setClienteId] = useState(actual?.cliente.id || "");
  const cliente = clientes.find((c) => c.id === clienteId) || null;

  const q = normalizarNombre(busqueda);
  const resultados = q ? clientes.filter((c) => normalizarNombre(c.empresa).includes(q)).slice(0, 8) : [];

  return (
    <div>
      {actual ? (
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.5rem", fontSize: "0.9rem" }}>
          <span>
            <strong>{actual.cliente.empresa}</strong>
            <span style={{ color: "var(--mc-gris)" }}> · {actual.punto.alias}{actual.punto.colonia ? ` (${actual.punto.colonia})` : ""}</span>
          </span>
          <button type="button" className="pt-btn" style={{ padding: "0.25rem 0.6rem" }} onClick={() => { onCambio(null); setClienteId(""); }}>
            <X /> Quitar
          </button>
        </div>
      ) : (
        <p style={{ margin: "0 0 0.5rem", fontSize: "0.85rem", color: "var(--mc-gris)" }}>Sin asignar (en bodega o sin ubicar).</p>
      )}

      <div style={{ position: "relative" }}>
        <MagnifyingGlass aria-hidden="true" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--mc-gris)" }} />
        <input
          id={id}
          className="pt-input"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder={actual ? "Cambiar a otra empresa…" : "Buscar empresa…"}
          style={{ paddingLeft: "2.2rem" }}
          autoComplete="off"
        />
      </div>
      {resultados.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginTop: "0.5rem" }}>
          {resultados.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`pt-chip ${clienteId === c.id ? "activo" : ""}`}
              onClick={() => {
                setClienteId(c.id);
                setBusqueda("");
                // Con un solo punto no hay nada que elegir: se asigna de una.
                if (c.puntos.length === 1) onCambio(c.puntos[0].id);
              }}
            >
              {c.empresa}
            </button>
          ))}
        </div>
      )}
      {q && resultados.length === 0 && (
        <p style={{ margin: "0.4rem 0 0", fontSize: "0.82rem", color: "var(--mc-gris)" }}>Ninguna empresa con «{busqueda}».</p>
      )}

      {cliente && cliente.puntos.length !== 1 && (
        <div style={{ marginTop: "0.6rem" }}>
          {cliente.puntos.length === 0 ? (
            <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--pt-alerta)" }}>
              {cliente.empresa} no tiene puntos de recolección dados de alta.
            </p>
          ) : (
            <select
              className="pt-input"
              aria-label={`Punto de ${cliente.empresa}`}
              value={cliente.puntos.some((p) => p.id === valor) ? valor : ""}
              onChange={(e) => onCambio(e.target.value || null)}
            >
              <option value="">— ¿Cuál punto de {cliente.empresa}? —</option>
              {cliente.puntos.map((p) => (
                <option key={p.id} value={p.id}>{p.alias}{p.colonia ? ` · ${p.colonia}` : ""}</option>
              ))}
            </select>
          )}
        </div>
      )}
    </div>
  );
}
