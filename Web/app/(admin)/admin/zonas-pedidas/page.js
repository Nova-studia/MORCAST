"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { listarZonasPedidas, cambiarEstadoZona } from "@/lib/datos-zonas";
import { listarRutas } from "@/lib/datos-rutas";

const MapaZonas = dynamic(() => import("@/components/MapaZonas"), {
  ssr: false,
  loading: () => <div className="mc-mapa" style={{ height: 420 }} />,
});

const ESTADOS_ZONA = [
  { id: "nueva", texto: "Nueva", clase: "prog" },
  { id: "en-evaluacion", texto: "En evaluación", clase: "ruta" },
  { id: "aprobada", texto: "Aprobada", clase: "ok" },
  { id: "descartada", texto: "Descartada", clase: "mal" },
];

export default function ZonasPedidasAdmin() {
  const [pedidas, setPedidas] = useState([]);
  const [rutas, setRutas] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;
    Promise.all([listarZonasPedidas(), listarRutas()]).then(([z, r]) => {
      if (!vivo) return;
      setPedidas(z);
      setRutas(r);
      setCargando(false);
    });
    return () => { vivo = false; };
  }, []);

  const zonas = useMemo(
    () => rutas.filter((r) => r.activa).map((r) => ({
      id: r.id,
      nombre: r.nombre,
      poligono: r.zona,
    })),
    [rutas]
  );

  // Memorizado: si naciera nuevo en cada render, el mapa se repintaría de más.
  const puntos = useMemo(
    () => pedidas.map((z) => ({
      lat: z.lat,
      lng: z.lng,
      titulo: `${z.empresa} · ${z.colonia}`,
    })),
    [pedidas]
  );

  // Se guarda primero: si falla, la pantalla no debe decir que se aprobo algo
  // que la base no registro.
  const cambiaEstado = async (id, estado) => {
    const z = pedidas.find((x) => x.id === id);
    if (!z) return;
    const r = await cambiarEstadoZona(z.uuid, estado);
    if (!r.ok) return;
    setPedidas((lista) => lista.map((x) => (x.id === id ? { ...x, estado } : x)));
  };

  const badge = (id) => ESTADOS_ZONA.find((e) => e.id === id) || { texto: id, clase: "prog" };

  return (
    <>
      <div className="pt-page-head">
        <h1>Zonas pedidas</h1>
        <p>Dónde están pidiendo servicio y todavía no pasa ninguna ruta.</p>
      </div>

      <div className="pt-grid pt-grid-mapa">
        <div className="pt-card">
          <div className="pt-card-head"><h2>Mapa</h2></div>
          {/* Se encuadra a lo dibujado: las zonas pedidas caen POR DEFINICIÓN
              fuera de las rutas, y con el encuadre fijo quedaban invisibles. */}
          <MapaZonas zonas={zonas} puntos={puntos} alto="460px" encuadrar />
          <p className="mc-mapa-nota">
            Los puntos naranjas son solicitudes fuera de cobertura. Donde se junten
            varios, conviene evaluar una ruta nueva.
          </p>
        </div>

        <div className="pt-card">
          <div className="pt-card-head"><h2>Solicitudes</h2></div>
          {pedidas.length === 0 ? (
            <div className="pt-vacio">No hay solicitudes fuera de cobertura.</div>
          ) : (
            pedidas.map((z) => {
              const b = badge(z.estado);
              return (
                <div key={z.id} style={{ borderTop: "1px solid var(--mc-linea)", padding: "0.85rem 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "0.6rem" }}>
                    <strong style={{ fontSize: "0.92rem" }}>{z.empresa}</strong>
                    <span className={`pt-badge ${b.clase}`}>{b.texto}</span>
                  </div>
                  <div style={{ fontSize: "0.83rem", color: "var(--mc-gris)", marginTop: 4 }}>
                    {z.colonia} · {z.volumenEstimado}
                  </div>
                  <div style={{ fontSize: "0.83rem", color: "var(--mc-gris)", marginTop: 3 }}>
                    {z.nombreContacto} · {z.telefono}
                  </div>
                  <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.6rem", flexWrap: "wrap" }}>
                    {ESTADOS_ZONA.map((e) => (
                      <button
                        key={e.id}
                        type="button"
                        className={`pt-btn ${z.estado === e.id ? "pt-btn-naranja" : ""}`}
                        style={{ padding: "0.3rem 0.6rem", fontSize: "0.78rem" }}
                        onClick={() => cambiaEstado(z.id, e.id)}
                      >
                        {e.texto}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
