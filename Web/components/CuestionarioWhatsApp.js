"use client";

import { useEffect, useRef, useState } from "react";
import { FaWhatsapp } from "react-icons/fa";
import { Plus, ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import {
  TIPOS_RESIDUO,
  UNIDADES,
  EMBALAJES,
  OTRO,
  MAX_RESIDUOS,
  LARGO,
  residuoVacio,
  validar,
  armarMensaje,
  enlaceCotizacion,
  trazoQR,
} from "@/lib/cotizar-whatsapp";

const CONTACTO_VACIO = { empresa: "", ciudad: "", nombre: "", puesto: "" };

function movimiento() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

/**
 * El cuestionario de /cotizar. La lógica (validar, armar el mensaje) vive en
 * `lib/cotizar-whatsapp.js`; aquí solo va la pantalla.
 *
 * El botón final es un ENLACE de verdad a WhatsApp, no un `window.open`: los
 * navegadores que se abren dentro de otras apps (el propio WhatsApp, Facebook)
 * dejan pasar un clic en un enlace y suelen bloquear una ventana abierta por
 * código. Si falta algo, el clic se cancela y se marcan los campos.
 *
 * En CELULAR el clic abre WhatsApp directo. En COMPUTADORA primero se enseña
 * un código QR: mucha gente no tiene WhatsApp abierto en la compu, pero sí en
 * el celular, y al escanearlo el mensaje le aparece ahí ya escrito.
 */
export default function CuestionarioWhatsApp() {
  const siguienteId = useRef(2);
  const tarjeta = useRef(null);
  const [residuos, setResiduos] = useState(() => [residuoVacio(1)]);
  const [contacto, setContacto] = useState(CONTACTO_VACIO);
  const [errores, setErrores] = useState({});
  const [intentado, setIntentado] = useState(false);
  const [listo, setListo] = useState(false);
  const [esTactil, setEsTactil] = useState(false);
  const [qr, setQr] = useState(null);

  const datos = { residuos, ...contacto };
  const enlace = enlaceCotizacion(datos);

  // "Táctil" = el puntero principal es un dedo. Una laptop con pantalla táctil
  // pero con mouse cuenta como computadora, que es lo correcto aquí.
  useEffect(() => {
    const mq = window.matchMedia("(hover: none) and (pointer: coarse)");
    const leer = () => setEsTactil(mq.matches);
    leer();
    mq.addEventListener("change", leer);
    return () => mq.removeEventListener("change", leer);
  }, []);

  // Tras el primer intento, los avisos se van quitando conforme se corrigen.
  useEffect(() => {
    if (intentado) setErrores(validar({ residuos, ...contacto }).errores);
  }, [intentado, residuos, contacto]);

  // El QR se arma solo cuando hace falta (computadora, mensaje listo). La
  // librería se carga en ese momento para no pesarle a quien llega del celular.
  useEffect(() => {
    if (!listo || esTactil) return;
    let vivo = true;
    setQr(null);
    import("uqr")
      .then(({ encode }) => {
        if (!vivo) return;
        const codigo = encode(enlace, { ecc: "L", boostEcc: true, border: 4 });
        setQr({ trazo: trazoQR(codigo.data), lado: codigo.data.length });
      })
      .catch(() => { if (vivo) setQr({ error: true }); });
    return () => { vivo = false; };
  }, [listo, esTactil, enlace]);

  const cambiarResiduo = (id, campo, valor) =>
    setResiduos((lista) => lista.map((r) => (r.id === id ? { ...r, [campo]: valor } : r)));

  const agregar = () => {
    if (residuos.length >= MAX_RESIDUOS) return;
    const id = siguienteId.current++;
    setResiduos((lista) => [...lista, residuoVacio(id)]);
    // Al nuevo renglón se le pone el foco, para seguir escribiendo sin buscarlo.
    requestAnimationFrame(() => document.getElementById(`residuo-${id}-tipo`)?.focus());
  };

  const quitar = (id) => setResiduos((lista) => lista.filter((r) => r.id !== id));

  const cambiarContacto = (campo) => (e) =>
    setContacto((c) => ({ ...c, [campo]: e.target.value }));

  /** Valida y, si falta algo, lleva el foco al primer campo marcado. */
  const revisar = () => {
    const r = validar(datos);
    setIntentado(true);
    setErrores(r.errores);
    if (!r.ok) {
      const campo = document.getElementById(Object.keys(r.errores)[0]);
      campo?.focus({ preventScroll: true });
      campo?.scrollIntoView({ block: "center", behavior: movimiento() });
    }
    return r.ok;
  };

  const mostrarListo = () => {
    setListo(true);
    requestAnimationFrame(() =>
      tarjeta.current?.scrollIntoView({ block: "start", behavior: movimiento() })
    );
  };

  const alTocarEnviar = (e) => {
    if (!revisar()) {
      e.preventDefault();
      return;
    }
    // En computadora, primero el QR; en celular se deja seguir el enlace.
    if (!esTactil) e.preventDefault();
    mostrarListo();
  };

  // Enter dentro del formulario: mismo camino, sin abrir nada solo.
  const alEnviarFormulario = (e) => {
    e.preventDefault();
    if (revisar()) mostrarListo();
  };

  if (listo) {
    return (
      <div className="mc-form mc-cotizar" ref={tarjeta}>
        {esTactil ? (
          <>
            <h3 className="mc-cotizar-titulo">Termina en WhatsApp</h3>
            <p className="mc-cotizar-sub">
              Se abrió WhatsApp con tu mensaje escrito. Solo aprieta <strong>Enviar</strong>.
            </p>
            <a
              href={enlace}
              target="_blank"
              rel="noopener noreferrer"
              className="mc-btn mc-btn-pri w-100"
            >
              <FaWhatsapp size={17} aria-hidden="true" /> ¿No se abrió? Abrir WhatsApp
            </a>
          </>
        ) : (
          <div className="mc-cotizar-listo">
            <div className="mc-cotizar-qr">
              {qr?.trazo ? (
                <svg
                  viewBox={`0 0 ${qr.lado} ${qr.lado}`}
                  shapeRendering="crispEdges"
                  role="img"
                  aria-label="Código QR que abre WhatsApp con tu mensaje"
                >
                  <rect width={qr.lado} height={qr.lado} fill="#fff" />
                  <path d={qr.trazo} fill="#0b0e0f" />
                </svg>
              ) : (
                <span className="mc-cotizar-qr-aviso">
                  {qr?.error ? "No se pudo dibujar el código. Usa el botón." : "Preparando el código…"}
                </span>
              )}
            </div>
            <div>
              <h3 className="mc-cotizar-titulo">Escanéalo con tu celular</h3>
              <p className="mc-cotizar-sub">
                Apunta la cámara de tu celular al código: se abre WhatsApp con tu mensaje
                escrito. Solo aprieta <strong>Enviar</strong>.
              </p>
              <a
                href={enlace}
                target="_blank"
                rel="noopener noreferrer"
                className="mc-btn mc-btn-pri w-100"
              >
                <FaWhatsapp size={17} aria-hidden="true" /> Abrir WhatsApp en esta computadora
              </a>
              <p className="mc-cotizar-nota">Si tienes WhatsApp Web o la app de escritorio.</p>
            </div>
          </div>
        )}

        <p className="mc-cotizar-vista-tit">Así llega tu mensaje</p>
        <div className="mc-cotizar-vista">
          <VistaMensaje texto={armarMensaje(datos)} />
        </div>

        <button
          type="button"
          className="mc-btn mc-btn-linea w-100 mt-4"
          onClick={() => setListo(false)}
        >
          <ArrowLeft aria-hidden="true" /> Corregir mis datos
        </button>
      </div>
    );
  }

  const hayErrores = intentado && Object.keys(errores).length > 0;

  return (
    <form className="mc-form mc-cotizar" onSubmit={alEnviarFormulario} noValidate ref={tarjeta}>
      <h3 className="mc-cotizar-titulo">Tu solicitud</h3>
      <p className="mc-cotizar-sub">
        Toma un minuto. Al final se abre WhatsApp con todo escrito.
      </p>

      <fieldset>
        <legend className="mc-cotizar-legend">¿Qué residuos tienen?</legend>

        {residuos.map((r, i) => {
          const pre = `residuo-${r.id}`;
          return (
            <div className="mc-cotizar-residuo" key={r.id}>
              <div className="mc-cotizar-residuo-cab">
                <span className="mc-cotizar-num">Residuo {i + 1}</span>
                {residuos.length > 1 && (
                  <button
                    type="button"
                    className="mc-cotizar-quitar"
                    onClick={() => quitar(r.id)}
                    aria-label={`Quitar el residuo ${i + 1}`}
                  >
                    Quitar
                  </button>
                )}
              </div>

              <div className="row g-3">
                <div className="col-12">
                  <Etiqueta id={`${pre}-tipo`} texto="Tipo de residuo" />
                  <select
                    {...propsCampo(`${pre}-tipo`, errores, "form-select")}
                    value={r.tipo}
                    onChange={(e) => cambiarResiduo(r.id, "tipo", e.target.value)}
                  >
                    <option value="" disabled>Selecciona una opción</option>
                    {TIPOS_RESIDUO.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <AvisoCampo id={`${pre}-tipo`} errores={errores} />
                </div>

                {r.tipo === OTRO && (
                  <div className="col-12">
                    <Etiqueta id={`${pre}-tipo-otro`} texto="¿Qué residuo es?" />
                    <input
                      {...propsCampo(`${pre}-tipo-otro`, errores)}
                      type="text"
                      maxLength={LARGO.otro}
                      placeholder="Ej. lodos, llantas, tóner"
                      value={r.tipoOtro}
                      onChange={(e) => cambiarResiduo(r.id, "tipoOtro", e.target.value)}
                    />
                    <AvisoCampo id={`${pre}-tipo-otro`} errores={errores} />
                  </div>
                )}

                {/* Cantidad y unidad en UN solo control, a todo lo ancho. En dos
                    columnas no cabían en un teléfono de 360px: la etiqueta se
                    partía en dos renglones y la unidad se leía "to" o "litr". */}
                <div className="col-12">
                  <Etiqueta id={`${pre}-cantidad`} texto="Cantidad al mes" />
                  <div className="input-group mc-cotizar-cantidad">
                    <input
                      {...propsCampo(`${pre}-cantidad`, errores)}
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      maxLength={LARGO.cantidad}
                      placeholder="Ej. 500"
                      value={r.cantidad}
                      onChange={(e) => cambiarResiduo(r.id, "cantidad", e.target.value)}
                    />
                    <select
                      id={`${pre}-unidad`}
                      className="form-select"
                      aria-label="Unidad"
                      value={r.unidad}
                      onChange={(e) => cambiarResiduo(r.id, "unidad", e.target.value)}
                    >
                      {UNIDADES.map((u) => (
                        <option key={u.id} value={u.id}>{u.corto}</option>
                      ))}
                    </select>
                  </div>
                  <AvisoCampo id={`${pre}-cantidad`} errores={errores} />
                </div>

                {/* Renglón propio: a media tarjeta, "Selecciona una opción" se cortaba. */}
                <div className="col-12">
                  <Etiqueta id={`${pre}-embalaje`} texto="¿Cómo lo tienen?" />
                  <select
                    {...propsCampo(`${pre}-embalaje`, errores, "form-select")}
                    value={r.embalaje}
                    onChange={(e) => cambiarResiduo(r.id, "embalaje", e.target.value)}
                  >
                    <option value="" disabled>Selecciona una opción</option>
                    {EMBALAJES.map((em) => (
                      <option key={em.texto} value={em.texto}>{em.texto}</option>
                    ))}
                  </select>
                  <AvisoCampo id={`${pre}-embalaje`} errores={errores} />
                </div>

                {r.embalaje === OTRO && (
                  <div className="col-12">
                    <Etiqueta id={`${pre}-embalaje-otro`} texto="Escribe cómo lo tienen" />
                    <input
                      {...propsCampo(`${pre}-embalaje-otro`, errores)}
                      type="text"
                      maxLength={LARGO.otro}
                      placeholder="Ej. cajas, sacos, contenedores IBC"
                      value={r.embalajeOtro}
                      onChange={(e) => cambiarResiduo(r.id, "embalajeOtro", e.target.value)}
                    />
                    <AvisoCampo id={`${pre}-embalaje-otro`} errores={errores} />
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {residuos.length < MAX_RESIDUOS && (
          <button type="button" className="mc-btn mc-btn-linea w-100" onClick={agregar}>
            <Plus aria-hidden="true" /> Agregar otro residuo
          </button>
        )}
      </fieldset>

      <fieldset className="mt-4 pt-2">
        <legend className="mc-cotizar-legend">¿Quién solicita?</legend>
        <div className="row g-3">
          <CampoTexto id="empresa" texto="Empresa" valor={contacto.empresa} alCambiar={cambiarContacto("empresa")}
            errores={errores} maxLength={LARGO.empresa} autoComplete="organization" placeholder="Nombre de la empresa" />
          <CampoTexto id="ciudad" texto="Ciudad o colonia" valor={contacto.ciudad} alCambiar={cambiarContacto("ciudad")}
            errores={errores} maxLength={LARGO.ciudad} autoComplete="off" placeholder="Ej. Matamoros, Parque Industrial" />
          <CampoTexto id="nombre" texto="Tu nombre" valor={contacto.nombre} alCambiar={cambiarContacto("nombre")}
            errores={errores} maxLength={LARGO.nombre} autoComplete="name" placeholder="Nombre y apellido" />
          <CampoTexto id="puesto" texto="Puesto" valor={contacto.puesto} alCambiar={cambiarContacto("puesto")}
            errores={errores} maxLength={LARGO.puesto} autoComplete="organization-title" placeholder="Ej. Gerente de planta" />
        </div>
      </fieldset>

      {hayErrores && (
        <p className="mc-cotizar-aviso" role="alert">
          Falta completar los campos marcados.
        </p>
      )}

      <a
        href={enlace}
        target="_blank"
        rel="noopener noreferrer"
        className="mc-btn mc-btn-pri w-100 mt-4"
        onClick={alTocarEnviar}
      >
        <FaWhatsapp size={17} aria-hidden="true" /> Enviar por WhatsApp
      </a>
      <p className="mc-cotizar-nota text-center">
        Se abre WhatsApp con tu mensaje escrito; solo aprietas Enviar. Al enviarlo
        aceptas nuestro{" "}
        {/* Pestaña nueva: en la misma se perdería lo ya escrito (ver FormularioCotizacion). */}
        <a href="/aviso-de-privacidad" target="_blank" rel="noopener noreferrer">
          Aviso de Privacidad
        </a>
        .
      </p>
    </form>
  );
}

/** Las props que comparten todos los campos obligatorios: id, clase y avisos accesibles. */
function propsCampo(id, errores, clase = "form-control") {
  const error = errores[id];
  return {
    id,
    name: id,
    className: `${clase}${error ? " is-invalid" : ""}`,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : undefined,
    required: true,
  };
}

function Etiqueta({ id, texto }) {
  return (
    <label htmlFor={id}>
      {texto} <span className="mc-requerido" aria-hidden="true">*</span>
    </label>
  );
}

function AvisoCampo({ id, errores }) {
  if (!errores[id]) return null;
  return (
    <div id={`${id}-error`} className="invalid-feedback d-block">
      {errores[id]}
    </div>
  );
}

function CampoTexto({ id, texto, valor, alCambiar, errores, ...resto }) {
  return (
    <div className="col-md-6">
      <Etiqueta id={id} texto={texto} />
      <input
        {...propsCampo(id, errores)}
        type="text"
        value={valor}
        onChange={alCambiar}
        {...resto}
      />
      <AvisoCampo id={id} errores={errores} />
    </div>
  );
}

/** El mensaje como se verá en WhatsApp: los `*así*` salen en negrita. */
function VistaMensaje({ texto }) {
  return texto.split("\n").map((linea, i) => (
    <span className="d-block" key={i}>
      {linea === ""
        ? " "
        : linea.split(/(\*[^*]+\*)/g).map((trozo, j) =>
            /^\*[^*]+\*$/.test(trozo) ? <strong key={j}>{trozo.slice(1, -1)}</strong> : trozo
          )}
    </span>
  ));
}
