"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { FiCheckCircle, FiAlertCircle, FiMapPin, FiArrowRight } from "react-icons/fi";
import {
  RUTAS_SEED,
  ZONAS_PEDIDAS_SEED,
  USOS_CFDI,
  FORMAS_PAGO,
  nombreTipoRuta,
  idZonaPedida,
} from "@/lib/rutas-datos";
import { rutasQueCubren } from "@/lib/punto-en-zona.mjs";
import { EQUIPO_RENTA } from "@/lib/cotizacion-datos";
import { TIPOS_SERVICIO } from "@/lib/datos";
import { registrarAlta, zonasDeCobertura } from "@/app/acciones-alta";

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
  serviciosPorMes: 4,
  rfc: "",
  razonSocial: "",
  domicilioFiscal: "",
  usoCFDI: USOS_CFDI[0],
  formaPago: FORMAS_PAGO[0],
};

/** Formato de RFC: 12 caracteres persona moral, 13 persona física. No valida ante el SAT. */
const RFC_RE = /^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/i;

/**
 * Alta de cliente. Pantalla PÚBLICA: la usa quien todavía no tiene sesión, por eso
 * está exenta del shell protegido en `app/(portal)/layout.js`.
 *
 * El alta SÍ se guarda: `registrarAlta` la escribe en `solicitudes_alta` desde el
 * servidor y dispara dos correos (aviso a Morcast y acuse a quien se dio de alta).
 * Morcast la trabaja en el panel, en Altas de clientes.
 *
 * ⚠️ No se piden datos bancarios del cliente. Ver el constraint del plan.
 */
