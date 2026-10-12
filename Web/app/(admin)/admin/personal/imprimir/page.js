"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Check, Printer, Warning } from "@phosphor-icons/react/dist/ssr";
import {
  TARJETA,
  RANURA,
  LADO_QR,
  medidasDePagina,
  marcasDeCorte,
  fondoDeCara,
  guilloche,
  qrDeGafete,
  paginasDeImpresion,
} from "@/lib/gafete-impresion.mjs";
import { nombreCompleto, nombreEnDosLineas, emisionLegible } from "@/lib/personal.mjs";
import { EMPRESA } from "@/lib/datos";
import { fotoDelPanel } from "@/lib/foto-gafete";
import { datosDeImpresion, marcarMandados } from "../acciones";
import { Silueta, LLAVE_IMPRESION } from "../piezas";
import s from "./imprimir.module.css";

/**
 * LA HOJA PARA LA IMPRENTA.
 *
 * Una cara por página (70 × 101.6 mm): la tarjeta CR80 con 2 mm de sangría y
 * marcas de corte. Se saca con «Imprimir → Guardar como PDF» del navegador,
 * igual que las etiquetas de contenedores: así el PDF lleva las tipografías
 * del sitio y el dibujo en vectores. Las medidas viven en
 * lib/gafete-impresion.mjs.
 *
 * La otra vista, la «hoja de control», es para Morcast (tamaño carta): la
 * lista de lo que se mandó a imprimir, con una casilla para ir palomeando
 * los chips grabados. No lleva los PIN.
 *
 * Qué empleados salen: los que se marcaron en la lista (`sessionStorage`) o
 * los de `?ids=` en la dirección.
 */

const PAGINA = medidasDePagina();
const MARCAS = marcasDeCorte();
const FONDO = { frente: fondoDeCara("frente"), vuelta: fondoDeCara("vuelta") };
const ONDAS = guilloche();
/** Debajo de esto la letra ya se achicó tanto que conviene mirarla antes de imprimir. */
const ESCALA_DE_AVISO = 0.75;

function idsPedidos(parametros) {
  const deLaDireccion = (parametros.get("ids") || "").split(",").map((x) => x.trim()).filter(Boolean);
  if (deLaDireccion.length) return deLaDireccion;
  try {
    const guardados = JSON.parse(sessionStorage.getItem(LLAVE_IMPRESION) || "[]");
    return Array.isArray(guardados) ? guardados.map(String) : [];
  } catch {
    return [];
  }
}

// `useSearchParams` pide un <Suspense> alrededor para que la página compile.
export default function ImprimirGafetes() {
  return (
    <Suspense fallback={<div className="pt-card pt-vacio">Preparando la hoja…</div>}>
      <Hoja />
    </Suspense>
  );
}

