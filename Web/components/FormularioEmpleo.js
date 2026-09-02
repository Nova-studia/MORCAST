"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle,
  WarningCircle,
  PaperPlaneTilt,
} from "@phosphor-icons/react/dist/ssr";
import { enviarSolicitudEmpleo } from "@/app/acciones-empleo";
import { validarArchivo, LIMITES } from "@/lib/empleo.mjs";

/**
 * No es una vacante real —no tiene id—, así que nunca lleva `vacanteId`: es
 * justo la opción que convierte la solicitud en general.
 */
const CUALQUIER_PUESTO = "Cualquier puesto disponible";

/**
 * EL FORMULARIO PÚBLICO DE "TRABAJA CON NOSOTROS".
 *
 * Calcado de `FormularioCotizacion`: mismos estados, mismas clases
 * (`mc-form`, `form-control`, `form-select`), mismo botón que se apaga
 * mientras envía. La diferencia es el contrato de vuelta: `enviarCotizacion`
 * regresa `{ok, mensaje, errores}` por `useActionState`; `enviarSolicitudEmpleo`
 * regresa `{ok, folio, motivo, aviso}` a mano, porque además valida un
 * archivo ANTES de mandar el FormData —eso useActionState no lo resuelve
 * bien— y aquí se sigue tal cual lo entrega el encargo.
 */
