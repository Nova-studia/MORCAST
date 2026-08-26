"use client";

import { useActionState } from "react";
import {
  CheckCircle,
  WarningCircle,
  PaperPlaneTilt,
} from "@phosphor-icons/react/dist/ssr";
import { enviarCotizacion } from "@/app/actions";
import { TIPOS_SERVICIO, FRECUENCIAS } from "@/lib/datos";

const ESTADO_INICIAL = { ok: false, mensaje: "", errores: {}, valores: {} };

export default function FormularioCotizacion() {
  const [estado, accion, pendiente] = useActionState(
    enviarCotizacion,
    ESTADO_INICIAL
  );

  const err = estado?.errores ?? {};
  const val = estado?.valores ?? {};

  // Pantalla de éxito
  if (estado?.ok && estado?.mensaje) {
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
        <p className="mc-lead mb-0">{estado.mensaje}</p>
      </div>
    );
  }

  return (
    <form action={accion} className="mc-form" noValidate>
      <h3 style={{ fontSize: "1.3rem", marginBottom: "0.5rem" }}>
        Solicita tu cotización
      </h3>
      <p style={{ fontSize: "0.92rem", color: "var(--mc-gris)", marginBottom: "1.75rem" }}>
        Cuéntanos qué necesitas y te respondemos el mismo día.
      </p>

      {estado?.mensaje && !estado?.ok && (
        <div className="mc-alerta mc-alerta-error mb-4">
          <WarningCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{estado.mensaje}</span>
        </div>
      )}

      {/* Honeypot anti-bots: oculto para personas */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "-9999px",
          width: 1,
          height: 1,
          overflow: "hidden",
        }}
      >
        <label htmlFor="sitio_web">No llenar</label>
        <input id="sitio_web" name="sitio_web" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="row g-3">
        <div className="col-md-6">
          <label htmlFor="nombre">
            Nombre <span className="mc-requerido">*</span>
          </label>
          <input
            id="nombre"
            name="nombre"
            type="text"
            className={`form-control ${err.nombre ? "is-invalid" : ""}`}
            placeholder="Tu nombre completo"
            defaultValue={val.nombre}
            autoComplete="name"
            required
          />
          {err.nombre && <div className="invalid-feedback d-block">{err.nombre}</div>}
        </div>

        <div className="col-md-6">
          <label htmlFor="empresa">Empresa / Razón social</label>
          <input
            id="empresa"
            name="empresa"
            type="text"
            className="form-control"
            placeholder="Nombre de tu empresa"
            defaultValue={val.empresa}
            autoComplete="organization"
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
            className={`form-control ${err.telefono ? "is-invalid" : ""}`}
            placeholder="868 123 4567"
            defaultValue={val.telefono}
            autoComplete="tel"
            required
          />
          {err.telefono && (
            <div className="invalid-feedback d-block">{err.telefono}</div>
          )}
        </div>

        <div className="col-md-6">
          <label htmlFor="correo">
            Correo <span className="mc-requerido">*</span>
          </label>
          <input
            id="correo"
            name="correo"
            type="email"
            className={`form-control ${err.correo ? "is-invalid" : ""}`}
            placeholder="tucorreo@empresa.com"
            defaultValue={val.correo}
            autoComplete="email"
            required
          />
          {err.correo && <div className="invalid-feedback d-block">{err.correo}</div>}
        </div>

        <div className="col-md-6">
          <label htmlFor="tipo_servicio">
            Tipo de servicio <span className="mc-requerido">*</span>
          </label>
          <select
            id="tipo_servicio"
            name="tipo_servicio"
            className={`form-select ${err.tipo_servicio ? "is-invalid" : ""}`}
            defaultValue={val.tipo_servicio ?? ""}
            required
          >
            <option value="" disabled>
              Selecciona una opción
            </option>
            {TIPOS_SERVICIO.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {err.tipo_servicio && (
            <div className="invalid-feedback d-block">{err.tipo_servicio}</div>
          )}
        </div>

        <div className="col-md-6">
          <label htmlFor="frecuencia">Frecuencia estimada</label>
          <select
            id="frecuencia"
            name="frecuencia"
            className="form-select"
            defaultValue={val.frecuencia ?? ""}
          >
            <option value="">Selecciona una opción</option>
            {FRECUENCIAS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        <div className="col-12">
          <label htmlFor="direccion">Dirección del servicio</label>
          <input
            id="direccion"
            name="direccion"
            type="text"
            className="form-control"
            placeholder="Calle, número, colonia, ciudad"
            defaultValue={val.direccion}
          />
        </div>

        <div className="col-12">
          <label htmlFor="mensaje">Cuéntanos más</label>
          <textarea
            id="mensaje"
            name="mensaje"
            rows={4}
            className="form-control"
            placeholder="Volumen aproximado, tipo de residuo, espacio disponible para el contenedor…"
            defaultValue={val.mensaje}
          />
        </div>

        <div className="col-12 mt-4">
          <button
            type="submit"
            className="mc-btn mc-btn-verde w-100"
            disabled={pendiente}
          >
            {pendiente ? (
              "Enviando…"
            ) : (
              <>
                Enviar solicitud <PaperPlaneTilt aria-hidden="true" />
              </>
            )}
          </button>
          <p
            style={{
              fontSize: "0.78rem",
              color: "var(--mc-gris-claro)",
              textAlign: "center",
              marginTop: "0.9rem",
              marginBottom: 0,
            }}
          >
            Al enviar aceptas nuestro{" "}
            <a href="/aviso-de-privacidad" style={{ color: "var(--mc-verde)" }}>
              Aviso de Privacidad
            </a>
            .
          </p>
        </div>
      </div>
    </form>
  );
}