function Hoja() {
  const parametros = useSearchParams();
  const [carga, setCarga] = useState(null);
  const [vista, setVista] = useState("gafetes"); // gafetes | control
  const [orden, setOrden] = useState("tarjeta");
  const [fotos, setFotos] = useState({}); // id del empleado → true (cargó) | false (falló)
  const [ajustes, setAjustes] = useState({}); // "Nombre: qué" → escala de la letra
  const [mandados, setMandados] = useState(null);

  useEffect(() => {
    let vivo = true;
    const ids = idsPedidos(parametros);
    if (!ids.length) { setCarga({ ok: true, gafetes: [], sinGafete: [] }); return undefined; }
    datosDeImpresion(ids)
      .catch(() => ({ ok: false, motivo: "No se pudo preparar la hoja. Revisa tu conexión." }))
      .then((r) => { if (vivo) setCarga(r); });
    return () => { vivo = false; };
  }, [parametros]);

  const gafetes = useMemo(() => (carga?.ok ? carga.gafetes : []), [carga]);
  const paginas = useMemo(() => paginasDeImpresion(gafetes, orden), [gafetes, orden]);

  // Estables (useCallback): las llaman efectos de cada tarjeta.
  const alFoto = useCallback((id, bien) => setFotos((f) => (f[id] === bien ? f : { ...f, [id]: bien })), []);
  const alAjustar = useCallback((clave, escala) => setAjustes((a) => (a[clave] === escala ? a : { ...a, [clave]: escala })), []);

  const conFoto = gafetes.filter((g) => g.foto_ruta);
  const sinFoto = gafetes.filter((g) => !g.foto_ruta || fotos[g.empleadoId] === false);
  // Imprimir antes de que carguen las fotos las dejaría en blanco en el PDF.
  const fotosPendientes = vista === "gafetes" ? conFoto.filter((g) => !(g.empleadoId in fotos)).length : 0;
  const apretados = Object.entries(ajustes).filter(([, escala]) => escala < ESCALA_DE_AVISO).map(([clave]) => clave);
  const porMandar = gafetes.filter((g) => !g.impreso_en).map((g) => g.gafeteId);

  const marcar = async () => {
    setMandados({ ocupado: true });
    const r = await marcarMandados(gafetes.map((g) => g.gafeteId))
      .catch(() => ({ ok: false, motivo: "No se pudo anotar. Revisa tu conexión." }));
    setMandados(r.ok ? { hechos: true } : { motivo: r.motivo });
  };

  // El tamaño del papel depende de la vista. Va en un <style> de esta página
  // (y no en el módulo de estilos) para que deje de valer al salir de aquí.
  const papel = vista === "gafetes"
    ? `@page { size: ${PAGINA.ancho}mm ${PAGINA.alto}mm; margin: 0; }`
    : "@page { size: letter; margin: 14mm 12mm; }";

  return (
    <div className={s.raiz}>
      <style>{papel}</style>

      <div className={s.barra}>
        <div className="pt-page-head" style={{ margin: 0 }}>
          <h1>Hoja para la imprenta</h1>
          <p>
            {carga?.ok
              ? `${gafetes.length} ${gafetes.length === 1 ? "gafete" : "gafetes"} · ${paginas.length} páginas de ${PAGINA.ancho} × ${PAGINA.alto} mm`
              : "Los gafetes, listos para mandar a imprimir."}
          </p>
        </div>
        <div className={s.controles}>
          <Link href="/admin/personal" className="pt-btn" prefetch={false}><ArrowLeft /> Personal</Link>
          <label className={s.selector}>
            Qué imprimir
            <select className="pt-input" value={vista} onChange={(e) => setVista(e.target.value)}>
              <option value="gafetes">Gafetes (para la imprenta)</option>
              <option value="control">Hoja de control (para Morcast)</option>
            </select>
          </label>
          {vista === "gafetes" && (
            <label className={s.selector}>
              Orden de las páginas
              <select className="pt-input" value={orden} onChange={(e) => setOrden(e.target.value)}>
                <option value="tarjeta">Frente y vuelta de cada tarjeta</option>
                <option value="caras">Todos los frentes, luego las vueltas</option>
              </select>
            </label>
          )}
          <button type="button" className="pt-btn pt-btn-naranja" onClick={() => window.print()} disabled={!gafetes.length || fotosPendientes > 0}>
            <Printer /> {fotosPendientes > 0 ? `Cargando ${fotosPendientes} ${fotosPendientes === 1 ? "foto" : "fotos"}…` : "Imprimir o guardar PDF"}
          </button>
          {gafetes.length > 0 && (
            mandados?.hechos || porMandar.length === 0 ? (
              <span className={s.hecho}><Check aria-hidden="true" /> Anotados como mandados a la imprenta</span>
            ) : (
              <button type="button" className="pt-btn" onClick={marcar} disabled={mandados?.ocupado}>
                {mandados?.ocupado ? "Anotando…" : "Ya los mandé a la imprenta"}
              </button>
            )
          )}
        </div>
        <p className={s.nota}>
          En la ventana de impresión escoge <strong>Guardar como PDF</strong>, márgenes <strong>Ninguno</strong>, escala{" "}
          <strong>100 %</strong> y activa <strong>Gráficos de fondo</strong>. Cada página trae 2 mm de sangría y marcas
          de corte; la tarjeta mide {TARJETA.ancho} × {TARJETA.alto} mm (CR80). La ranura del cordón no va impresa: la
          troquela la imprenta arriba, al centro. Cuando mandes el PDF, pulsa «Ya los mandé a la imprenta» para que
          dejen de salir como «Sin imprimir».
        </p>
        {(sinFoto.length > 0 || apretados.length > 0 || carga?.sinGafete?.length > 0 || mandados?.motivo) && (
          <div className={s.avisos} role="alert">
            <Warning aria-hidden="true" />
            <div>
              {sinFoto.length > 0 && (
                <p><strong>{sinFoto.length} sin foto</strong> (saldrían con la silueta): {sinFoto.map(nombreCompleto).join(", ")}.</p>
              )}
              {apretados.length > 0 && (
                <p>
                  <strong>Texto muy largo</strong>: se achicó la letra para que quepa. Míralo antes de imprimir y, si no
                  convence, acórtalo en su ficha: {apretados.join(", ")}.
                </p>
              )}
              {carga?.sinGafete?.length > 0 && (
                <p><strong>No salen</strong> porque no tienen gafete vigente: {carga.sinGafete.join(", ")}.</p>
              )}
              {mandados?.motivo && <p>{mandados.motivo}</p>}
            </div>
          </div>
        )}
      </div>

      {!carga ? (
        <div className="pt-card pt-vacio">Preparando la hoja…</div>
      ) : !carga.ok ? (
        <div className="pt-card pt-vacio" role="alert">{carga.motivo}</div>
      ) : gafetes.length === 0 ? (
        <div className="pt-card pt-vacio">
          No hay gafetes que imprimir. Vuelve a Personal, marca a quien quieras y pulsa{" "}
          <strong>Hoja para la imprenta</strong>.
        </div>
      ) : vista === "gafetes" ? (
        <div className={s.paginas}>
          {paginas.map(({ cara, gafete }) => (
            <Pagina key={`${gafete.codigo}-${cara}`} cara={cara} gafete={gafete}
              fotoMal={fotos[gafete.empleadoId] === false} alFoto={alFoto} alAjustar={alAjustar} />
          ))}
        </div>
      ) : (
        <HojaDeControl gafetes={gafetes} />
      )}
    </div>
  );
}

