"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Camera,
  Check,
  CheckCircle,
  CircleNotch,
  ContactlessPayment,
  Copy,
  LockOpen,
  Warning,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import { LARGO_CODIGO, codigoDeEnlace, enlaceGafete } from "@/lib/gafetes.mjs";
import { crearGrabador, soporteNfc } from "@/lib/chip-nfc.mjs";
import s from "./chips.module.css";

/**
 * La pantalla de grabar chips. Dos pasos por tarjeta:
 *
 * 1. Decir cuál tarjeta es. Se teclea el código impreso bajo el QR o se le
 *    toma una foto al QR. La foto usa `<input capture>` (la cámara del
 *    sistema) porque la web tiene prohibida la cámara en vivo
 *    (Permissions-Policy en next.config.mjs).
 * 2. Acercar la tarjeta. El chip recibe el mismo enlace del QR y se sella.
 *
 * El chip sale de la tarjeta que la persona tiene en la mano y el código
 * sale de esa misma tarjeta: así no se le graba a Juan el enlace de Pedro.
 *
 * `alGrabar({ codigo, sellado, serie })` avisa cada chip terminado para que
 * quede anotado en la ficha del empleado (la acción `chipGrabado`), y
 * contesta `{ ok }` o `{ ok: false, motivo }`. Una prueba sin sellar no se
 * anota: ese chip todavía no está terminado.
 */
