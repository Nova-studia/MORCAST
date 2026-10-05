"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  CheckCircle,
  WarningCircle,
  MapPin,
  ArrowRight,
  ArrowLeft,
  UploadSimple,
  FileText,
  PencilSimple,
  ArrowSquareOut,
} from "@phosphor-icons/react/dist/ssr";
import { RUTAS_SEED, USOS_CFDI, FORMAS_PAGO, nombreTipoRuta } from "@/lib/rutas-datos";
import { rutasQueCubren } from "@/lib/punto-en-zona.mjs";
import { EQUIPO_RENTA } from "@/lib/cotizacion-datos";
import { TIPOS_SERVICIO } from "@/lib/datos";
import {
  validarAlta,
  validarFirmante,
  TIPOS_CONSTANCIA,
  MAX_CONSTANCIA_BYTES,
  TEXTO_MAX_CONSTANCIA,
} from "@/lib/alta-firma.mjs";
import { CLAUSULAS, NOTA_BORRADOR, VERSION_TERMINOS, RUTA_AVISO_PRIVACIDAD } from "@/lib/terminos.mjs";
import { zonasDeCobertura } from "@/app/acciones-alta";
import FirmaDibujada from "@/components/portal/FirmaDibujada";
import AltaExitosa from "@/components/portal/AltaExitosa";

// Leaflet solo corre en el navegador.
const MapaZonas = dynamic(() => import("@/components/MapaZonas"), {
  ssr: false,
  loading: () => <div className="mc-mapa" style={{ height: 420 }} />,
});

const VACIO = {
  empresa: "",
  contacto: "",
  telefono: "",
  correo: "",
  alias: "",
  calle: "",
  colonia: "",
  cp: "",
  referencias: "",
  horarioAcceso: "",
  serviciosPorMes: 4,
  rfc: "",
  razonSocial: "",
  domicilioFiscal: "",
  usoCFDI: USOS_CFDI[0],
  formaPago: FORMAS_PAGO[0],
  representanteNombre: "",
  representanteCargo: "",
  facturacionNombre: "",
  facturacionCorreo: "",
  facturacionTelefono: "",
};

const CATALOGOS = { residuos: TIPOS_SERVICIO, equipo: EQUIPO_RENTA, usosCfdi: USOS_CFDI, formasPago: FORMAS_PAGO };

/** Los campos que viven en el paso 2: un error en ellos NO regresa al paso 1. */
const CAMPOS_DE_FIRMA = new Set(["acepta", "firmanteNombre", "firma"]);

const PASOS = ["Tus datos", "Revisa y firma", "Listo"];

/**
 * EL ALTA DEL CLIENTE CON FIRMA ELECTRÓNICA — la misma pantalla para las dos
 * puertas: el formulario público (`/portal/alta`) y el registro con Google
 * (`/portal/registro`). Pedido del socio (5-oct-2026): que las dos terminen
 * igual, con alta amplia, firma, PDF y "¡Alta exitosa!".
 *
 * Tres pasos:
 *   1. Tus datos — lo de siempre (mapa, domicilio, equipo, contacto,
 *      residuos, facturación) más lo del alta amplia: representante legal,
 *      contacto de facturación, horario de acceso y la Constancia de
 *      Situación Fiscal.
 *   2. Revisa y firma — el resumen, los Términos completos con su enlace al
 *      Aviso de privacidad, la casilla de aceptación y el recuadro de firma.
 *   3. ¡Alta exitosa! — folio, PDF para descargar y el aviso del correo.
 *
 * La pantalla valida con las MISMAS reglas que el servidor
 * (`lib/alta-firma.mjs`) sólo para no hacer esperar a nadie por un error que
 * ya se veía; quien decide es la acción de servidor.
 *
 * ⚠️ No se piden datos bancarios del cliente. Ver el constraint del plan.
 *
 * @param {"publico"|"google"} modo
 * @param {{nombre:string, correo:string}|null} quien  en modo Google, de la sesión
 * @param {(fd: FormData) => Promise<object>} enviarAlta  la acción de servidor
 * @param {(r: object) => React.ReactNode} accionesFinales  botones del paso 3
 */