/**
 * Un renglón que NO puede partirse ni cortarse (el nombre, los apellidos, el
 * puesto): si no cabe a lo ancho, se le achica la letra hasta que quepa. Se
 * mide ya con las tipografías cargadas; como todo va en `--mm`, la proporción
 * que sale en pantalla es la misma del PDF. `--f` multiplica el tamaño en
 * imprimir.module.css.
 */
function Ajustar({ className, alMedir, children }) {
  const caja = useRef(null);
  const [escala, setEscala] = useState(1);

  useEffect(() => {
    let vivo = true;
    const medir = () => {
      const el = caja.current;
      if (!vivo || !el) return;
      el.style.setProperty("--f", "1");
      const cabe = el.clientWidth;
      const pide = el.scrollWidth;
      // Hacia abajo y con tope: una letra de menos de la mitad ya no se lee.
      const nueva = pide > cabe && cabe > 0 ? Math.max(0.5, Math.floor((cabe / pide) * 100) / 100) : 1;
      el.style.setProperty("--f", String(nueva));
      setEscala(nueva);
    };
    (document.fonts?.ready || Promise.resolve()).then(medir);
    return () => { vivo = false; };
  }, [children]);

  useEffect(() => { alMedir?.(escala); }, [escala, alMedir]);

  return <span ref={caja} className={className} style={{ "--f": escala }}>{children}</span>;
}

/** Una página: las marcas de corte y, dentro, una cara con su sangría. */
function Pagina({ cara, gafete, fotoMal, alFoto, alAjustar }) {
  return (
    <section className={s.pagina} aria-label={`${cara === "frente" ? "Frente" : "Vuelta"} del gafete de ${nombreCompleto(gafete)}`}>
      <svg className={s.marcas} viewBox={`0 0 ${PAGINA.ancho} ${PAGINA.alto}`} aria-hidden="true">
        {MARCAS.map((m, i) => <line key={i} x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} />)}
      </svg>
      <div className={s.cara}>
        <svg className={s.fondo} viewBox={FONDO[cara].caja} preserveAspectRatio="none" aria-hidden="true">
          <rect x="-2" y="-2" width="58" height="89.6" fill="#fff" />
          {cara === "frente" && <path d={ONDAS} fill="none" stroke="#044D57" strokeOpacity="0.1" strokeWidth="0.12" />}
          {FONDO[cara].franjas.map((f) => <polygon key={f.puntos} points={f.puntos} fill={f.color} />)}
        </svg>
        {/* Guías que solo se ven en pantalla: por dónde corta y dónde va la ranura. */}
        <div className={s.corte} aria-hidden="true" />
        <div className={s.ranura} aria-hidden="true"
          style={{ "--r-ancho": RANURA.ancho, "--r-alto": RANURA.alto, "--r-arriba": RANURA.arriba }} />
        {cara === "frente"
          ? <Frente gafete={gafete} fotoMal={fotoMal} alFoto={alFoto} alAjustar={alAjustar} />
          : <Vuelta gafete={gafete} />}
      </div>
    </section>
  );
}

