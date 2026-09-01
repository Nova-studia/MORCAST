"use client";

import { useMemo, useState } from "react";
import {
  Plus,
  Minus,
  DownloadSimple,
  FileText,
  Trash,
} from "@phosphor-icons/react/dist/ssr";
import {
  CATALOGO_COTIZADOR,
  IVA,
  pesos,
} from "@/lib/portal-datos";
import { descargarCotizacion, descargarConstanciaFiscal } from "@/lib/portal-pdf";
import {
  CONDICIONES_COMERCIALES,
  COBERTURA,
  HORARIOS,
} from "@/lib/cotizacion-datos";
import { clienteActual } from "@/lib/portal-sesion";
import { enHold, HOLD } from "@/lib/estado-sistema";

export default function CotizadorPortal() {
  // Los 12 precios de `CATALOGO_COTIZADOR` los invento Claude en agosto-2026;
  // la empresa devolvio el cuaderno con CERO precios. Un cotizador que suma
  // montos falsos y los baja en un PDF con membrete es la superficie mas
  // peligrosa del portal: ese PDF sobrevive al Hold y anda suelto para
  // siempre. Por eso aqui no se ocultan los numeros: no se llega a calcular.
  if (enHold()) return <CotizadorEnEspera />;

  const [cantidades, setCantidades] = useState({}); // id -> cantidad
  const [bajando, setBajando] = useState(null);

  const cambia = (id, delta) =>
    setCantidades((c) => {
      const n = Math.max(0, (c[id] || 0) + delta);
      const copia = { ...c, [id]: n };
      if (n === 0) delete copia[id];
      return copia;
    });

  const items = useMemo(
    () =>
      CATALOGO_COTIZADOR.filter((s) => cantidades[s.id]).map((s) => ({
        ...s,
        cantidad: cantidades[s.id],
      })),
    [cantidades]
  );

  const subtotal = items.reduce((a, it) => a + it.precio * it.cantidad, 0);
  const iva = subtotal * IVA;
  const total = subtotal + iva;

  const bajarCotizacion = async () => {
    if (!items.length) return;
    setBajando("cot");
    try {
      const yo = await clienteActual();
      if (yo) await descargarCotizacion({ items, subtotal, iva, total }, yo);
    } finally {
      setBajando(null);
    }
  };

  const bajarConstancia = async () => {
    setBajando("csf");
    try {
      await descargarConstanciaFiscal();
    } finally {
      setBajando(null);
    }
  };

  return (
    <>
      <div className="pt-page-head">
        <h1>Cotizador</h1>
        <p>Arma una cotización de referencia y descárgala en PDF.</p>
      </div>

      <div className="pt-grid pt-grid-2" style={{ "--pt-cols": "2fr 1.2fr", alignItems: "start" }}>
        {/* Catálogo */}
        <div className="pt-card">
          <div className="pt-card-head"><h2>Servicios</h2></div>
          {CATALOGO_COTIZADOR.map((s) => {
            const n = cantidades[s.id] || 0;
            return (
              <div
                key={s.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  padding: "0.7rem 0",
                  borderBottom: "1px solid var(--mc-linea)",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ fontSize: "0.92rem" }}>{s.servicio}</strong>
                  <div style={{ color: "var(--mc-gris)", fontSize: "0.8rem" }}>
                    {pesos(s.precio)} · {s.unidad}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <button className="pt-btn" style={{ padding: "0.4rem 0.55rem" }} onClick={() => cambia(s.id, -1)} disabled={n === 0} aria-label="Quitar uno">
                    <Minus />
                  </button>
                  <span style={{ minWidth: 24, textAlign: "center", fontWeight: 700 }}>{n}</span>
                  <button className="pt-btn" style={{ padding: "0.4rem 0.55rem" }} onClick={() => cambia(s.id, 1)} aria-label="Agregar uno">
                    <Plus />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Resumen */}
        <div className="pt-card" style={{ position: "sticky", top: 90 }}>
          <div className="pt-card-head">
            <h2>Resumen</h2>
            {items.length > 0 && (
              <button className="pt-btn" onClick={() => setCantidades({})}>
                <Trash /> Limpiar
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="pt-vacio">Agrega servicios para cotizar.</div>
          ) : (
            <>
              {items.map((it) => (
                <div key={it.id} style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", fontSize: "0.86rem", padding: "0.35rem 0" }}>
                  <span style={{ color: "var(--mc-gris)" }}>
                    {it.cantidad} × {it.servicio}
                  </span>
                  <span style={{ whiteSpace: "nowrap", fontWeight: 600 }}>{pesos(it.precio * it.cantidad)}</span>
                </div>
              ))}
              <div style={{ borderTop: "1px solid var(--mc-linea)", marginTop: "0.6rem", paddingTop: "0.7rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", marginBottom: "0.35rem", color: "var(--mc-gris)" }}>
                  <span>Subtotal</span><span>{pesos(subtotal)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", marginBottom: "0.55rem", color: "var(--mc-gris)" }}>
                  <span>IVA ({IVA * 100}%)</span><span>{pesos(iva)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: "1.2rem" }}>
                  <span>Total</span><span>{pesos(total)}</span>
                </div>
              </div>
            </>
          )}

          <button
            className="pt-btn pt-btn-verde"
            style={{ width: "100%", justifyContent: "center", marginTop: "1rem", padding: "0.7rem" }}
            onClick={bajarCotizacion}
            disabled={!items.length || bajando === "cot"}
          >
            <DownloadSimple /> {bajando === "cot" ? "Generando…" : "Descargar cotización"}
          </button>
          <button
            className="pt-btn"
            style={{ width: "100%", justifyContent: "center", marginTop: "0.6rem" }}
            onClick={bajarConstancia}
            disabled={bajando === "csf"}
          >
            <FileText /> {bajando === "csf" ? "Generando…" : "Constancia fiscal (PDF)"}
          </button>

          <div style={{ borderTop: "1px solid var(--mc-linea)", marginTop: "1rem", paddingTop: "0.8rem" }}>
            <h3 style={{ fontSize: "0.78rem", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--mc-verde-claro)", marginBottom: "0.5rem" }}>
              Condiciones comerciales
            </h3>
            <ul style={{ margin: 0, paddingLeft: "1.05rem", fontSize: "0.8rem", color: "var(--mc-gris)", lineHeight: 1.55 }}>
              {CONDICIONES_COMERCIALES.lista.map((c) => (
                <li key={c} style={{ marginBottom: "0.3rem" }}>{c}</li>
              ))}
            </ul>
            <p style={{ fontSize: "0.78rem", color: "var(--mc-gris)", marginTop: "0.6rem", marginBottom: 0 }}>
              Cobertura: {COBERTURA}. Recolecciones {HORARIOS.recolecciones.toLowerCase()}.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

// Fuera de `CotizadorPortal` a proposito: un componente definido dentro de
// otro es distinto en cada render para React, que desmonta el arbol entero.
// En el telefono eso cierra el teclado a cada letra — ya paso en
// /portal/nueva-clave y costo tiempo encontrarlo.
function CotizadorEnEspera() {
  return (
    <div className="pt-card" style={{ textAlign: "center", padding: "2.5rem 1.5rem" }}>
      <FileText size={48} weight="duotone" style={{ opacity: 0.5, marginBottom: "1rem" }} />
      <h2 style={{ marginBottom: "0.6rem" }}>{HOLD.titulo}</h2>
      <p style={{ maxWidth: "42ch", margin: "0 auto 1.4rem", color: "var(--mc-gris)" }}>
        Estamos afinando nuestra lista de precios. Mientras tanto,
        cotizamos por escrito: escríbenos y te contestamos con los montos
        de tus servicios.
      </p>
      <a className="mc-btn mc-btn-verde" href="/contacto">
        Pedir una cotización
      </a>
    </div>
  );
}
