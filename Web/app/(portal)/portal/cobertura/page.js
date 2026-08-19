"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { FiMapPin, FiCheckCircle, FiAlertCircle } from "react-icons/fi";
import { nombreTipoRuta } from "@/lib/rutas-datos";
import { listarRutas } from "@/lib/datos-rutas";
import { rutasQueCubren } from "@/lib/punto-en-zona.mjs";

// Leaflet solo corre en el navegador.
const MapaZonas = dynamic(() => import("@/components/MapaZonas"), {
  ssr: false,
  loading: () => <div className="mc-mapa" style={{ height: 420 }} />,
});

export default function CoberturaPortal() {
  const [pin, setPin] = useState(null);
  const [rutas, setRutas] = useState([]);

  // Las rutas salen de la base: si Morcast redibuja una zona en su panel, el
  // cliente ve la nueva sin que nadie toque el código.
  useEffect(() => {
    let vivo = true;
    listarRutas().then((lista) => {
      if (vivo) setRutas(lista);
    });
    return () => {
      vivo = false;
    };
  }, []);

  const zonas = useMemo(
    () => rutas.filter((r) => r.activa).map((r) => ({
      id: r.id,
      nombre: `${r.nombre} · ${nombreTipoRuta(r.tipo)}`,
      poligono: r.zona,
    })),
    [rutas]
  );

  const cubren = useMemo(
    () => (pin ? rutasQueCubren(pin, rutas) : []),
    [pin, rutas]
  );

  return (
    <>
      <div className="pt-page-head">
        <h1>Cobertura</h1>
        <p>Marca dónde está tu domicilio y te decimos si ya pasamos por ahí.</p>
      </div>

      <div className="pt-grid pt-grid-mapa">
        <div className="pt-card">
          <div className="pt-card-head"><h2>Mapa de rutas</h2></div>
          <MapaZonas zonas={zonas} pin={pin} onPin={setPin} alto="460px" />
          <p className="mc-mapa-nota">
            <FiMapPin aria-hidden="true" /> Toca el mapa para colocar tu domicilio.
          </p>
        </div>

        <div className="pt-card" style={{ position: "sticky", top: 90 }}>
          <div className="pt-card-head"><h2>Tu zona</h2></div>

          {!pin && (
            <div className="pt-vacio">Coloca tu domicilio en el mapa para revisar la cobertura.</div>
          )}

          {pin && cubren.length > 0 && (
            <>
              <p style={{ color: "var(--mc-verde-claro)", fontWeight: 700, display: "flex", gap: 8, alignItems: "center" }}>
                <FiCheckCircle aria-hidden="true" /> Sí llegamos a tu zona
              </p>
              {cubren.map((r) => (
                <div key={r.id} style={{ borderTop: "1px solid var(--mc-linea)", paddingTop: "0.7rem", marginTop: "0.7rem" }}>
                  <div style={{ fontWeight: 700 }}>{r.nombre}</div>
                  <div style={{ fontSize: "0.85rem", color: "var(--mc-gris)", marginTop: 4 }}>
                    {nombreTipoRuta(r.tipo)}
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "var(--mc-gris)", marginTop: 4 }}>
                    Pasa: {r.dias.join(", ")}
                  </div>
                </div>
              ))}
              <Link href="/portal/agendar" className="pt-btn pt-btn-verde" style={{ width: "100%", justifyContent: "center", marginTop: "1rem" }}>
                Agendar recolección
              </Link>
            </>
          )}

          {pin && cubren.length === 0 && (
            <>
              <p style={{ color: "#f0895c", fontWeight: 700, display: "flex", gap: 8, alignItems: "center" }}>
                <FiAlertCircle aria-hidden="true" /> Todavía no llegamos ahí
              </p>
              <p style={{ fontSize: "0.87rem", color: "var(--mc-gris)" }}>
                Tu domicilio queda fuera de las rutas actuales. Puedes pedir que se
                evalúe abrir una ruta nueva en tu zona.
              </p>
              <a
                href="/contacto"
                className="pt-btn"
                style={{ width: "100%", justifyContent: "center", marginTop: "0.6rem" }}
              >
                Solicitar apertura de zona
              </a>
            </>
          )}
        </div>
      </div>
    </>
  );
}
