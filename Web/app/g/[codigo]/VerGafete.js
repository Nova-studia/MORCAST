"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  CheckCircle,
  XCircle,
  WarningCircle,
  Lock,
  Phone,
  EyeSlash,
  ArrowLeft,
  ArrowClockwise,
} from "@phosphor-icons/react/dist/ssr";
import { LARGO_PIN } from "@/lib/pin-gafete.mjs";
import { telefonoLegible } from "@/lib/personal.mjs";
import { abrirEmergencia } from "./acciones";
import s from "./gafete.module.css";

/**
 * La pantalla del gafete en el teléfono de quien lo escanea. Tres vistas:
 * la verificación (lo primero y casi siempre lo único), el PIN, y la ficha
 * de emergencia. Lo que manda es el sello de arriba, de lado a lado.
 */

const ZONA = "America/Matamoros";
const MESES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

/** "12 OCT 2026 · 13:42:07", con la hora de Matamoros. */
function fechaYHora(ms) {
  const partes = new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONA, day: "2-digit", month: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(new Date(ms));
  const de = (tipo) => partes.find((p) => p.type === tipo)?.value || "";
  return {
    fecha: `${de("day")} ${MESES[Number(de("month")) - 1]} ${de("year")}`,
    hora: `${de("hour")}:${de("minute")}:${de("second")}`,
  };
}

const SANGRE_EN_LETRAS = (tipo) => (tipo ? `${tipo.slice(0, -1)} ${tipo.endsWith("+") ? "positivo" : "negativo"}` : "");

/**
 * El reloj que corre: la prueba contra una captura de pantalla. Parte de la
 * hora del SERVIDOR (la del teléfono puede estar mal puesta) y avanza con el
 * tiempo que lleva abierta la página.
 */
function useReloj(ahoraServidor) {
  const [ms, setMs] = useState(ahoraServidor);
  useEffect(() => {
    const inicio = performance.now();
    const tic = () => setMs(ahoraServidor + (performance.now() - inicio));
    tic();
    const reloj = setInterval(tic, 1000);
    return () => clearInterval(reloj);
  }, [ahoraServidor]);
  return fechaYHora(ms);
}

function Silueta() {
  return (
    <svg viewBox="0 0 100 125" aria-hidden="true">
      <rect width="100" height="125" fill="#DCE0DF" />
      <circle cx="50" cy="49" r="20.5" fill="#B8BFBE" />
      <path d="M11 125c0-25 17.5-40.5 39-40.5S89 100 89 125z" fill="#B8BFBE" />
    </svg>
  );
}

function Foto({ codigo, hayFoto, nombre, chica }) {
  const [fallo, setFallo] = useState(false);
  return (
    <div className={`${s.foto} ${chica ? s.fotoChica : ""}`}>
      {hayFoto && !fallo ? (
        // <img> y no next/image: la sirve una ruta privada, sin caché ni optimizador.
        <img src={`/g/${codigo}/foto`} alt={`Foto de ${nombre}`} onError={() => setFallo(true)} />
      ) : (
        <Silueta />
      )}
    </div>
  );
}

function Sello({ clase, Icono, titulo, sub, chico }) {
  return (
    <div className={`${s.sello} ${s[clase]} ${chico ? s.selloChico : ""}`} role="status">
      <Icono weight="bold" aria-hidden="true" />
      <div>
        <strong>{titulo}</strong>
        <span>{sub}</span>
      </div>
    </div>
  );
}

function Reloj({ reloj, rojo, nota }) {
  return (
    <div className={`${s.reloj} ${rojo ? s.relojRojo : ""}`}>
      {/* suppressHydrationWarning: entre que el servidor arma la página y el
          teléfono la pinta ya pasó un segundo. */}
      <span className={s.hora} suppressHydrationWarning><i aria-hidden="true" />{reloj.fecha} · {reloj.hora}</span>
      {nota && <p>{nota}</p>}
    </div>
  );
}

const telDe = (numero) => `tel:+52${String(numero).replace(/\D/g, "")}`;

function LlamarMorcast({ telefono, secundario }) {
  return (
    <a className={secundario ? s.btn2 : s.btn} href={telDe(telefono)}>
      <Phone weight="bold" aria-hidden="true" /> Llamar a Morcast
    </a>
  );
}

