"use client";

import { useCallback, useEffect, useState } from "react";
import { DeviceMobile } from "@phosphor-icons/react/dist/ssr";
import { MAX_FALLOS_TELEFONO } from "@/lib/gafete-acceso.mjs";
import { fechaLarga } from "@/lib/portal-datos";
import { leerAcceso, ligarCuentaApp, desvincularTelefono } from "../acciones";
import { Insignia } from "../piezas";
import s from "../personal.module.css";

/**
 * ACCESO A LA APP CON EL GAFETE (27-nov-2026, db/033).
 * Qué cuenta de la app es este empleado (sin cuenta ligada, su gafete no se
 * puede vincular) y en qué teléfonos abre sesión. Desvincular es para un
 * robo o un teléfono nuevo: ese teléfono deja de entrar con el gafete al
 * instante y la persona puede volver a vincularlo entrando con su correo.
 */

const NOMBRE_ROL = { dueno: "Dueño", admin: "Administrador", operador: "Chofer" };
const dia = (momento) =>
  momento ? fechaLarga(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Matamoros" }).format(new Date(momento))) : "";

export default function AccesoApp({ empleadoId, activo }) {
  const [acceso, setAcceso] = useState(null);
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [quitar, setQuitar] = useState(null); // id del teléfono por confirmar

  const cargar = useCallback(async () => {
    setAcceso(await leerAcceso(empleadoId).catch(() => ({ ok: false, motivo: "No se pudo leer el acceso a la app." })));
  }, [empleadoId]);
  useEffect(() => { cargar(); }, [cargar]);

  const hacer = async (accion) => {
    setOcupado(true);
    setAviso("");
    const r = await accion().catch(() => ({ ok: false, motivo: "No se pudo completar. Revisa tu conexión." }));
    setOcupado(false);
    setQuitar(null);
    if (!r.ok) { setAviso(r.motivo); return; }
    await cargar();
  };

  return (
    <section className="pt-card">
      <div className="pt-card-head"><h2>Acceso a la app con el gafete</h2></div>
      {!acceso ? (
        <p className={s.nota} style={{ marginTop: 0 }}>Cargando…</p>
      ) : !acceso.ok ? (
        <p className={s.nota} style={{ marginTop: 0 }}>{acceso.motivo}</p>
      ) : (
        <>
          {aviso && <div className="pt-login-error" role="alert" style={{ margin: "0 0 0.8rem" }}>{aviso}</div>}
          <label className={s.dato} style={{ display: "grid", gap: "0.35rem" }}>
            <span>Cuenta en la app</span>
            <select
              className="pt-input"
              value={acceso.perfilId || ""}
              disabled={ocupado || !activo || acceso.demo}
              onChange={(e) => hacer(() => ligarCuentaApp(empleadoId, e.target.value || null))}
            >
              <option value="">Ninguna</option>
              {acceso.cuentas.map((c) => {
                const deOtro = c.ligadoA && c.ligadoA !== empleadoId;
                return (
                  <option key={c.id} value={c.id} disabled={deOtro || c.activo === false}>
                    {c.nombre || "Sin nombre"} · {NOMBRE_ROL[c.rol] || c.rol}
                    {deOtro ? " (ya es de otro empleado)" : c.activo === false ? " (desactivada)" : ""}
                  </option>
                );
              })}
            </select>
          </label>
          <p className={s.nota}>
            {acceso.perfilId
              ? "Con esta cuenta puede vincular su gafete en la app y entrar acercándolo."
              : "Sin cuenta ligada, su gafete no sirve para entrar a la app."}
          </p>

          <h3 style={{ fontSize: "0.95rem", margin: "1.1rem 0 0.5rem" }}>Teléfonos vinculados</h3>
          {acceso.telefonos.length === 0 ? (
            <p className={s.nota} style={{ marginTop: 0 }}>Ningún teléfono vinculado.</p>
          ) : (
            <ul className={s.historial} aria-label="Teléfonos vinculados">
              {acceso.telefonos.map((t) => (
                <li key={t.id}>
                  <DeviceMobile aria-hidden="true" />
                  <span>{t.aparato || "Teléfono"}</span>
                  {t.fallos >= MAX_FALLOS_TELEFONO && <Insignia clase="alerta">Pide correo</Insignia>}
                  <small>
                    Vinculado el {dia(t.creado)}{t.ultimo_uso ? ` · último uso el ${dia(t.ultimo_uso)}` : " · sin usar todavía"}
                  </small>
                  {quitar === t.id ? (
                    <span className={s.pie}>
                      <button type="button" className="pt-btn" style={{ borderColor: "var(--pt-error)", color: "var(--pt-error)" }}
                        disabled={ocupado} onClick={() => hacer(() => desvincularTelefono(empleadoId, t.id))}>
                        Sí, desvincular
                      </button>
                      <button type="button" className="pt-btn" disabled={ocupado} onClick={() => setQuitar(null)}>Cancelar</button>
                    </span>
                  ) : (
                    <button type="button" className="pt-btn" disabled={ocupado} onClick={() => setQuitar(t.id)}>Desvincular</button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {quitar && (
            <p className={s.nota}>Ese teléfono ya no entrará con el gafete. Para volver a usarlo, la persona entra con su correo y lo vincula otra vez.</p>
          )}
        </>
      )}
    </section>
  );
}