export default function AltaConFirma({ modo = "publico", quien = null, enviarAlta, accionesFinales }) {
  const google = modo === "google";
  const [paso, setPaso] = useState(0);
  const [datos, setDatos] = useState(() => ({
    ...VACIO,
    contacto: quien?.nombre || "",
    correo: quien?.correo || "",
  }));
  const [pin, setPin] = useState(null);
  const [residuos, setResiduos] = useState([]);
  const [equipo, setEquipo] = useState({}); // "Tolvas|30" -> cantidad
  const [constancia, setConstancia] = useState(null); // { archivo, nombre, url, esImagen }
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);

  // Paso 2
  const [acepta, setAcepta] = useState(false);
  const [firmado, setFirmado] = useState(false);
  const [firmante, setFirmante] = useState({ nombre: "", cargo: "" });
  const firmaRef = useRef(null);
  const inputConstancia = useRef(null);

  // Las zonas REALES, las que Morcast dibuja en el panel. RUTAS_SEED queda solo
  // de respaldo por si la base no responde, para que el mapa no quede vacío.
  const [rutas, setRutas] = useState(RUTAS_SEED);
  useEffect(() => {
    let vivo = true;
    zonasDeCobertura().then((r) => {
      if (vivo && Array.isArray(r) && r.length) setRutas(r);
    });
    return () => { vivo = false; };
  }, []);

  // La vista previa de la constancia es un Blob local: se suelta al cambiarla.
  useEffect(() => () => { if (constancia?.url) URL.revokeObjectURL(constancia.url); }, [constancia]);

  const campo = (k) => (e) => setDatos((d) => ({ ...d, [k]: e.target.value }));

  const zonas = useMemo(
    () =>
      rutas.filter((r) => r.activa).map((r) => ({
        id: r.id,
        nombre: `${r.nombre} · ${nombreTipoRuta(r.tipo)}`,
        poligono: r.zona,
      })),
    [rutas]
  );

  // Se recalcula mientras mueve el pin: la respuesta es inmediata, sin enviar nada.
  const cubren = useMemo(() => (pin ? rutasQueCubren(pin, rutas) : []), [pin, rutas]);

  const alternarResiduo = (t) =>
    setResiduos((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const cantidadEquipo = (tipo, medida, valor) => {
    const n = Math.max(0, Math.min(20, Number(valor) || 0));
    setEquipo((prev) => ({ ...prev, [`${tipo}|${medida}`]: n }));
  };

  const equipoElegido = Object.entries(equipo)
    .filter(([, n]) => n > 0)
    .map(([clave, cantidad]) => {
      const [tipo, medida] = clave.split("|");
      return { tipo, medida, cantidad };
    });

  /** Lo que se manda, armado igual para validar aquí y en el servidor. */
  const entrada = () => ({
    ...datos,
    // El pin viene como [lat, lng] (así lo entrega el mapa), no como objeto.
    lat: pin?.[0] ?? "",
    lng: pin?.[1] ?? "",
    residuos,
    equipo: equipoElegido,
  });

  /** Lleva el foco al campo con el error, para que no haya que buscarlo. */
  const enfocar = (nombre) => {
    const id = nombre === "mapa" ? "alta-mapa" : nombre === "residuos" ? "alta-residuos" : nombre;
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    if (typeof el.focus === "function") el.focus({ preventScroll: true });
  };

  const elegirConstancia = (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;
    setError("");
    if (archivo.size > MAX_CONSTANCIA_BYTES) {
      setError(TEXTO_MAX_CONSTANCIA);
      enfocar("constancia-zona");
      return;
    }
    if (!TIPOS_CONSTANCIA.includes(archivo.type)) {
      setError("La Constancia de Situación Fiscal tiene que ser PDF, JPG o PNG.");
      return;
    }
    const esImagen = archivo.type.startsWith("image/");
    setConstancia({
      archivo,
      nombre: archivo.name,
      kb: Math.max(1, Math.round(archivo.size / 1024)),
      esImagen,
      url: esImagen ? URL.createObjectURL(archivo) : null,
    });
  };

  /* ---------------- paso 1 → paso 2 ---------------- */
  const aRevisar = (e) => {
    e.preventDefault();
    setError("");
    const v = validarAlta(entrada(), CATALOGOS);
    if (!v.ok) {
      setError(v.motivo);
      enfocar(v.campo);
      return;
    }
    // Quien firma suele ser la persona de contacto: se le adelanta el nombre,
    // y lo cambia si firma otra persona (el representante, por ejemplo).
    setFirmante((f) => (f.nombre ? f : { ...f, nombre: datos.contacto.trim() }));
    setPaso(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /* ---------------- paso 2: firmar y enviar ---------------- */
  const puedeFirmar = acepta && firmado && firmante.nombre.trim().length > 0 && !enviando;

  const firmarYEnviar = async (e) => {
    e.preventDefault();
    setError("");
    const vf = validarFirmante({ ...firmante, acepta });
    if (!vf.ok) {
      setError(vf.motivo);
      enfocar(vf.campo === "acepta" ? "alta-acepto" : "firmanteNombre");
      return;
    }
    const png = await firmaRef.current?.exportarPng();
    if (!png) {
      setError("Falta tu firma: dibújala en el recuadro.");
      return;
    }

    const fd = new FormData();
    fd.append("datos", JSON.stringify(entrada()));
    fd.append("firma", new File([png], "firma.png", { type: "image/png" }));
    if (constancia?.archivo) fd.append("constancia", constancia.archivo);
    fd.append("firmanteNombre", firmante.nombre);
    fd.append("firmanteCargo", firmante.cargo);
    fd.append("acepta", "si");

    // Se bloquea mientras se manda: sin esto un doble clic da de alta dos
    // veces al mismo cliente, y a Morcast le llegan dos correos.
    setEnviando(true);
    let r;
    try {
      r = await enviarAlta(fd);
    } catch (err) {
      console.error("[alta] no se pudo enviar:", err);
      r = { ok: false, motivo: "No se pudo enviar. Revisa tu conexión e inténtalo de nuevo." };
    }
    setEnviando(false);

    if (!r?.ok) {
      setError(r?.motivo || "No se pudo enviar. Inténtalo de nuevo.");
      // Si el servidor encontró algo en los datos, se regresa a corregirlo.
      if (r?.campo && !CAMPOS_DE_FIRMA.has(r.campo)) {
        setPaso(0);
        setTimeout(() => enfocar(r.campo), 60);
      }
      return;
    }
    setResultado(r);
    setPaso(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const reiniciar = () => {
    setResultado(null);
    setDatos({ ...VACIO, contacto: quien?.nombre || "", correo: quien?.correo || "" });
    setPin(null);
    setResiduos([]);
    setEquipo({});
    setConstancia(null);
    setAcepta(false);
    setFirmado(false);
    setFirmante({ nombre: "", cargo: "" });
    setPaso(0);
  };

  return (
    <>
      <ol className="pt-pasos" aria-label="Pasos del alta">
        {PASOS.map((p, i) => {
          // Al llegar a "Listo" ya no queda nada pendiente: se pinta hecho.
          const hecho = i < paso || paso === PASOS.length - 1;
          return (
          <li key={p} className={hecho ? "hecho" : i === paso ? "activo" : ""} aria-current={i === paso ? "step" : undefined}>
            <span className="pt-pasos-num">{hecho ? <CheckCircle weight="fill" aria-hidden="true" /> : i + 1}</span>
            {p}
          </li>
          );
        })}
      </ol>

      {paso === 2 && resultado ? (
        <Exito resultado={resultado} google={google} acciones={accionesFinales ? accionesFinales(resultado, reiniciar) : (
          <button type="button" className="pt-btn" onClick={reiniciar}>Dar de alta otro domicilio</button>
        )} />
      ) : paso === 1 ? (
        /* ============================ PASO 2 ============================ */
        <form onSubmit={firmarYEnviar} noValidate>
          <div className="pt-grid pt-grid-mapa">
            <div className="pt-card">
              <div className="pt-card-head">
                <h2>Revisa tu solicitud</h2>
                <button type="button" className="pt-btn" onClick={() => { setError(""); setPaso(0); }}>
                  <PencilSimple aria-hidden="true" /> Corregir datos
                </button>
              </div>
              <Resumen datos={datos} pin={pin} residuos={residuos} equipo={equipoElegido} cubren={cubren} constancia={constancia} />
            </div>

            <div>
              <div className="pt-card">
                <div className="pt-card-head">
                  <h2>Términos del servicio</h2>
                </div>
                <p className="pt-nota-borrador" role="note">
                  <WarningCircle aria-hidden="true" />
                  <span><strong>Borrador.</strong> {NOTA_BORRADOR}</span>
                </p>
                <div className="pt-terminos" tabIndex={0} role="region" aria-label="Texto completo de los Términos del servicio">
                  <p className="pt-terminos-version">Versión {VERSION_TERMINOS}</p>
                  {CLAUSULAS.map((c) => (
                    <section key={c.titulo}>
                      <h3>{c.titulo}</h3>
                      {c.parrafos.map((p, i) => <p key={i}>{p}</p>)}
                    </section>
                  ))}
                </div>
                <p className="pt-terminos-enlace">
                  Tus datos se tratan conforme al{" "}
                  <a href={RUTA_AVISO_PRIVACIDAD} target="_blank" rel="noopener noreferrer">
                    Aviso de privacidad <ArrowSquareOut aria-hidden="true" />
                  </a>
                  .
                </p>
                <label className="pt-acepto" htmlFor="alta-acepto">
                  <input id="alta-acepto" type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} />
                  <span>
                    He leído y acepto los <strong>Términos del servicio</strong> y el{" "}
                    <strong>Aviso de privacidad</strong> de Morcast del Norte, y declaro que la información de esta
                    solicitud es verdadera.
                  </span>
                </label>
              </div>

              <div className="pt-card" style={{ marginTop: "1.1rem" }}>
                <div className="pt-card-head">
                  <h2 id="alta-firma-titulo">Tu firma</h2>
                </div>
                <FirmaDibujada ref={firmaRef} onCambio={setFirmado} etiquetaId="alta-firma-titulo" />
                <div className="pt-campo" style={{ marginTop: "1rem" }}>
                  <label htmlFor="firmanteNombre">Nombre completo de quien firma</label>
                  <input
                    id="firmanteNombre"
                    className="pt-input"
                    autoComplete="name"
                    maxLength={120}
                    value={firmante.nombre}
                    onChange={(e) => setFirmante((f) => ({ ...f, nombre: e.target.value }))}
                    required
                  />
                </div>
                <div className="pt-campo">
                  <label htmlFor="firmanteCargo">Cargo <span className="pt-opcional">(opcional)</span></label>
                  <input
                    id="firmanteCargo"
                    className="pt-input"
                    autoComplete="organization-title"
                    maxLength={80}
                    placeholder="Gerente de planta, Compras, Apoderado legal…"
                    value={firmante.cargo}
                    onChange={(e) => setFirmante((f) => ({ ...f, cargo: e.target.value }))}
                  />
                </div>
                <p className="mc-mapa-nota">
                  Es una firma electrónica: guardamos tu firma, tu nombre, la fecha y hora, y los datos del equipo
                  desde donde firmas, y te mandamos el PDF.
                </p>

                {error && <div className="pt-login-error" role="alert" style={{ marginTop: "1rem" }}>{error}</div>}

                <button
                  type="submit"
                  className="pt-btn pt-btn-verde pt-btn-ancho"
                  disabled={!puedeFirmar}
                  aria-describedby="alta-falta"
                >
                  {enviando ? "Firmando y generando tu PDF…" : <>Firmar y enviar solicitud <ArrowRight aria-hidden="true" /></>}
                </button>
                {!puedeFirmar && !enviando && (
                  <p id="alta-falta" className="pt-falta">
                    Falta: {[!acepta && "aceptar los términos", !firmado && "tu firma", !firmante.nombre.trim() && "tu nombre"]
                      .filter(Boolean).join(", ")}.
                  </p>
                )}
                <button type="button" className="pt-btn pt-btn-ancho-sec" onClick={() => { setError(""); setPaso(0); }}>
                  <ArrowLeft aria-hidden="true" /> Regresar a mis datos
                </button>
              </div>
            </div>
          </div>
        </form>
      ) : (
        /* ============================ PASO 1 ============================ */
        <form onSubmit={aRevisar} noValidate>
          <div className="pt-grid pt-grid-mapa">
            {/* ---------- Columna del mapa ---------- */}
            <div className="pt-card">
              <div className="pt-card-head">
                <h2>¿Dónde recogemos?</h2>
              </div>
              <div id="alta-mapa" tabIndex={-1}>
                <MapaZonas zonas={zonas} pin={pin} onPin={setPin} alto="440px" />
              </div>
              <p className="mc-mapa-nota">
                <MapPin aria-hidden="true" /> Toca el mapa para colocar tu domicilio.
              </p>

              {pin && cubren.length > 0 && (
                <p className="pt-cobertura si">
                  <CheckCircle aria-hidden="true" /> Sí llegamos: {cubren.map((r) => r.nombre).join(", ")}
                </p>
              )}
              {pin && cubren.length === 0 && (
                <p className="pt-cobertura no">
                  <WarningCircle aria-hidden="true" /> Aún no hay ruta ahí. Puedes seguir: tu alta entra como
                  solicitud de zona nueva.
                </p>
              )}

              <div className="pt-card-head" style={{ marginTop: "1.4rem" }}>
                <h2>Domicilio</h2>
              </div>
              <div className="pt-campo">
                <label htmlFor="alias">Nombre del domicilio</label>
                <input id="alias" className="pt-input" value={datos.alias} onChange={campo("alias")} placeholder="Planta 1, Matriz, Sucursal centro…" maxLength={80} />
              </div>
              <div className="pt-campo">
                <label htmlFor="calle">Calle y número</label>
                <input id="calle" className="pt-input" value={datos.calle} onChange={campo("calle")} maxLength={160} autoComplete="address-line1" />
              </div>
              <div className="pt-grid pt-grid-2">
                <div className="pt-campo">
                  <label htmlFor="colonia">Colonia</label>
                  <input id="colonia" className="pt-input" value={datos.colonia} onChange={campo("colonia")} maxLength={120} />
                </div>
                <div className="pt-campo">
                  <label htmlFor="cp">Código postal</label>
                  <input id="cp" className="pt-input" inputMode="numeric" maxLength={5} value={datos.cp} onChange={campo("cp")} autoComplete="postal-code" />
                </div>
              </div>
              <div className="pt-campo">
                <label htmlFor="referencias">Referencias para el chofer</label>
                <input id="referencias" className="pt-input" value={datos.referencias} onChange={campo("referencias")} placeholder="Portón azul, entrada por el andén…" maxLength={400} />
              </div>
              <div className="pt-campo">
                <label htmlFor="horarioAcceso">Horario de acceso al punto <span className="pt-opcional">(opcional)</span></label>
                <input id="horarioAcceso" className="pt-input" value={datos.horarioAcceso} onChange={campo("horarioAcceso")} placeholder="L-V 8:00 a 17:00, portón 3" maxLength={200} />
              </div>

              <div className="pt-card-head" style={{ marginTop: "1.4rem" }}>
                <h2>Equipo que necesitas</h2>
              </div>
              {EQUIPO_RENTA.map((e) => (
                <div key={e.tipo} className="pt-equipo-fila">
                  <span>{e.tipo}</span>
                  {e.medidas.map((m) => (
                    <label key={m} className="pt-equipo-med">
                      {m}
                      <input
                        className="pt-input"
                        type="number"
                        min="0"
                        max="20"
                        value={equipo[`${e.tipo}|${m}`] ?? 0}
                        onChange={(ev) => cantidadEquipo(e.tipo, m, ev.target.value)}
                        aria-label={`${e.tipo} ${m}`}
                      />
                    </label>
                  ))}
                </div>
              ))}
              <p className="mc-mapa-nota">Déjalo en cero si aún no lo sabes.</p>
            </div>

            {/* ---------- Columna de datos ---------- */}
            <div>
              <div className="pt-card">
                <div className="pt-card-head">
                  <h2>Contacto</h2>
                </div>
                <div className="pt-campo">
                  <label htmlFor="empresa">Empresa o negocio</label>
                  <input id="empresa" className="pt-input" value={datos.empresa} onChange={campo("empresa")} maxLength={120} autoComplete="organization" />
                </div>
                <div className="pt-campo">
                  <label htmlFor="contacto">Persona de contacto</label>
                  <input id="contacto" className="pt-input" value={datos.contacto} onChange={campo("contacto")} maxLength={120} autoComplete="name" />
                </div>
                <div className="pt-campo">
                  <label htmlFor="telefono">Teléfono o WhatsApp</label>
                  <input id="telefono" className="pt-input" type="tel" inputMode="tel" value={datos.telefono} onChange={campo("telefono")} placeholder="868 000 0000" maxLength={30} autoComplete="tel" />
                </div>
                <div className="pt-campo">
                  <label htmlFor="correo">Correo</label>
                  {google ? (
                    <>
                      {/* El correo de la cuenta de Google: el servidor lo toma de
                          la sesión, así que aquí sólo se enseña. */}
                      <input id="correo" className="pt-input" type="email" value={datos.correo} readOnly aria-readonly="true" />
                      <p className="pt-ayuda">Es el de tu cuenta de Google, ya verificado.</p>
                    </>
                  ) : (
                    <>
                      <input id="correo" className="pt-input" type="email" value={datos.correo} onChange={campo("correo")} maxLength={160} autoComplete="email" />
                      <p className="pt-ayuda">Ahí te llega el PDF y un enlace para confirmar tu solicitud.</p>
                    </>
                  )}
                </div>
              </div>

              <div className="pt-card" style={{ marginTop: "1.1rem" }}>
                <div className="pt-card-head">
                  <h2>Representante legal</h2>
                  <span className="pt-opcional">opcional</span>
                </div>
                <div className="pt-grid pt-grid-2">
                  <div className="pt-campo">
                    <label htmlFor="representanteNombre">Nombre</label>
                    <input id="representanteNombre" className="pt-input" value={datos.representanteNombre} onChange={campo("representanteNombre")} maxLength={120} />
                  </div>
                  <div className="pt-campo">
                    <label htmlFor="representanteCargo">Cargo</label>
                    <input id="representanteCargo" className="pt-input" value={datos.representanteCargo} onChange={campo("representanteCargo")} placeholder="Apoderado legal" maxLength={80} />
                  </div>
                </div>
              </div>

              <div className="pt-card" style={{ marginTop: "1.1rem" }}>
                <div className="pt-card-head">
                  <h2>Qué generas</h2>
                </div>
                <div className="pt-checks" id="alta-residuos" tabIndex={-1}>
                  {TIPOS_SERVICIO.map((t) => (
                    <label key={t}>
                      <input type="checkbox" checked={residuos.includes(t)} onChange={() => alternarResiduo(t)} />
                      {t}
                    </label>
                  ))}
                </div>

                {/* Antes esto era una lista (semanal / quincenal / mensual) y no
                    servía: casi ningún negocio genera lo mismo todas las semanas.
                    Ahora dice cuántas necesita AL MES y él las reparte. */}
                <div className="pt-campo" style={{ marginTop: "1.1rem" }}>
                  <label htmlFor="serviciosPorMes">Recolecciones al mes</label>
                  <input
                    id="serviciosPorMes"
                    className="pt-input"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={200}
                    step={1}
                    style={{ maxWidth: 160 }}
                    value={datos.serviciosPorMes}
                    onChange={campo("serviciosPorMes")}
                  />
                  <p className="pt-ayuda">
                    Cuántas veces al mes pasamos en total. Tú decides cómo repartirlas entre las semanas: por
                    ejemplo 2 la primera, 4 la segunda, 3 la tercera y 6 la última.
                  </p>
                </div>
              </div>

              <div className="pt-card" style={{ marginTop: "1.1rem" }}>
                <div className="pt-card-head">
                  <h2>Facturación <span className="pt-opcional">(opcional)</span></h2>
                </div>
                {/* Opcional mientras Morcast define cómo va a facturar (5-oct-2026). */}
                <p className="pt-ayuda" style={{ marginTop: 0 }}>
                  Si todavía no tienes estos datos a la mano, déjalos en blanco: te los pediremos
                  cuando se defina la facturación.
                </p>
                <div className="pt-campo">
                  <label htmlFor="razonSocial">Razón social</label>
                  <input id="razonSocial" className="pt-input" value={datos.razonSocial} onChange={campo("razonSocial")} maxLength={160} />
                </div>
                <div className="pt-campo">
                  <label htmlFor="rfc">RFC</label>
                  <input id="rfc" className="pt-input" value={datos.rfc} onChange={campo("rfc")} style={{ textTransform: "uppercase" }} maxLength={14} autoCapitalize="characters" />
                </div>
                <div className="pt-campo">
                  <label htmlFor="domicilioFiscal">Domicilio fiscal</label>
                  <input id="domicilioFiscal" className="pt-input" value={datos.domicilioFiscal} onChange={campo("domicilioFiscal")} maxLength={240} />
                </div>
                {/* A todo lo ancho: en dos columnas el uso de CFDI se cortaba en "G03 — Gastos". */}
                <div className="pt-campo">
                  <label htmlFor="usoCFDI">Uso de CFDI</label>
                  <select id="usoCFDI" className="pt-input" value={datos.usoCFDI} onChange={campo("usoCFDI")}>
                    <option value="">Lo definimos después</option>
                    {USOS_CFDI.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div className="pt-campo">
                  <label htmlFor="formaPago">Forma de pago preferida</label>
                  <select id="formaPago" className="pt-input" value={datos.formaPago} onChange={campo("formaPago")}>
                    <option value="">Lo definimos después</option>
                    {FORMAS_PAGO.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>

                <p className="pt-subtitulo">Contacto de facturación <span className="pt-opcional">(opcional)</span></p>
                <div className="pt-campo">
                  <label htmlFor="facturacionNombre">Nombre o área</label>
                  <input id="facturacionNombre" className="pt-input" value={datos.facturacionNombre} onChange={campo("facturacionNombre")} placeholder="Cuentas por pagar" maxLength={120} />
                </div>
                <div className="pt-grid pt-grid-2">
                  <div className="pt-campo">
                    <label htmlFor="facturacionCorreo">Correo</label>
                    <input id="facturacionCorreo" className="pt-input" type="email" value={datos.facturacionCorreo} onChange={campo("facturacionCorreo")} maxLength={160} />
                  </div>
                  <div className="pt-campo">
                    <label htmlFor="facturacionTelefono">Teléfono</label>
                    <input id="facturacionTelefono" className="pt-input" type="tel" inputMode="tel" value={datos.facturacionTelefono} onChange={campo("facturacionTelefono")} maxLength={30} />
                  </div>
                </div>

                <p className="pt-subtitulo">Constancia de Situación Fiscal <span className="pt-opcional">(opcional)</span></p>
                <label className="pt-dropzone" htmlFor="constancia" id="constancia-zona">
                  <input id="constancia" ref={inputConstancia} type="file" accept="application/pdf,image/jpeg,image/png" hidden onChange={elegirConstancia} />
                  {constancia ? (
                    <div className="pt-dropzone-archivo">
                      {constancia.esImagen ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={constancia.url} alt="Constancia de Situación Fiscal" />
                      ) : (
                        <div className="pt-dropzone-pdf"><FileText /></div>
                      )}
                      <div>
                        <strong>{constancia.nombre}</strong>
                        <span>{constancia.kb} KB · toca para cambiarla</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <UploadSimple aria-hidden="true" />
                      <strong>Sube tu constancia</strong>
                      <span>PDF, JPG o PNG · máximo 3.5 MB</span>
                    </>
                  )}
                </label>
                {constancia && (
                  <button type="button" className="pt-btn" style={{ marginTop: "0.6rem" }} onClick={() => setConstancia(null)}>
                    Quitar la constancia
                  </button>
                )}

                {/* No se piden banco, cuenta ni CLABE del cliente: Morcast cobra a su
                    propia cuenta y guardarlos solo agrega riesgo. */}
                <p className="mc-mapa-nota">
                  No te pedimos banco, cuenta ni CLABE. El cobro se hace contra tu factura.
                </p>
              </div>

              {error && <div className="pt-login-error" role="alert" style={{ marginTop: "1.1rem" }}>{error}</div>}

              <button type="submit" className="pt-btn pt-btn-verde pt-btn-ancho">
                Continuar: revisar y firmar <ArrowRight aria-hidden="true" />
              </button>
            </div>
          </div>
        </form>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */

function Resumen({ datos, pin, residuos, equipo, cubren, constancia }) {
  const filas = [
    ["Empresa", [
      ["Empresa o negocio", datos.empresa],
      ["Razón social", datos.razonSocial],
      ["RFC", datos.rfc.toUpperCase()],
      ["Domicilio fiscal", datos.domicilioFiscal],
      ["Uso de CFDI", datos.usoCFDI],
      ["Forma de pago", datos.formaPago],
      ["Constancia fiscal", constancia ? `${constancia.nombre} (${constancia.kb} KB)` : "No adjuntaste"],
    ]],
    ["Contactos", [
      ["Contacto", [datos.contacto, datos.telefono].filter(Boolean).join(" · ")],
      ["Correo", datos.correo],
      ["Representante legal", [datos.representanteNombre, datos.representanteCargo].filter(Boolean).join(" · ")],
      ["Facturación", [datos.facturacionNombre, datos.facturacionCorreo, datos.facturacionTelefono].filter(Boolean).join(" · ")],
    ]],
    ["Punto de recolección", [
      ["Nombre", datos.alias],
      ["Domicilio", [datos.calle, datos.colonia, datos.cp && `C.P. ${datos.cp}`].filter(Boolean).join(", ")],
      ["Referencias", datos.referencias],
      ["Horario de acceso", datos.horarioAcceso],
      ["Cobertura", pin ? (cubren.length ? `Sí: ${cubren.map((r) => r.nombre).join(", ")}` : "Zona nueva, a evaluación") : ""],
    ]],
    ["Servicio", [
      ["Residuos", residuos.join(", ")],
      ["Equipo", equipo.map((e) => `${e.cantidad} × ${e.tipo} ${e.medida}`).join(", ") || "Por definir"],
      ["Recolecciones al mes", String(datos.serviciosPorMes)],
    ]],
  ];
  return (
    <div className="pt-resumen">
      {filas.map(([titulo, pares]) => (
        <section key={titulo}>
          <h3>{titulo}</h3>
          <dl>
            {pares.filter(([, v]) => v).map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

function Exito({ resultado: r, google, acciones }) {
  const aviso =
    r.correo === "enviado"
      ? {
          tipo: "correo",
          texto: r.correoConfirmado
            ? `Te mandamos tu solicitud firmada a ${google ? "tu correo de Google" : "tu correo"}.`
            : "Te mandamos un correo para confirmar tu solicitud. Ábrelo y toca \"Confirmar mi solicitud\" (el enlace dura 7 días).",
        }
      : r.correo === "fallo"
        ? { tipo: "alerta", texto: "Tu solicitud quedó guardada, pero no pudimos mandarte el correo. Descarga tu PDF aquí; Morcast ya la tiene y te contactará." }
        : { tipo: "alerta", texto: "Modo de prueba: en este entorno no se guardan solicitudes ni se mandan correos. En el sitio real te llegaría el correo para confirmar tu solicitud." };

  return (
    <AltaExitosa folio={r.folio} pdfBase64={r.pdfBase64} nombrePdf={r.nombrePdf} aviso={aviso} acciones={acciones}>
      <p>
        Tu Solicitud de alta quedó <strong>firmada electrónicamente</strong>.{" "}
        {r.enCobertura
          ? "Tu domicilio queda dentro de nuestras rutas: Morcast revisa el alta y te confirma el precio y el día de arranque."
          : "Todavía no hay ruta por tu zona: tu solicitud entra a evaluación para abrir una nueva y te buscamos con la respuesta."}
      </p>
      {r.enCobertura && r.rutas?.length > 0 && (
        <ul className="pt-exitosa-rutas">
          {r.rutas.map((ruta) => (
            <li key={ruta.id}>
              <strong>{ruta.nombre}</strong>
              <span>{nombreTipoRuta(ruta.tipo)}{ruta.dias?.length ? ` · pasa ${ruta.dias.join(", ")}` : ""}</span>
            </li>
          ))}
        </ul>
      )}
    </AltaExitosa>
  );
}