function Logo() {
  return <Image className={s.logo} src="/img/logo-h-blanco.png" alt="Morcast del Norte" width={688} height={200} />;
}

export default function VerGafete({ codigo, ficha, ahora, telefono }) {
  const reloj = useReloj(ahora);
  const [vista, setVista] = useState("verificacion"); // verificacion | pin | emergencia
  const [emergencia, setEmergencia] = useState(null);

  if (ficha.estado === "sin-respuesta") {
    return (
      <main className={s.raiz}>
        <Sello clase="duda" Icono={WarningCircle} titulo="Sin respuesta" sub="No se pudo consultar este gafete" />
        <div className={s.pagina}>
          <p className={s.grande}>Inténtalo<br />de nuevo</p>
          <p className={s.texto}>
            No pudimos consultar el gafete en este momento. Esto no dice si es válido o no:
            vuelve a intentarlo o llama a Morcast para confirmarlo.
          </p>
          <div className={s.abajo}>
            <button type="button" className={s.btn2} onClick={() => window.location.reload()}>
              <ArrowClockwise weight="bold" aria-hidden="true" /> Volver a intentar
            </button>
            <LlamarMorcast telefono={telefono} />
            <Logo />
          </div>
        </div>
      </main>
    );
  }

  if (ficha.estado !== "vigente") {
    return (
      <main className={s.raiz}>
        <Sello clase="mal" Icono={XCircle} titulo="No válido" sub="Este gafete no está vigente" />
        <div className={s.pagina}>
          <div className={s.hueco}><EyeSlash aria-hidden="true" /></div>
          <p className={s.grande}>No permitas<br />el acceso</p>
          <p className={s.texto}>
            La persona ya no trabaja en Morcast, este gafete se repuso por otro, o el código no existe.
            Sus datos no se muestran.
          </p>
          <Reloj reloj={reloj} rojo />
          <div className={s.abajo}>
            <LlamarMorcast telefono={telefono} />
            <Logo />
          </div>
        </div>
      </main>
    );
  }

  if (vista === "emergencia" && emergencia) {
    return (
      <main className={s.raiz}>
        <Sello clase="ok" Icono={CheckCircle} titulo="Vigente" sub="Empleado activo de Morcast del Norte" chico />
        <div className={s.pagina}>
          <div className={s.cabecera}>
            <Foto codigo={codigo} hayFoto={ficha.hayFoto} nombre={ficha.nombre} chica />
            <div>
              <div className={s.cabNombre}>{ficha.nombre}</div>
              <div className={s.cabPuesto}>{[ficha.puesto, ficha.numero].filter(Boolean).join(" · ")}</div>
            </div>
          </div>
          <h1 className={s.rotulo}>En caso de emergencia</h1>
          <div className={s.sangre}>
            <div>
              <span className={s.etiqueta}>Tipo de sangre</span>
              <span className={s.sangreSub}>{emergencia.ficha.tipo_sangre ? SANGRE_EN_LETRAS(emergencia.ficha.tipo_sangre) : "No registrado"}</span>
            </div>
            <span className={s.sangreValor}>{emergencia.ficha.tipo_sangre || "—"}</span>
          </div>
          <dl className={s.ficha}>
            <div><dt className={s.etiqueta}>Alergias</dt><dd>{emergencia.ficha.alergias || "Ninguna registrada"}</dd></div>
            {emergencia.ficha.contacto && <div><dt className={s.etiqueta}>Avisar a</dt><dd>{emergencia.ficha.contacto}</dd></div>}
            <div><dt className={s.etiqueta}>Teléfono</dt><dd className={s.mono}>{telefonoLegible(emergencia.ficha.telefono)}</dd></div>
          </dl>
          <div className={s.abajo}>
            <a className={s.btn} href={telDe(emergencia.ficha.telefono)}>
              <Phone weight="bold" aria-hidden="true" /> Llamar al contacto
            </a>
            <LlamarMorcast telefono={telefono} secundario />
            <p className={s.registro}>Consulta registrada · {emergencia.hora}</p>
          </div>
        </div>
      </main>
    );
  }

  if (vista === "pin") {
    return (
      <main className={s.raiz}>
        <Sello clase="ok" Icono={CheckCircle} titulo="Vigente" sub={ficha.nombre} chico />
        <div className={s.pagina}>
          <PedirPin
            codigo={codigo}
            telefono={telefono}
            alVolver={() => setVista("verificacion")}
            alAbrir={(datos) => { setEmergencia({ ficha: datos, hora: reloj.hora }); setVista("emergencia"); }}
          />
        </div>
      </main>
    );
  }

  return (
    <main className={s.raiz}>
      <Sello clase="ok" Icono={CheckCircle} titulo="Vigente" sub="Empleado activo de Morcast del Norte" />
      <div className={s.pagina}>
        <Foto codigo={codigo} hayFoto={ficha.hayFoto} nombre={ficha.nombre} />
        <h1 className={s.nombre}>{ficha.nombre}</h1>
        <p className={s.puesto}>{ficha.puesto}</p>
        <div className={s.datos}>
          <div><span className={s.etiqueta}>No. empleado</span><span className={`${s.valor} ${s.mono}`}>{ficha.numero}</span></div>
          <div><span className={s.etiqueta}>Área</span><span className={s.valor}>{ficha.area || "—"}</span></div>
        </div>
        <Reloj reloj={reloj} nota="Si la hora no avanza, no es válida." />
        <div className={s.abajo}>
          {ficha.hayEmergencia && (
            <button type="button" className={s.btn2} onClick={() => setVista("pin")}>
              <Lock weight="bold" aria-hidden="true" /> Datos de emergencia
            </button>
          )}
          <LlamarMorcast telefono={telefono} />
          <Logo />
        </div>
      </div>
    </main>
  );
}