export default function GrabarChip({ codigoInicial = "", alGrabar }) {
  const [texto, setTexto] = useState(codigoInicial);
  const [sellar, setSellar] = useState(true);
  const [estado, setEstado] = useState(null);
  const [hechas, setHechas] = useState([]);
  const [avisoFoto, setAvisoFoto] = useState("");
  const [copiado, setCopiado] = useState(false);
  // Lo que puede este navegador se sabe hasta que la página ya está en él.
  const [nav, setNav] = useState(null);
  const grabador = useRef(null);
  const campo = useRef(null);
  const foto = useRef(null);
  const recuadro = useRef(null);

  const codigo = codigoDeEnlace(texto);
  const enlace = codigo ? enlaceGafete(codigo) : null;
  const paso = estado?.paso || null;
  const activo = paso !== null && paso !== "error";

  useEffect(() => {
    setNav({ nfc: soporteNfc(window), leeQr: "BarcodeDetector" in window });
    return () => grabador.current?.detener();
  }, []);

  // En el teléfono el recuadro del estado queda abajo de la pantalla: cada
  // vez que cambia se trae a la vista, que es lo único que hay que leer.
  useEffect(() => {
    if (paso) recuadro.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [paso]);

  const soltar = () => {
    grabador.current?.detener();
    grabador.current = null;
    setEstado(null);
  };

  // Si cambia el código a medio camino se apaga el lector: que nunca quede
  // esperando una tarjeta con el enlace de la anterior.
  const cambiaTexto = (valor) => {
    soltar();
    setAvisoFoto("");
    setCopiado(false);
    setTexto(valor);
  };

  const termina = async (hecho) => {
    const suCodigo = codigo;
    setHechas((lista) => [{ codigo: suCodigo, sellado: hecho.sellado, nota: "" }, ...lista.filter((h) => h.codigo !== suCodigo)]);
    // Con la casilla de sellar apagada es una prueba: no se anota.
    if (!alGrabar || !sellar) return;
    let r;
    try {
      r = await alGrabar({ codigo: suCodigo, sellado: hecho.sellado, serie: hecho.serie || "" });
    } catch {
      r = { ok: false, motivo: "No se pudo anotar en el panel: revisa tu conexión." };
    }
    const nota = r?.ok ? "Anotado en su ficha" : r?.motivo || "No se anotó en el panel.";
    setHechas((lista) => lista.map((h) => (h.codigo === suCodigo ? { ...h, nota, sinAnotar: !r?.ok } : h)));
  };

  const grabar = async () => {
    if (!enlace) return;
    grabador.current?.detener();
    const g = crearGrabador({
      Lector: window.NDEFReader,
      enlace,
      sellar,
      alEstado: (e) => {
        setEstado(e);
        if (e.paso === "hecho") termina(e);
      },
    });
    grabador.current = g;
    await g.iniciar();
  };

  // El enlace quedó grabado y el chip no se dejó sellar: se da por bueno así.
  const dejarSinSellar = () => {
    const hecho = { paso: "hecho", sellado: false, yaEstaba: true, serie: "" };
    setEstado(hecho);
    termina(hecho);
  };

  const siguiente = () => {
    soltar();
    setTexto("");
    setAvisoFoto("");
    setCopiado(false);
    campo.current?.focus();
  };

  const leerFoto = async (archivo) => {
    if (!archivo) return;
    setAvisoFoto("");
    try {
      const imagen = await createImageBitmap(archivo);
      const hallados = await new window.BarcodeDetector({ formats: ["qr_code"] }).detect(imagen);
      imagen.close?.();
      const leido = hallados.map((h) => codigoDeEnlace(h.rawValue)).find(Boolean);
      if (leido) cambiaTexto(leido);
      else {
        setAvisoFoto(
          hallados.length
            ? "Ese QR no es de un gafete de Morcast."
            : "No se vio ningún QR en la foto. Tómala de cerca y sin reflejos, o teclea el código."
        );
      }
    } catch {
      setAvisoFoto("No se pudo leer la foto. Teclea el código que viene bajo el QR.");
    }
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(enlace);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  };

  const puedeGrabar = Boolean(nav?.nfc.ok);

  return (
    <div className={s.raiz}>
      <div className="pt-page-head" style={{ margin: 0 }}>
        <h1>Grabar chips</h1>
        <p>Graba en el chip de cada gafete el mismo enlace de su código QR, y lo sella.</p>
      </div>

      {nav && !puedeGrabar && (
        <div className={`${s.estado} ${s.alerta}`} style={{ marginTop: 0 }} role="status">
          <Warning />
          <strong>
            {nav.nfc.motivo === "sin-https" ? "Esta página solo graba chips con https" : "Este navegador no puede grabar chips"}
          </strong>
          <p>
            Abre esta misma página en un teléfono <b>Android con NFC</b>, usando <b>Chrome</b>. En iPhone y en
            computadora no se puede.
          </p>
          <p>
            Otra forma: copia el enlace de abajo y grábalo con la app <b>NFC Tools</b> como «URL»; luego usa
            «Bloquear etiqueta».
          </p>
        </div>
      )}

      <section className="pt-card">
        <div className={s.paso}>Paso 1</div>
        <h2 className={s.titulo}>¿Cuál tarjeta es?</h2>
        <div className={s.fila}>
          <input
            ref={campo}
            className={`pt-input ${s.codigo}`}
            value={texto}
            onChange={(e) => cambiaTexto(e.target.value)}
            placeholder="Código del gafete"
            aria-label="Código del gafete"
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {nav?.leeQr && (
            <button type="button" className="pt-btn" onClick={() => foto.current?.click()}>
              <Camera /> Foto del QR
            </button>
          )}
          <input
            ref={foto}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => {
              leerFoto(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
        {avisoFoto ? (
          <p className={`${s.pista} ${s.mal}`} role="alert">{avisoFoto}</p>
        ) : texto.trim() && !codigo ? (
          <p className={`${s.pista} ${s.mal}`}>
            El código tiene {LARGO_CODIGO} letras y números, sin 0, 1, O, I ni L. Revísalo contra la tarjeta.
          </p>
        ) : (
          <p className={s.pista}>Es el que viene impreso atrás, bajo el QR: morcast.mx/g/…</p>
        )}
        {enlace && (
          <div className={s.enlace}>
            <code>{enlace}</code>
            <button type="button" className="pt-btn" onClick={copiar}>
              {copiado ? <Check /> : <Copy />} {copiado ? "Copiado" : "Copiar"}
            </button>
          </div>
        )}
      </section>

      <section className="pt-card">
        <div className={s.paso}>Paso 2</div>
        <h2 className={s.titulo}>Graba el chip</h2>
        <label className={s.sellar}>
          <input type="checkbox" checked={sellar} disabled={activo} onChange={(e) => setSellar(e.target.checked)} />
          <span>
            Sellar el chip al terminar
            <small>
              Sellado ya nadie puede regrabarlo, y <b>no se puede deshacer</b>. Quítalo solo para hacer pruebas.
            </small>
          </span>
        </label>

        {!activo && (
          <button type="button" className={`pt-btn pt-btn-naranja ${s.ancho}`} disabled={!enlace || !puedeGrabar} onClick={grabar}>
            <ContactlessPayment /> {paso === "error" ? "Intentar de nuevo" : "Grabar chip"}
          </button>
        )}

        <div ref={recuadro}>
          <Estado
            estado={estado}
            sellar={sellar}
            onEncima={() => grabador.current?.grabarEncima()}
            onAunque={() => grabador.current?.grabarAunque()}
            onSinSellar={dejarSinSellar}
            onCancelar={soltar}
            onSiguiente={siguiente}
          />
        </div>
      </section>

      {hechas.length > 0 && (
        <section className="pt-card">
          <div className={s.paso}>En esta sesión</div>
          <h2 className={s.titulo} style={{ marginBottom: 0 }}>
            {hechas.length} {hechas.length === 1 ? "chip grabado" : "chips grabados"}
          </h2>
          <ul className={s.hechas}>
            {hechas.map((h) => (
              <li key={h.codigo}>
                <span>
                  {h.codigo}
                  {h.nota && <small className={h.sinAnotar ? s.mal : undefined}>{h.nota}</small>}
                </span>
                <span className={`pt-badge ${h.sellado ? "ok" : "alerta"}`}>{h.sellado ? "Sellado" : "Sin sellar"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** El recuadro que dice qué hacer en cada momento (los pasos de lib/chip-nfc.mjs). */
function Estado({ estado, sellar, onEncima, onAunque, onSinSellar, onCancelar, onSiguiente }) {
  if (!estado) return null;
  const { paso, motivo } = estado;

  if (paso === "pidiendo") {
    return (
      <div className={s.estado} role="status">
        <CircleNotch />
        <strong>Chrome va a pedir permiso</strong>
        <p>Toca «Permitir» para que esta página use el NFC del teléfono.</p>
      </div>
    );
  }
  if (paso === "esperando") {
    return (
      <div className={s.estado} role="status">
        <ContactlessPayment />
        <strong>Acerca la tarjeta a la parte de atrás del teléfono</strong>
        <p>Déjala quieta un par de segundos, hasta que aquí diga «Listo».</p>
        <button type="button" className="pt-btn" onClick={onCancelar}>Cancelar</button>
      </div>
    );
  }
  if (paso === "grabando" || paso === "sellando") {
    return (
      <div className={s.estado} role="status">
        <CircleNotch />
        <strong>{paso === "grabando" ? "Grabando…" : "Sellando…"}</strong>
        <p>No muevas la tarjeta.</p>
      </div>
    );
  }
  if (paso === "otro-gafete") {
    return (
      <div className={`${s.estado} ${s.alerta}`} role="alert">
        <Warning />
        <strong>Este chip ya trae otro gafete</strong>
        <p>
          Trae el código <b>{estado.codigo}</b>. No se le cambió nada. Revisa que sea la tarjeta correcta.
        </p>
        <button type="button" className="pt-btn" onClick={onEncima}>Grabar encima de todos modos</button>
        <button type="button" className="pt-btn" onClick={onCancelar}>Cancelar</button>
      </div>
    );
  }
  if (paso === "chip-dudoso") {
    return (
      <div className={`${s.estado} ${s.alerta}`} role="alert">
        <Warning />
        <strong>Este chip no parece el correcto</strong>
        <p>
          Por su número de serie ({estado.serie}) parece un <b>MIFARE Classic</b>, el de las tarjetas de acceso. Los
          iPhone y muchos Android no lo leen: no sirve para el gafete. No se le cambió nada.
        </p>
        <p>El gafete lleva <b>NTAG213, NTAG215 o NTAG216</b>. Si esta tarjeta vino así de la imprenta, no la aceptes.</p>
        <button type="button" className="pt-btn" onClick={onAunque}>Grabar de todos modos</button>
        <button type="button" className="pt-btn" onClick={onCancelar}>Cancelar</button>
      </div>
    );
  }
  if (paso === "reintenta") {
    return (
      <div className={`${s.estado} ${s.alerta}`} role="alert">
        <Warning />
        <strong>No se grabó</strong>
        <p>{motivo}</p>
        <p>Vuelve a acercar la tarjeta.</p>
        <button type="button" className="pt-btn" onClick={onCancelar}>Cancelar</button>
      </div>
    );
  }
  if (paso === "falta-sellar") {
    return (
      <div className={`${s.estado} ${s.alerta}`} role="alert">
        <LockOpen />
        <strong>Grabado, pero falta sellarlo</strong>
        <p>{motivo}</p>
        <p>Vuelve a acercar <b>la misma tarjeta</b> para sellarla.</p>
        <button type="button" className="pt-btn" onClick={onSinSellar}>Dejarlo sin sellar</button>
      </div>
    );
  }
  if (paso === "hecho") {
    return (
      <div className={`${s.estado} ${estado.sellado ? s.ok : s.alerta}`} role="status">
        {estado.sellado ? <CheckCircle /> : <LockOpen />}
        <strong>{estado.sellado ? "Listo: chip grabado y sellado" : "Listo: chip grabado, sin sellar"}</strong>
        <p>
          {estado.sellado
            ? "Retira la tarjeta. Para comprobarla, acércala a otro teléfono: debe abrir la página del gafete."
            : sellar
              ? "El chip trae el enlace correcto, pero cualquiera podría regrabarlo."
              : "Es una prueba: el chip se puede volver a grabar."}
        </p>
        <button type="button" className={`pt-btn pt-btn-naranja ${s.ancho}`} onClick={onSiguiente}>
          Siguiente tarjeta <ArrowRight />
        </button>
      </div>
    );
  }
  // paso === "error": no se pudo ni encender el lector.
  return (
    <div className={`${s.estado} ${s.mal}`} role="alert">
      <WarningCircle />
      <strong>No se pudo empezar</strong>
      <p>{motivo}</p>
    </div>
  );
}
