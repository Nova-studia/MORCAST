"use client";

import { useState } from "react";
import { FloppyDisk, Path } from "@phosphor-icons/react/dist/ssr";
import { asignarRutaAPunto } from "@/app/acciones-auditadas";

/**
 * "Ruta" en el detalle de un punto (6-oct-2026, Luis): a qué ruta pertenece,
 * cuántas recolecciones al mes tiene y si se atiende por llamada.
 *
 * Es lo que le faltaba a un cliente dado de alta desde la página: sin esto no
 * tenía ruta nunca, y sin ruta el portal no le ofrece "Día de mi ruta" ni la
 * app le deja agendar. Guarda aparte del pin (su propio botón): son dos
 * decisiones distintas y mezclarlas haría que "Descartar cambios" se llevara
 * una ruta ya elegida.
 *
 * Quien lo use debe darle `key={punto.id}`: el borrador nace del punto y se
 * reinicia al elegir otro.
 */
const DIAS_CORTOS = {
  lunes: "Lun", martes: "Mar", miercoles: "Mié", miércoles: "Mié", jueves: "Jue",
  viernes: "Vie", sabado: "Sáb", sábado: "Sáb", domingo: "Dom",
};
const diasDe = (r) => (r?.dias || []).map((d) => DIAS_CORTOS[d] || d).join(", ");

export default function RutaDelPunto({ punto, rutas, onGuardado }) {
  const inicial = {
    rutaClave: punto.ruta?.clave || "",
    serviciosPorMes: String(punto.ruta?.serviciosPorMes ?? 4),
    porLlamada: Boolean(punto.ruta?.porLlamada),
  };
  const [b, setB] = useState(inicial);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null); // { tipo, texto }

  const sucio =
    b.rutaClave !== inicial.rutaClave ||
    b.serviciosPorMes !== inicial.serviciosPorMes ||
    b.porLlamada !== inicial.porLlamada;
  const elegida = rutas.find((r) => r.id === b.rutaClave);
  // Solo se ofrecen las activas; la que ya tenía se enseña aunque se haya
  // desactivado, para que el renglón no salga en blanco.
  const opciones = rutas.filter((r) => r.activa || r.id === inicial.rutaClave);

  const cambiar = (c) => {
    setB((x) => ({ ...x, ...c }));
    setMensaje(null);
  };

  const guardar = async () => {
    setGuardando(true);
    setMensaje(null);
    const r = await asignarRutaAPunto({
      domicilioId: punto.id,
      rutaClave: b.rutaClave || null,
      serviciosPorMes: Number(b.serviciosPorMes),
      porLlamada: b.porLlamada,
    });
    setGuardando(false);
    if (!r.ok) {
      setMensaje({ tipo: "error", texto: r.motivo || "No se pudo guardar. Revisa tu conexión." });
      return;
    }
    const ruta = {
      clave: b.rutaClave || null,
      nombre: elegida?.nombre || "",
      serviciosPorMes: Number(b.serviciosPorMes),
      porLlamada: b.porLlamada,
    };
    onGuardado(punto.id, { ruta });
    setMensaje({
      tipo: "ok",
      texto: ruta.clave
        ? `Listo: ${punto.empresa} ya está en la ${ruta.nombre}. Desde hoy puede pedir en sus días de ruta, en la página y en la app.`
        : "Listo: el punto quedó sin ruta.",
    });
  };

  return (
    <section
      aria-labelledby={`ruta-${punto.id}`}
      style={{ marginTop: "1.4rem", paddingTop: "1.1rem", borderTop: "1px solid var(--mc-linea)" }}
    >
      <h3 id={`ruta-${punto.id}`} style={{ margin: "0 0 0.3rem", fontSize: "1rem", display: "flex", alignItems: "center", gap: 6 }}>
        <Path aria-hidden="true" /> Ruta
      </h3>
      <p style={{ margin: "0 0 0.8rem", fontSize: "0.84rem", color: "var(--mc-gris)" }}>
        {inicial.rutaClave
          ? "La ruta que pasa por este punto. El cliente pide sus recolecciones en los días de esta ruta."
          : "Este punto no tiene ruta: el cliente solo puede pedir recolecciones extra desde la página, y en la app no puede agendar."}
      </p>

      <div className="pt-campo">
        <label htmlFor={`ruta-sel-${punto.id}`}>Ruta</label>
        <select
          id={`ruta-sel-${punto.id}`}
          className="pt-input"
          value={b.rutaClave}
          onChange={(e) => cambiar({ rutaClave: e.target.value })}
          style={{ width: "100%" }}
        >
          <option value="">Sin ruta</option>
          {opciones.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nombre}
              {r.dias?.length ? ` — ${diasDe(r)}` : " — sin días"}
              {!r.activa ? " (desactivada)" : ""}
            </option>
          ))}
        </select>
        {elegida && (
          <p style={{ margin: "0.35rem 0 0", fontSize: "0.78rem", color: "var(--mc-gris)" }}>
            {elegida.dias?.length ? `Pasa: ${diasDe(elegida)}.` : "Esta ruta todavía no tiene días: el cliente no verá fechas hasta que se pongan en Rutas."}
            {elegida.chofer ? ` Chofer: ${elegida.chofer}.` : " Sin chofer asignado en la ruta."}
          </p>
        )}
      </div>

      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="pt-campo" style={{ marginBottom: 0 }}>
          <label htmlFor={`ruta-mes-${punto.id}`}>Recolecciones al mes</label>
          <input
            id={`ruta-mes-${punto.id}`}
            className="pt-input"
            type="number"
            inputMode="numeric"
            min={1}
            max={200}
            value={b.serviciosPorMes}
            onChange={(e) => cambiar({ serviciosPorMes: e.target.value })}
            style={{ width: 120 }}
          />
        </div>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: "0.88rem", paddingBottom: 10, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={b.porLlamada}
            onChange={(e) => cambiar({ porLlamada: e.target.checked })}
          />
          Por llamada (sin días fijos)
        </label>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap", marginTop: "1rem" }}>
        <button type="button" className="pt-btn pt-btn-naranja" onClick={guardar} disabled={!sucio || guardando}>
          <FloppyDisk /> {guardando ? "Guardando…" : "Guardar ruta"}
        </button>
        {sucio && !guardando && (
          <button type="button" className="pt-btn" onClick={() => { setB(inicial); setMensaje(null); }}>
            Descartar
          </button>
        )}
      </div>

      {mensaje && (
        <div
          role={mensaje.tipo === "error" ? "alert" : "status"}
          className={mensaje.tipo === "error" ? "pt-login-error" : undefined}
          style={
            mensaje.tipo === "ok"
              ? { color: "var(--pt-ok)", fontSize: "0.86rem", marginTop: "0.8rem" }
              : { marginTop: "0.8rem", marginBottom: 0 }
          }
        >
          {mensaje.texto}
        </div>
      )}
    </section>
  );
}