/**
 * Las seis casillas del PIN. Debajo hay UN solo campo de verdad (invisible,
 * encima de las casillas): así el teclado numérico del teléfono, pegar y
 * borrar funcionan como en cualquier campo, sin brincar el foco de casilla
 * en casilla.
 */
function PedirPin({ codigo, telefono, alVolver, alAbrir }) {
  const [pin, setPin] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState(null);
  const campo = useRef(null);

  const enviar = async (valor) => {
    setOcupado(true);
    setAviso(null);
    let r;
    try {
      r = await abrirEmergencia(codigo, valor);
    } catch {
      r = { ok: false, motivo: "No se pudo consultar. Revisa tu conexión e inténtalo de nuevo." };
    }
    setOcupado(false);
    if (r.ok) { alAbrir(r.ficha); return; }
    setAviso(r);
    setPin("");
    campo.current?.focus();
  };

  const cambia = (e) => {
    const valor = e.target.value.replace(/\D/g, "").slice(0, LARGO_PIN);
    setPin(valor);
    if (aviso && !aviso.espera) setAviso(null);
    if (valor.length === LARGO_PIN && !ocupado) enviar(valor);
  };

  return (
    <>
      <div className={s.candado}><Lock aria-hidden="true" /></div>
      <h1 className={s.titulo}>Datos de emergencia</h1>
      <p className={s.texto}>Ingresa el PIN de 6 dígitos que viene impreso atrás del gafete.</p>

      <div className={s.cajas}>
        {Array.from({ length: LARGO_PIN }, (_, i) => (
          <span key={i} className={i === pin.length && !ocupado ? s.activa : ""} aria-hidden="true">{pin[i] || ""}</span>
        ))}
        <input
          ref={campo}
          className={s.campoPin}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          autoFocus
          maxLength={LARGO_PIN + 1}
          value={pin}
          onChange={cambia}
          // Mientras revisa va de solo lectura, no apagado: un campo apagado
          // pierde el foco y habría que volver a tocarlo tras un PIN errado.
          readOnly={ocupado}
          disabled={Boolean(aviso?.espera)}
          aria-label="PIN de emergencia, 6 dígitos"
        />
      </div>

      <p className={`${s.nota} ${aviso ? s.notaMal : ""}`} role={aviso ? "alert" : undefined}>
        {ocupado ? "Revisando…" : aviso ? aviso.motivo : "Cada consulta queda registrada."}
      </p>

      <div className={s.abajo}>
        <button type="button" className={s.btn2} onClick={alVolver} disabled={ocupado}>
          <ArrowLeft weight="bold" aria-hidden="true" /> Volver
        </button>
        <LlamarMorcast telefono={telefono} />
      </div>
    </>
  );
}
