"use client";

import { useEffect, useState } from "react";
import { X, Trash, Printer } from "@phosphor-icons/react/dist/ssr";
import { ESTADOS_CONTENEDOR } from "@/lib/contenedores.mjs";
import { guardarContenedor, borrarContenedor } from "@/lib/datos-contenedores";
import { ElegirPunto, ErrorCampo, Ventana } from "./piezas";
import { enlaceEtiquetas } from "./herramientas";

/**
 * Ventana para editar un contenedor: estado, punto asignado y notas (más
 * tipo y medida, por si se capturaron mal). El código no se edita: es lo que
 * está impreso en la etiqueta pegada al contenedor.
 */
export default function EditarContenedor({ contenedor, clientes, onCerrar, onGuardado, onBorrado }) {
  const [f, setF] = useState({ ...contenedor });
  const [errores, setErrores] = useState({});
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);

  // Escape cierra. Tocar el fondo NO: un toque de más perdería lo capturado.
  useEffect(() => {
    const tecla = (e) => { if (e.key === "Escape" && !ocupado) onCerrar(); };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [ocupado, onCerrar]);

  const cambia = (campo) => (e) => setF({ ...f, [campo]: e.target.value });

  const guardar = async (e) => {
    e.preventDefault();
    setOcupado(true);
    setAviso("");
    const r = await guardarContenedor(f);
    setOcupado(false);
    if (!r.ok) { setErrores(r.errores || {}); setAviso(r.motivo); return; }
    onGuardado(r.contenedor);
  };

  const borrar = async () => {
    setOcupado(true);
    setAviso("");
    const r = await borrarContenedor(contenedor);
    setOcupado(false);
    setConfirmarBorrado(false);
    if (!r.ok) { setAviso(r.motivo); return; }
    onBorrado(contenedor.id);
  };

  // Asignarlo a un punto casi siempre quiere decir que ya está trabajando;
  // quitarle el punto, que volvió a la bodega. Se sugiere el estado, pero
  // solo si estaba en uno de esos dos: un "dañado" o "perdido" no se toca.
  const cambiaPunto = (domicilioId) => {
    setF((x) => {
      const automatico = x.estado === "en-servicio" || x.estado === "en-bodega";
      return { ...x, domicilioId, estado: automatico ? (domicilioId ? "en-servicio" : "en-bodega") : x.estado };
    });
  };

  return (
    <Ventana>
    <div className="pt-modal-fondo">
      <div className="pt-modal" role="dialog" aria-modal="true" aria-labelledby="c-titulo">
        <div className="pt-modal-head">
          <div>
            <strong id="c-titulo" className="folio" style={{ fontFamily: "var(--fuente-mono), monospace", fontSize: "1.15rem" }}>
              {contenedor.codigo}
            </strong>
            <span>El código no cambia: es el que va impreso en la etiqueta.</span>
          </div>
          <button type="button" className="pt-btn" onClick={onCerrar} aria-label="Cerrar" disabled={ocupado}><X /></button>
        </div>

        <form onSubmit={guardar} style={{ padding: "1.2rem" }}>
          <div className="pt-grid pt-grid-3" style={{ gap: "0.9rem" }}>
            <div className="pt-campo" style={{ margin: 0 }}>
              <label htmlFor="c-estado">Estado</label>
              <select id="c-estado" className="pt-input" value={f.estado} onChange={cambia("estado")}>
                {ESTADOS_CONTENEDOR.map((e) => <option key={e.id} value={e.id}>{e.texto}</option>)}
              </select>
            </div>
            <div className="pt-campo" style={{ margin: 0 }}>
              <label htmlFor="c-tipo">Tipo</label>
              <input id="c-tipo" className="pt-input" list="cont-tipos" value={f.tipo} onChange={cambia("tipo")} />
              <ErrorCampo>{errores.tipo}</ErrorCampo>
            </div>
            <div className="pt-campo" style={{ margin: 0 }}>
              <label htmlFor="c-medida">Medida</label>
              <input id="c-medida" className="pt-input" list="cont-medidas" value={f.medida} onChange={cambia("medida")} />
              <ErrorCampo>{errores.medida}</ErrorCampo>
            </div>
            <div className="pt-campo" style={{ margin: 0, gridColumn: "1 / -1" }}>
              <label htmlFor="c-punto">Punto asignado</label>
              <ElegirPunto id="c-punto" clientes={clientes} valor={f.domicilioId} onCambio={cambiaPunto} />
            </div>
            <div className="pt-campo" style={{ margin: 0, gridColumn: "1 / -1" }}>
              <label htmlFor="c-notas">Notas</label>
              <textarea id="c-notas" className="pt-input" rows={3} value={f.notas} onChange={cambia("notas")} placeholder="Daños, dónde quedó, lo que haga falta recordar." />
              <ErrorCampo>{errores.notas}</ErrorCampo>
            </div>
          </div>

          {aviso && <div className="pt-login-error" role="alert" style={{ marginTop: "1rem", marginBottom: 0 }}>{aviso}</div>}

          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center", marginTop: "1.1rem" }}>
            <button type="submit" className="pt-btn pt-btn-naranja" disabled={ocupado}>
              {ocupado ? "Guardando…" : "Guardar cambios"}
            </button>
            <button type="button" className="pt-btn" onClick={onCerrar} disabled={ocupado}>Cancelar</button>
            <a className="pt-btn" href={enlaceEtiquetas([contenedor.codigo])} target="_blank" rel="noopener" style={{ marginLeft: "auto" }}>
              <Printer /> Su etiqueta
            </a>
          </div>

          <div style={{ marginTop: "1.3rem", paddingTop: "1rem", borderTop: "1px solid var(--mc-linea)", display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
            {!confirmarBorrado ? (
              <button type="button" className="pt-btn" disabled={ocupado} onClick={() => { setAviso(""); setConfirmarBorrado(true); }}>
                <Trash /> Eliminar
              </button>
            ) : (
              <>
                <span style={{ fontSize: "0.86rem" }}>¿Eliminar <strong>{contenedor.codigo}</strong>? No se puede deshacer.</span>
                <button type="button" className="pt-btn" style={{ borderColor: "var(--pt-error)", color: "var(--pt-error)" }} disabled={ocupado} onClick={borrar}>
                  Sí, eliminar
                </button>
                <button type="button" className="pt-btn" onClick={() => setConfirmarBorrado(false)}>Cancelar</button>
              </>
            )}
            <p style={{ flexBasis: "100%", margin: 0, fontSize: "0.82rem", color: "var(--mc-gris)" }}>
              Eliminar es para un código capturado por error. Un contenedor que ya no se usa
              se pasa a <strong>Baja</strong>: se conserva su historia y, si alguien escanea su etiqueta, la app sabe cuál era.
            </p>
          </div>
        </form>
      </div>
    </div>
    </Ventana>
  );
}
