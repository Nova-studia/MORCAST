"use client";

import { useEffect, useState } from "react";
import {
  Check,
  X,
  Envelope,
  Phone,
  MapPin,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import { listarAltas, cambiarEstadoAlta } from "@/lib/datos-altas";

const ESTADOS = [
  { id: "nueva", texto: "Nueva", clase: "" },
  { id: "contactada", texto: "Contactada", clase: "azul" },
  { id: "aprobada", texto: "Aprobada", clase: "verde" },
  { id: "rechazada", texto: "Rechazada", clase: "rojo" },
];

const fecha = (iso) =>
  new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });

export default function AltasAdmin() {
  const [altas, setAltas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState("nueva");
  const [sel, setSel] = useState(null);
  const [error, setError] = useState("");

  const recargar = () => listarAltas().then((l) => { setAltas(l); setCargando(false); });
  useEffect(() => { recargar(); }, []);

  const marcar = async (a, estado) => {
    setError("");
    const r = await cambiarEstadoAlta(a.id, estado);
    if (!r.ok) { setError(r.motivo || "No se pudo guardar."); return; }
    await recargar();
    setSel((s) => (s && s.id === a.id ? { ...s, estado } : s));
  };

  const lista = filtro === "todas" ? altas : altas.filter((a) => a.estado === filtro);
  const nuevas = altas.filter((a) => a.estado === "nueva").length;

  return (
    <>
      <div className="pt-page-head">
        <h1>Altas de clientes</h1>
        <p>
          Quien llena <strong>Cotización/Alta</strong> en la página cae aquí. También te
          llega un correo a contacto@morcast.mx en cuanto lo manda.
        </p>
      </div>

      {error && (
        <div className="pt-login-error" role="alert" style={{ marginBottom: "1rem" }}>
          <WarningCircle style={{ marginRight: 6, verticalAlign: "-2px" }} /> {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: "1rem" }}>
        {[{ id: "nueva", texto: `Sin atender (${nuevas})` }, ...ESTADOS.slice(1), { id: "todas", texto: "Todas" }].map((f) => (
          <button
            key={f.id}
            type="button"
            className={`pt-chip ${filtro === f.id ? "activo" : ""}`}
            onClick={() => setFiltro(f.id)}
          >
            {f.texto}
          </button>
        ))}
      </div>

      <div className="pt-grid pt-grid-mapa">
        <div className="pt-card">
          <div className="pt-card-head"><h2>Solicitudes ({lista.length})</h2></div>
          {cargando ? (
            <div className="pt-vacio">Cargando…</div>
          ) : lista.length === 0 ? (
            <div className="pt-vacio">No hay altas en este estado.</div>
          ) : (
            <div className="pt-tabla-wrap">
              <table className="pt-tabla" style={{ minWidth: 640 }}>
                <thead>
                  <tr>
                    <th>Folio</th><th>Fecha</th><th>Empresa</th>
                    <th className="num">Al mes</th><th>Cobertura</th><th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((a) => (
                    <tr
                      key={a.id}
                      onClick={() => setSel(a)}
                      style={{ cursor: "pointer", background: sel?.id === a.id ? "rgba(255,255,255,0.04)" : undefined }}
                    >
                      <td className="folio">{a.folio}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{fecha(a.creado)}</td>
                      <td>{a.empresa}</td>
                      <td className="num">{a.serviciosPorMes}</td>
                      <td>
                        <span className={`pt-badge ${a.enCobertura ? "verde" : "rojo"}`}>
                          {/* Decía "En ruta", que es además el nombre de un
                              ESTADO de servicio (el chofer va en camino).
                              Aquí lo que se responde es otra cosa: si el
                              domicilio cae o no dentro de alguna zona. */}
                          {a.enCobertura ? "En cobertura" : "Fuera"}
                        </span>
                      </td>
                      <td>
                        <span className={`pt-badge ${ESTADOS.find((e) => e.id === a.estado)?.clase || ""}`}>
                          {ESTADOS.find((e) => e.id === a.estado)?.texto || a.estado}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="pt-card">
          <div className="pt-card-head"><h2>Detalle</h2></div>
          {!sel ? (
            <div className="pt-vacio">Toca una solicitud para ver todo lo que mandó.</div>
          ) : (
            <div style={{ padding: "0 0.2rem" }}>
              <h3 style={{ margin: "0 0 0.2rem" }}>{sel.empresa}</h3>
              <p style={{ margin: "0 0 1rem", color: "var(--mc-gris)", fontSize: "0.9rem" }}>
                {sel.folio} · {fecha(sel.creado)}
              </p>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: "1rem" }}>
                <a className="pt-btn" href={`tel:${sel.telefono}`}><Phone /> Llamar</a>
                <a className="pt-btn" href={`mailto:${sel.correo}?subject=Tu alta en Morcast (${sel.folio})`}><Envelope /> Correo</a>
                <a className="pt-btn" target="_blank" rel="noreferrer"
                   href={`https://wa.me/52${(sel.telefono || "").replace(/\D/g, "")}`}>WhatsApp</a>
              </div>

              <Dato etiqueta="Contacto" valor={`${sel.contacto} · ${sel.telefono}`} />
              <Dato etiqueta="Correo" valor={sel.correo} />
              <Dato etiqueta="Domicilio" valor={[sel.calle, sel.colonia, sel.cp].filter(Boolean).join(", ")} />
              <Dato etiqueta="Referencias" valor={sel.referencias} />
              <Dato etiqueta="Residuos" valor={(sel.residuos || []).join(", ")} />
              <Dato
                etiqueta="Equipo pedido"
                valor={(sel.equipo || []).map((e) => `${e.cantidad} × ${e.tipo} ${e.medida}`).join(", ")}
              />
              <Dato etiqueta="Recolecciones al mes" valor={sel.serviciosPorMes} />
              <Dato etiqueta="Razón social" valor={sel.razonSocial} />
              <Dato etiqueta="RFC" valor={sel.rfc} />
              <Dato etiqueta="Uso de CFDI" valor={sel.usoCFDI} />
              <Dato etiqueta="Forma de pago" valor={sel.formaPago} />
              <Dato
                etiqueta="Cobertura"
                valor={sel.enCobertura ? `Sí — ${(sel.rutasQueCubren || []).join(", ") || "en ruta"}` : "No, queda fuera de las rutas de hoy"}
              />
              {sel.lat != null && (
                <p style={{ margin: "0.6rem 0 0", fontSize: "0.86rem" }}>
                  <a target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${sel.lat},${sel.lng}`}>
                    <MapPin style={{ verticalAlign: "-2px" }} /> Ver el punto en el mapa
                  </a>
                </p>
              )}

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: "1.3rem" }}>
                {sel.estado !== "contactada" && (
                  <button type="button" className="pt-btn" onClick={() => marcar(sel, "contactada")}>
                    Marcar contactada
                  </button>
                )}
                {sel.estado !== "aprobada" && (
                  <button type="button" className="pt-btn pt-btn-verde" onClick={() => marcar(sel, "aprobada")}>
                    <Check /> Aprobar
                  </button>
                )}
                {sel.estado !== "rechazada" && (
                  <button type="button" className="pt-btn" onClick={() => marcar(sel, "rechazada")}>
                    <X /> Rechazar
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Dato({ etiqueta, valor }) {
  if (!valor && valor !== 0) return null;
  return (
    <p style={{ margin: "0 0 0.55rem", fontSize: "0.92rem" }}>
      <span style={{ color: "var(--mc-gris)" }}>{etiqueta}</span>
      <br />
      <strong>{valor}</strong>
    </p>
  );
}