export default function AltaCliente() {
  const [datos, setDatos] = useState(VACIO);
  const [pin, setPin] = useState(null);
  const [residuos, setResiduos] = useState([]);
  const [equipo, setEquipo] = useState({}); // "Tolvas|30" -> cantidad
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState(null);
  const [enviando, setEnviando] = useState(false);

  // Las zonas REALES, las que Morcast dibuja en el panel. Antes venían escritas
  // a mano en el código: al redibujar una zona, esta pantalla seguía contestando
  // con las viejas. RUTAS_SEED queda solo de respaldo por si la base no responde,
  // para que la pantalla no se quede en blanco.
  const [rutas, setRutas] = useState(RUTAS_SEED);
  useEffect(() => {
    let vivo = true;
    zonasDeCobertura().then((r) => {
      if (vivo && Array.isArray(r) && r.length) setRutas(r);
    });
    return () => { vivo = false; };
  }, []);

  const campo = (k) => (e) => setDatos({ ...datos, [k]: e.target.value });

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
    const n = Math.max(0, Number(valor) || 0);
    setEquipo((prev) => ({ ...prev, [`${tipo}|${medida}`]: n }));
  };

  const enviar = async (e) => {
    e.preventDefault();
    setError("");

    if (!pin) {
      setError("Falta marcar el domicilio en el mapa.");
      return;
    }
    if (!residuos.length) {
      setError("Elige al menos un tipo de residuo.");
      return;
    }
    if (!RFC_RE.test(datos.rfc.trim())) {
      setError("El RFC no tiene el formato correcto (12 o 13 caracteres).");
      return;
    }
    const porMes = Number.parseInt(datos.serviciosPorMes, 10);
    if (!Number.isFinite(porMes) || porMes < 1 || porMes > 200) {
      setError("Escribe cuántas recolecciones al mes necesitas (entre 1 y 200).");
      return;
    }

    const equipoElegido = Object.entries(equipo)
      .filter(([, n]) => n > 0)
      .map(([clave, cantidad]) => {
        const [tipo, medida] = clave.split("|");
        return { tipo, medida, cantidad };
      });

    setEnviando(true);
    const r = await registrarAlta({
      ...datos,
      serviciosPorMes: porMes,
      // El pin viene como [lat, lng] (así lo entrega el mapa), no como objeto.
      lat: pin?.[0],
      lng: pin?.[1],
      residuos,
      equipo: equipoElegido,
      enCobertura: cubren.length > 0,
      rutasQueCubren: cubren.map((r) => r.clave || r.nombre),
    });
    setEnviando(false);

    if (!r.ok) {
      setError(r.motivo || "No se pudo enviar. Inténtalo de nuevo.");
      return;
    }

    if (cubren.length) {
      setResultado({ tipo: "suscripcion", rutas: cubren, equipo: equipoElegido, folio: r.folio });
    } else {
      setResultado({
        tipo: "zona-pedida",
        id: idZonaPedida(ZONAS_PEDIDAS_SEED),
        equipo: equipoElegido,
        folio: r.folio,
      });
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="pt-alta">
      <header className="pt-alta-cab">
        <div>
          <Image
            src="/img/logo-h-blanco.png"
            alt="Morcast del Norte"
            width={688}
            height={200}
            style={{ height: 52, width: "auto" }}
            priority
          />
          <h1>Cotización/Alta</h1>
          <p>
            Marca dónde recogemos y te decimos en el momento si ya pasamos por tu zona.
          </p>
        </div>
        <Link href="/portal/login" className="pt-btn">
          Ya soy cliente
        </Link>
      </header>

      {resultado ? (
        <div className="pt-card">
          {resultado.tipo === "suscripcion" ? (
            <>
              <div className="pt-exito">
                <FiCheckCircle aria-hidden="true" />
                <div>
                  <strong>Solicitud de alta recibida</strong>
                  <span>
                    Tu domicilio queda dentro de{" "}
                    {resultado.rutas.length === 1 ? "una ruta" : "varias rutas"}. Morcast
                    revisa el alta y te confirma el día de arranque.
                  </span>
                </div>
              </div>
              {resultado.rutas.map((r) => (
                <div
                  key={r.id}
                  style={{
                    borderTop: "1px solid var(--mc-linea)",
                    paddingTop: "0.7rem",
                    marginTop: "0.7rem",
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{r.nombre}</div>
                  <div style={{ fontSize: "0.85rem", color: "var(--mc-gris)", marginTop: 4 }}>
                    {nombreTipoRuta(r.tipo)} · pasa {r.dias.join(", ")}
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div className="pt-exito" style={{ background: "rgba(219,101,45,0.12)", borderColor: "rgba(219,101,45,0.35)" }}>
              <FiAlertCircle aria-hidden="true" />
              <div>
                <strong>Registramos tu zona ({resultado.id})</strong>
                <span>
                  Todavía no hay ruta por ahí. Tu solicitud entra a evaluación para abrir
                  una nueva y te buscamos con la respuesta.
                </span>
              </div>
            </div>
          )}

          <p style={{ marginTop: "1.2rem", fontSize: "0.9rem", color: "var(--mc-gris)" }}>
            Tu folio es <strong style={{ color: "var(--mc-verde-claro)" }}>{resultado.folio}</strong>.
            Te mandamos copia a tu correo y el equipo de Morcast ya la tiene. Ten el
            folio a la mano si nos hablas.
          </p>
          <button
            type="button"
            className="pt-btn"
            onClick={() => {
              setResultado(null);
              setDatos(VACIO);
              setPin(null);
              setResiduos([]);
              setEquipo({});
            }}
          >
            Dar de alta otro domicilio
          </button>
        </div>
      ) : (
        <form onSubmit={enviar}>
          <div className="pt-grid pt-grid-mapa">
            {/* ---------- Columna del mapa ---------- */}
            <div className="pt-card">
              <div className="pt-card-head">
                <h2>¿Dónde recogemos?</h2>
              </div>
              <MapaZonas zonas={zonas} pin={pin} onPin={setPin} alto="440px" />
              <p className="mc-mapa-nota">
                <FiMapPin aria-hidden="true" /> Toca el mapa para colocar tu domicilio.
              </p>

              {pin && cubren.length > 0 && (
                <p
                  style={{
                    color: "var(--mc-verde-claro)",
                    fontWeight: 700,
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    marginTop: "0.6rem",
                  }}
                >
                  <FiCheckCircle aria-hidden="true" /> Sí llegamos:{" "}
                  {cubren.map((r) => r.nombre).join(", ")}
                </p>
              )}
              {pin && cubren.length === 0 && (
                <p
                  style={{
                    color: "#f0895c",
                    fontWeight: 700,
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    marginTop: "0.6rem",
                  }}
                >
                  <FiAlertCircle aria-hidden="true" /> Aún no hay ruta ahí. Puedes seguir:
                  tu alta entra como solicitud de zona nueva.
                </p>
              )}

              <div className="pt-card-head" style={{ marginTop: "1.4rem" }}>
                <h2>Domicilio</h2>
              </div>
              <div className="pt-campo">
                <label htmlFor="alias">Nombre del domicilio</label>
                <input id="alias" className="pt-input" value={datos.alias} onChange={campo("alias")} placeholder="Planta 1, Matriz, Sucursal centro…" required />
              </div>
              <div className="pt-campo">
                <label htmlFor="calle">Calle y número</label>
                <input id="calle" className="pt-input" value={datos.calle} onChange={campo("calle")} required />
              </div>
              <div className="pt-grid pt-grid-2">
                <div className="pt-campo">
                  <label htmlFor="colonia">Colonia</label>
                  <input id="colonia" className="pt-input" value={datos.colonia} onChange={campo("colonia")} required />
                </div>
                <div className="pt-campo">
                  <label htmlFor="cp">Código postal</label>
                  <input id="cp" className="pt-input" inputMode="numeric" maxLength={5} value={datos.cp} onChange={campo("cp")} required />
                </div>
              </div>
              <div className="pt-campo">
                <label htmlFor="referencias">Referencias para el chofer</label>
                <input id="referencias" className="pt-input" value={datos.referencias} onChange={campo("referencias")} placeholder="Portón azul, entrada por el andén…" />
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
                  <input id="empresa" className="pt-input" value={datos.empresa} onChange={campo("empresa")} required />
                </div>
                <div className="pt-campo">
                  <label htmlFor="contacto">Persona de contacto</label>
                  <input id="contacto" className="pt-input" value={datos.contacto} onChange={campo("contacto")} required />
                </div>
                <div className="pt-campo">
                  <label htmlFor="telefono">Teléfono</label>
                  <input id="telefono" className="pt-input" type="tel" value={datos.telefono} onChange={campo("telefono")} placeholder="868 000 0000" required />
                </div>
                <div className="pt-campo">
                  <label htmlFor="correo">Correo</label>
                  <input id="correo" className="pt-input" type="email" value={datos.correo} onChange={campo("correo")} required />
                </div>
              </div>

              <div className="pt-card" style={{ marginTop: "1.1rem" }}>
                <div className="pt-card-head">
                  <h2>Qué generas</h2>
                </div>
                <div className="pt-checks">
                  {TIPOS_SERVICIO.map((t) => (
                    <label key={t}>
                      <input
                        type="checkbox"
                        checked={residuos.includes(t)}
                        onChange={() => alternarResiduo(t)}
                      />
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
                    required
                  />
                  <p style={{ margin: "0.45rem 0 0", fontSize: "0.86rem", color: "var(--mc-gris)" }}>
                    Cuántas veces al mes pasamos en total. Tú decides cómo repartirlas
                    entre las semanas: por ejemplo 2 la primera, 4 la segunda, 3 la
                    tercera y 6 la última.
                  </p>
                </div>
              </div>

              <div className="pt-card" style={{ marginTop: "1.1rem" }}>
                <div className="pt-card-head">
                  <h2>Facturación</h2>
                </div>
                <div className="pt-campo">
                  <label htmlFor="razonSocial">Razón social</label>
                  <input id="razonSocial" className="pt-input" value={datos.razonSocial} onChange={campo("razonSocial")} required />
                </div>
                <div className="pt-campo">
                  <label htmlFor="rfc">RFC</label>
                  <input id="rfc" className="pt-input" value={datos.rfc} onChange={campo("rfc")} style={{ textTransform: "uppercase" }} required />
                </div>
                <div className="pt-campo">
                  <label htmlFor="domicilioFiscal">Domicilio fiscal</label>
                  <input id="domicilioFiscal" className="pt-input" value={datos.domicilioFiscal} onChange={campo("domicilioFiscal")} required />
                </div>
                <div className="pt-campo">
                  <label htmlFor="usoCFDI">Uso de CFDI</label>
                  <select id="usoCFDI" className="pt-input" value={datos.usoCFDI} onChange={campo("usoCFDI")}>
                    {USOS_CFDI.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
                <div className="pt-campo">
                  <label htmlFor="formaPago">Forma de pago preferida</label>
                  <select id="formaPago" className="pt-input" value={datos.formaPago} onChange={campo("formaPago")}>
                    {FORMAS_PAGO.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
                {/* No se piden banco, cuenta ni CLABE del cliente: Morcast cobra a su
                    propia cuenta y guardarlos solo agrega riesgo. */}
                <p className="mc-mapa-nota">
                  No te pedimos banco, cuenta ni CLABE. El cobro se hace contra tu factura.
                </p>
              </div>

              {error && <div className="pt-login-error" style={{ marginTop: "1.1rem" }}>{error}</div>}

              {/* Se bloquea mientras se manda: sin esto un doble clic da de alta
                  dos veces al mismo cliente, y a Morcast le llegan dos correos. */}
              <button
                type="submit"
                className="pt-btn pt-btn-verde"
                disabled={enviando}
                style={{ width: "100%", justifyContent: "center", padding: "0.85rem", marginTop: "1.1rem", opacity: enviando ? 0.7 : 1 }}
              >
                {enviando ? "Enviando…" : <>Enviar solicitud de alta <FiArrowRight aria-hidden="true" /></>}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
