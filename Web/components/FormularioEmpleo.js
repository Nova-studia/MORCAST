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

  // El `id` es único y el `puesto` NO —dos plazas de "Ayudante de
  // recolección" son lo más normal del mundo—, así que el estado guarda el
  // id elegido, nunca el texto. Si se guardara el texto, un `find` por texto
  // devolvería SIEMPRE la primera vacante que lo tenga, amarrando la
  // solicitud a la plaza equivocada.
  //
  // Eso hacía además que `?vacante=<id>` fallara EN SILENCIO con vacantes
  // duplicadas: la preselección encontraba el id de la URL, pero al
  // reconvertir su texto de vuelta a id devolvía el de la primera coincidencia
  // — el candidato aplicaba a una plaza y quedaba registrado en otra. Al
  // guardar el id no hay ida y vuelta: la URL ES el valor del <select>.
  const idPreseleccionado = searchParams.get("vacante") || "";

  const [vacanteId, setVacanteId] = useState(
    vacantes.some((v) => v.id === idPreseleccionado) ? idPreseleccionado : ""
  );
  const [archivo, setArchivo] = useState(null);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(null);

  // El texto que se manda como `puesto` (lo que guarda el registro) se
  // deriva del id, nunca al revés. Sin id (la opción "Cualquier puesto
  // disponible") es ese mismo texto fijo.
  const vacanteElegida = vacantes.find((v) => v.id === vacanteId);
  const puesto = vacanteElegida?.puesto || CUALQUIER_PUESTO;

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
    setVacanteId("");
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
        <div className="mc-alerta mc-alerta-error mb-4" role="alert">
          <WarningCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Ocultos a propósito: los llena el <select> de más abajo, no la
          persona escribiéndolos directo. El `vacanteId` manda —es único—; el
          texto que se guarda en el registro (`puesto`) se deriva de él, y
          nunca al revés (ver el porqué en el comentario de arriba). */}
      <input type="hidden" name="vacanteId" value={vacanteId} />
      <input type="hidden" name="puesto" value={puesto} />

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
            className="form-select"
            value={vacanteId}
            onChange={(e) => setVacanteId(e.target.value)}
            required
          >
            {vacantes.map((v) => (
              <option key={v.id} value={v.id}>
                {v.puesto}
              </option>
            ))}
            <option value="">{CUALQUIER_PUESTO}</option>
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