export default function FormularioEmpleo({ vacantes = [] }) {
  const searchParams = useSearchParams();

  // Si la página trae ?vacante=<id>, se preselecciona por su TEXTO (el select
  // manda `puesto` como texto, que es lo que guarda el registro); el id sólo
  // viaja aparte, en el campo oculto, y se deriva de ese mismo texto más
  // abajo — así nunca se desincronizan uno del otro.
  const idPreseleccionado = searchParams.get("vacante") || "";
  const vacantePreseleccionada = vacantes.find((v) => v.id === idPreseleccionado);

  const [puesto, setPuesto] = useState(vacantePreseleccionada?.puesto || "");
  const [archivo, setArchivo] = useState(null);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(null);

  // El texto elegido puede o no corresponder a una vacante abierta real (la
  // otra opción es "Cualquier puesto disponible", que no tiene id). Cuando sí
  // corresponde, ahí sale el `vacanteId` que se manda oculto.
  const vacanteElegida = vacantes.find((v) => v.puesto === puesto);
  const vacanteId = vacanteElegida?.id || "";

  const enviar = async (e) => {
    e.preventDefault();
    setError("");

    // Amabilidad, no seguridad: quien manda es el servidor.
    const revision = validarArchivo(archivo);
    if (!revision.ok) {
      setError(revision.motivo);
      return;
    }

    setEnviando(true);
    const datos = new FormData(e.currentTarget);
    if (archivo) datos.set("curriculum", archivo);

    const r = await enviarSolicitudEmpleo(datos);
    setEnviando(false);

    if (!r.ok) {
      // NO se limpia nada: que no tenga que volver a escribirlo todo.
      setError(r.motivo);
      return;
    }
    // Y hasta aqui, con r.ok en la mano, se dice "gracias".
    setListo({ folio: r.folio, aviso: r.aviso });
    e.target.reset();
    setArchivo(null);
    setPuesto("");
  };

  if (listo) {
    return (
      <div className="mc-form text-center" style={{ padding: "3rem 2rem" }}>
        <div
          className="mc-tarjeta-icono mx-auto"
          style={{
            width: 72,
            height: 72,
            fontSize: "2rem",
            background: "rgba(78,179,74,0.13)",
            color: "var(--mc-verde)",
          }}
        >
          <CheckCircle />
        </div>
        <h3 style={{ fontSize: "1.4rem", marginBottom: "0.75rem" }}>
          Solicitud enviada
        </h3>
        <p className="mc-lead mb-0">
          Tu folio es <strong>{listo.folio}</strong>. Morcast la tiene y te
          contactará.
        </p>
        {listo.aviso && (
          <p className="mc-lead mb-0" style={{ marginTop: "0.75rem" }}>
            {listo.aviso}
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="mc-form" noValidate>
      <h3 style={{ fontSize: "1.3rem", marginBottom: "0.5rem" }}>
        Trabaja con nosotros
      </h3>
      <p style={{ fontSize: "0.92rem", color: "var(--mc-gris)", marginBottom: "1.75rem" }}>
        Cuéntanos de ti y te contactamos.
      </p>

      {error && (
        <div className="mc-alerta mc-alerta-error mb-4">
          <WarningCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Oculto a propósito: lo llena el `puesto` elegido, no la persona. */}
      <input type="hidden" name="vacanteId" value={vacanteId} />

      <div className="row g-3">
        <div className="col-md-6">
          <label htmlFor="nombre">
            Nombre <span className="mc-requerido">*</span>
          </label>
          <input
            id="nombre"
            name="nombre"
            type="text"
            className="form-control"
            placeholder="Tu nombre completo"
            maxLength={LIMITES.nombre}
            autoComplete="name"
            required
          />
        </div>

        <div className="col-md-6">
          <label htmlFor="telefono">
            Teléfono <span className="mc-requerido">*</span>
          </label>
          <input
            id="telefono"
            name="telefono"
            type="tel"
            inputMode="tel"
            className="form-control"
            placeholder="868 123 4567"
            maxLength={LIMITES.telefono}
            autoComplete="tel"
            required
          />
        </div>

        <div className="col-md-6">
          {/* Sin asterisco: el correo es opcional a propósito —el chofer o
              el ayudante muchas veces no usa correo—, ver `empleo.mjs`. */}
          <label htmlFor="correo">Correo</label>
          <input
            id="correo"
            name="correo"
            type="email"
            className="form-control"
            placeholder="tucorreo@ejemplo.mx"
            maxLength={LIMITES.correo}
            autoComplete="email"
          />
        </div>

        <div className="col-md-6">
          <label htmlFor="puesto">
            Puesto <span className="mc-requerido">*</span>
          </label>
          <select
            id="puesto"
            name="puesto"
            className="form-select"
            value={puesto}
            onChange={(e) => setPuesto(e.target.value)}
            required
          >
            <option value="" disabled>
              Selecciona una opción
            </option>
            {vacantes.map((v) => (
              <option key={v.id} value={v.puesto}>
                {v.puesto}
              </option>
            ))}
            <option value={CUALQUIER_PUESTO}>{CUALQUIER_PUESTO}</option>
          </select>
        </div>

        <div className="col-12">
          <label htmlFor="experiencia">
            Experiencia <span className="mc-requerido">*</span>
          </label>
          <textarea
            id="experiencia"
            name="experiencia"
            rows={4}
            className="form-control"
            placeholder="Dónde has trabajado, qué hacías, cuánto tiempo…"
            maxLength={LIMITES.experiencia}
            required
          />
        </div>

        <div className="col-12">
          <label htmlFor="curriculum">Currículum (PDF, JPG o PNG, máximo 5 MB)</label>
          <input
            id="curriculum"
            name="curriculum"
            type="file"
            className="form-control"
            accept="application/pdf,image/jpeg,image/png"
            onChange={(e) => setArchivo(e.target.files?.[0] || null)}
          />
        </div>

        <div className="col-12">
          <div className="form-check">
            <input
              id="aviso"
              name="aviso"
              type="checkbox"
              value="si"
              className="form-check-input"
              required
            />
            <label className="form-check-label" htmlFor="aviso" style={{ fontWeight: 400 }}>
              Acepto el{" "}
              <a href="/aviso-de-privacidad" style={{ color: "var(--mc-verde)" }}>
                Aviso de Privacidad
              </a>{" "}
              <span className="mc-requerido">*</span>
            </label>
          </div>
        </div>

        <div className="col-12 mt-4">
          <button type="submit" className="mc-btn mc-btn-verde w-100" disabled={enviando}>
            {enviando ? (
              "Enviando…"
            ) : (
              <>
                Enviar solicitud <PaperPlaneTilt aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