function Frente({ gafete, fotoMal, alFoto, alAjustar }) {
  const [nombres, apellidos] = nombreEnDosLineas(gafete);
  const foto = fotoDelPanel({ id: gafete.empleadoId, foto_ruta: gafete.foto_ruta });
  const quien = nombreCompleto(gafete);
  const mideNombre = useCallback((escala) => alAjustar(`${quien} (nombre)`, escala), [alAjustar, quien]);
  const mideApellidos = useCallback((escala) => alAjustar(`${quien} (apellidos)`, escala), [alAjustar, quien]);
  const midePuesto = useCallback((escala) => alAjustar(`${quien} (puesto)`, escala), [alAjustar, quien]);
  return (
    <>
      {/* <img> y no next/image: en un PDF para imprenta va el archivo tal cual, sin recomprimir. */}
      <img className={s.logo} src="/img/logo-h-blanco.png" alt="Morcast del Norte" />
      <div className={s.foto}>
        <div>
          {foto && !fotoMal
            ? <img src={foto} alt="" onLoad={() => alFoto(gafete.empleadoId, true)} onError={() => alFoto(gafete.empleadoId, false)} />
            : <Silueta />}
        </div>
      </div>
      <div className={s.nombre}>
        <Ajustar className={s.nombres} alMedir={mideNombre}>{nombres}</Ajustar>
        <Ajustar className={s.apellidos} alMedir={mideApellidos}>{apellidos}</Ajustar>
      </div>
      {gafete.puesto && (
        <div className={s.puesto}><Ajustar alMedir={midePuesto}>{gafete.puesto}</Ajustar></div>
      )}
      <div className={s.numero}>
        <span>No. empleado</span>
        <strong>{gafete.numero}</strong>
      </div>
    </>
  );
}

function Vuelta({ gafete }) {
  const qr = qrDeGafete(gafete.codigo);
  return (
    <>
      <div className={s.rotulo}>Verifica este gafete</div>
      <svg className={s.qr} viewBox={`0 0 ${qr.tam} ${qr.tam}`} shapeRendering="crispEdges" role="img"
        aria-label={`Código QR de ${qr.enlace}`} style={{ "--lado": LADO_QR }}>
        <rect width={qr.tam} height={qr.tam} fill="#fff" />
        <path d={qr.d} fill="#000" />
      </svg>
      <div className={s.enlace}>{qr.enlace.replace("https://", "")}</div>
      <div className={s.nfc}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3.5" y="3.5" width="9" height="17" rx="2" />
            <path d="M7 17.5h2" />
            <path d="M15.6 9.2a4 4 0 0 1 0 5.6" />
            <path d="M18.4 6.6a7.8 7.8 0 0 1 0 10.8" />
          </g>
        </svg>
        o acerca tu teléfono aquí
      </div>
      <div className={s.pin}>
        <div>
          <strong>PIN de emergencia</strong>
          <p>Escanea el código e ingresa este PIN para ver los datos de emergencia.</p>
        </div>
        <div className={s.pinNumero}>
          <b>{gafete.pin.slice(0, 3)}</b>
          <b>{gafete.pin.slice(3)}</b>
        </div>
      </div>
      <div className={s.legal}>
        Personal e intransferible. Si lo encuentras, llama a <b>Morcast del Norte</b> al{" "}
        <b className={s.sinPartir}>{EMPRESA.telefonos[0]}</b>.
      </div>
      <div className={`${s.pie} ${s.pieIzq}`}>Emisión {emisionLegible(gafete.emitido)}</div>
      <div className={`${s.pie} ${s.pieDer}`}>morcast.mx</div>
    </>
  );
}

/** La lista de lo que se mandó a imprimir, para ir palomeando los chips. Sin PIN. */
function HojaDeControl({ gafetes }) {
  const hoy = new Intl.DateTimeFormat("es-MX", { timeZone: "America/Matamoros", dateStyle: "long" }).format(new Date());
  return (
    <section className={s.control}>
      <header>
        <h2>Gafetes mandados a imprimir</h2>
        <p>Morcast del Norte · {hoy} · {gafetes.length} {gafetes.length === 1 ? "gafete" : "gafetes"}</p>
      </header>
      <table>
        <thead>
          <tr><th>#</th><th>No.</th><th>Nombre</th><th>Puesto</th><th>Enlace del gafete</th><th>Tarjeta recibida</th><th>Chip grabado</th></tr>
        </thead>
        <tbody>
          {gafetes.map((g, i) => (
            <tr key={g.codigo}>
              <td>{i + 1}</td>
              <td className={s.cMono}>{g.numero}</td>
              <td>{nombreCompleto(g)}</td>
              <td>{g.puesto}</td>
              <td className={s.cMono}>morcast.mx/g/{g.codigo}</td>
              <td><i /></td>
              <td>{g.chip_grabado_en ? "Sí" : <i />}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <footer>
        El chip de cada tarjeta se graba en el panel: Personal → Grabar chips. Esta hoja no lleva los PIN: van impresos
        atrás de cada tarjeta.
      </footer>
    </section>
  );
}
