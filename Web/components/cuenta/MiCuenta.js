"use client";

import { useEffect, useState } from "react";
import { CheckCircle, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { miCuentaAccion, guardarMiCuentaAccion, cambiarMiContrasenaAccion } from "@/app/acciones-cuenta";
import CampoContrasena from "@/components/CampoContrasena";

/**
 * MI CUENTA (Entrega 2, 9-oct-2026): la misma pantalla para el panel
 * (/admin/cuenta) y el modo chofer (/chofer/cuenta). Nombre, teléfono y
 * contraseña; el correo se ve pero no se cambia aquí (es con el que entra).
 */
function Aviso({ aviso }) {
  if (!aviso) return null;
  return aviso.tipo === "ok" ? (
    <div className="pt-activar-ok" role="status" style={{ marginBottom: "1rem" }}><CheckCircle /> {aviso.texto}</div>
  ) : (
    <div className="pt-login-error" role="alert" style={{ marginBottom: "1rem" }}>
      <WarningCircle style={{ marginRight: 6, verticalAlign: "-2px" }} /> {aviso.texto}
    </div>
  );
}

export default function MiCuenta() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [avisoDatos, setAvisoDatos] = useState(null);
  const [avisoClave, setAvisoClave] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [clave, setClave] = useState({ actual: "", nueva: "", repetir: "" });
  const [cambiando, setCambiando] = useState(false);

  useEffect(() => {
    let vivo = true;
    miCuentaAccion().then((r) => {
      if (!vivo) return;
      if (r.ok) setDatos({ nombre: r.nombre, telefono: r.telefono, correo: r.correo });
      else setError(r.motivo || "No se pudo leer tu cuenta.");
    });
    return () => { vivo = false; };
  }, []);

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setAvisoDatos(null);
    const r = await guardarMiCuentaAccion({ nombre: datos.nombre, telefono: datos.telefono });
    setGuardando(false);
    setAvisoDatos(r.ok ? { tipo: "ok", texto: "Guardado." } : { tipo: "error", texto: r.motivo || "No se guardó." });
  };

  const cambiar = async (e) => {
    e.preventDefault();
    setCambiando(true);
    setAvisoClave(null);
    const r = await cambiarMiContrasenaAccion(clave);
    setCambiando(false);
    if (!r.ok) { setAvisoClave({ tipo: "error", texto: r.motivo || "No se pudo cambiar." }); return; }
    setClave({ actual: "", nueva: "", repetir: "" });
    setAvisoClave({ tipo: "ok", texto: "Listo: tu contraseña cambió. Te mandamos un correo de aviso." });
  };

  if (error) return <div className="pt-login-error" role="alert">{error}</div>;
  if (!datos) return <div className="pt-cargando">Cargando tu cuenta…</div>;

  return (
    <>
      <div className="pt-page-head">
        <h1>Mi cuenta</h1>
        <p>Tus datos y tu contraseña. Entras con <strong>{datos.correo}</strong>.</p>
      </div>

      <div className="pt-grid pt-grid-2" style={{ gap: "1.1rem", alignItems: "start" }}>
        <div className="pt-card">
          <div className="pt-card-head"><h2>Mis datos</h2></div>
          <Aviso aviso={avisoDatos} />
          <form onSubmit={guardar}>
            <div className="pt-campo">
              <label htmlFor="mc-nombre">Nombre</label>
              <input id="mc-nombre" className="pt-input" required value={datos.nombre}
                onChange={(e) => setDatos({ ...datos, nombre: e.target.value })} />
            </div>
            <div className="pt-campo">
              <label htmlFor="mc-tel">Teléfono (10 dígitos)</label>
              <input id="mc-tel" className="pt-input" inputMode="tel" value={datos.telefono}
                onChange={(e) => setDatos({ ...datos, telefono: e.target.value })} />
            </div>
            <button type="submit" className="pt-btn pt-btn-verde" disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar"}
            </button>
          </form>
        </div>

        <div className="pt-card">
          <div className="pt-card-head"><h2>Cambiar contraseña</h2></div>
          <Aviso aviso={avisoClave} />
          <form onSubmit={cambiar}>
            <CampoContrasena id="mc-actual" etiqueta="Contraseña actual" autoComplete="current-password"
              value={clave.actual} onChange={(e) => setClave({ ...clave, actual: e.target.value })} />
            <CampoContrasena id="mc-nueva" etiqueta="Contraseña nueva (mínimo 8)" autoComplete="new-password"
              value={clave.nueva} onChange={(e) => setClave({ ...clave, nueva: e.target.value })} />
            <CampoContrasena id="mc-repetir" etiqueta="Repite la nueva" autoComplete="new-password"
              value={clave.repetir} onChange={(e) => setClave({ ...clave, repetir: e.target.value })} />
            <button type="submit" className="pt-btn pt-btn-naranja" disabled={cambiando}>
              {cambiando ? "Cambiando…" : "Cambiar contraseña"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
