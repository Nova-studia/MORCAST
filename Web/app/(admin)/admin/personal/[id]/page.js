"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowSquareOut,
  ContactlessPayment,
  Eye,
  EyeSlash,
  Printer,
  Warning,
} from "@phosphor-icons/react/dist/ssr";
import { enlaceGafete } from "@/lib/gafetes.mjs";
import { pinLegible } from "@/lib/pin-gafete.mjs";
import { nombreCompleto, faltantes } from "@/lib/personal.mjs";
import { fechaLarga } from "@/lib/portal-datos";
import { leerEmpleado, darDeBaja, reactivar, reponerGafete, verPin } from "../acciones";
import FormEmpleado from "../FormEmpleado";
import { Foto, Insignia, prepararImpresion } from "../piezas";
import s from "../personal.module.css";

/**
 * LA FICHA DE UN EMPLEADO (nivel 3: solo aquí, con la sección Personal).
 * Su gafete (código, PIN, imprimir, grabar chip, reponer), sus datos y su
 * baja. El PIN no llega con la ficha: se pide aparte y verlo queda anotado.
 */

const TEXTO_ESTADO = { vigente: "Vigente", repuesto: "Repuesto", anulado: "Anulado" };
const CLASE_ESTADO = { vigente: "ok", repuesto: "", anulado: "" };
/** "12 oct 2026", con el día de Matamoros (una fecha sola, AAAA-MM-DD, se deja como viene). */
const dia = (momento) => {
  if (!momento) return "";
  const texto = String(momento);
  if (texto.length === 10) return fechaLarga(texto);
  return fechaLarga(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Matamoros" }).format(new Date(texto)));
};

export default function FichaEmpleado() {
  const { id } = useParams();
  const router = useRouter();
  const avisosAlta = useSearchParams().get("avisos");
  const [carga, setCarga] = useState(null);
  const [version, setVersion] = useState(0);
  const [pin, setPin] = useState(null);
  const [panel, setPanel] = useState(null); // "reponer" | "baja" | null
  const [motivo, setMotivo] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    const r = await leerEmpleado(id);
    setCarga(r);
    setVersion((v) => v + 1);
    setPin(null);
  }, [id]);
  useEffect(() => { cargar(); }, [cargar]);

  if (!carga) return <div className="pt-vacio">Cargando la ficha…</div>;
  if (!carga.ok) {
    return (
      <div className={s.ficha}>
        <div className={`pt-card ${s.aviso}`} role="alert">
          <Warning aria-hidden="true" />
          <div><strong>No se pudo abrir la ficha</strong><p>{carga.motivo}</p></div>
        </div>
        <div><Link href="/admin/personal" className="pt-btn" prefetch={false}><ArrowLeft /> Personal</Link></div>
      </div>
    );
  }

  const { empleado, gafetes, jefes } = carga;
  const vigente = gafetes.find((g) => g.estado === "vigente") || null;
  const anteriores = gafetes.filter((g) => g.estado !== "vigente");
  const activo = empleado.estado === "activo";
  const falta = activo ? faltantes(empleado) : [];
  const enlace = vigente ? enlaceGafete(vigente.codigo) : null;

  /** Corre una acción del servidor y, si sale bien, vuelve a leer la ficha. */
  const hacer = async (accion) => {
    setOcupado(true);
    setAviso("");
    let r;
    try {
      r = await accion();
    } catch {
      r = { ok: false, motivo: "No se pudo completar. Revisa tu conexión e inténtalo de nuevo." };
    }
    setOcupado(false);
    if (!r.ok) { setAviso(r.motivo); return; }
    setPanel(null);
    setMotivo("");
    setAviso(r.avisos?.join(" ") || "");
    await cargar();
  };

  const alternarPin = async () => {
    if (pin) { setPin(null); return; }
    setOcupado(true);
    const r = await verPin(empleado.id).catch(() => ({ ok: false, motivo: "No se pudo leer el PIN." }));
    setOcupado(false);
    if (r.ok) setPin(r.pin); else setAviso(r.motivo);
  };

  return (
    <div className={s.ficha}>
      <div className={s.cabeza}>
        <div className={s.titular}>
          <Foto empleado={empleado} tam="media" />
          <div>
            <h1>{nombreCompleto(empleado)}</h1>
            <p>{[empleado.puesto, empleado.area].filter(Boolean).join(" · ") || "Sin puesto"}</p>
            <div className={s.insignias}>
              <Insignia clase={activo ? "ok" : ""}>{activo ? "Activo" : "De baja"}</Insignia>
              <Insignia>No. {empleado.numero}</Insignia>
              {falta.includes("foto") && <Insignia clase="alerta">Falta la foto</Insignia>}
            </div>
          </div>
        </div>
        <Link href="/admin/personal" className="pt-btn" prefetch={false}><ArrowLeft /> Personal</Link>
      </div>

      {(aviso || avisosAlta) && (
        <div className="pt-login-error" role="alert" style={{ margin: 0 }}>{aviso || avisosAlta}</div>
      )}

      {/* ---------- Gafete ---------- */}
      <section className="pt-card">
        <div className="pt-card-head"><h2>Gafete</h2></div>
        {!activo ? (
          <p className={s.nota} style={{ marginTop: 0 }}>
            Está de baja{empleado.baja_fecha ? ` desde el ${dia(empleado.baja_fecha)}` : ""}
            {empleado.baja_motivo ? ` (${empleado.baja_motivo})` : ""}. Su gafete dice NO VÁLIDO a quien lo escanee.
            Al reactivarlo se le emite uno nuevo.
          </p>
        ) : !vigente ? (
          <>
            <p className={s.nota} style={{ marginTop: 0 }}>No tiene un gafete vigente.</p>
            <div className={s.pie} style={{ marginTop: "0.9rem" }}>
              <button type="button" className="pt-btn" disabled={ocupado} onClick={() => hacer(() => reponerGafete(empleado.id, "Primer gafete"))}>
                Emitir gafete
              </button>
            </div>
          </>
        ) : (
          <>
            <div className={s.gafete}>
              <div className={s.dato}>
                <span>Código</span>
                <strong className={s.codigo}>{vigente.codigo}</strong>
              </div>
              <div className={s.dato}>
                <span>PIN de emergencia</span>
                <strong className={s.codigo}>{pin ? pinLegible(pin) : "••• •••"}</strong>
              </div>
              <div className={s.dato}>
                <span>Emitido</span>
                <strong>{dia(vigente.emitido)}</strong>
              </div>
              <div className={s.dato}>
                <span>Imprenta</span>
                <strong>{vigente.impreso_en ? `Mandado el ${dia(vigente.impreso_en)}` : "Sin mandar a imprimir"}</strong>
              </div>
              <div className={s.dato}>
                <span>Chip NFC</span>
                <strong>{vigente.chip_grabado_en ? `Grabado el ${dia(vigente.chip_grabado_en)}` : "Pendiente de grabar"}</strong>
              </div>
              <div className={s.dato} style={{ gridColumn: "1 / -1" }}>
                <span>Lo que abre el QR y el chip</span>
                <strong>
                  <a href={`/g/${vigente.codigo}`} target="_blank" rel="noreferrer">
                    {enlace.replace("https://", "")} <ArrowSquareOut aria-hidden="true" />
                  </a>
                </strong>
              </div>
            </div>
            <div className={s.pie} style={{ marginTop: "1.1rem" }}>
              <button type="button" className="pt-btn" onClick={alternarPin} disabled={ocupado}>
                {pin ? <EyeSlash /> : <Eye />} {pin ? "Ocultar PIN" : "Ver PIN"}
              </button>
              <button type="button" className="pt-btn" onClick={() => router.push(prepararImpresion([empleado.id]))}>
                <Printer /> Hoja para la imprenta
              </button>
              <Link href={`/admin/personal/chips?c=${vigente.codigo}`} className="pt-btn" prefetch={false}>
                <ContactlessPayment /> Grabar chip
              </Link>
              <button type="button" className="pt-btn" disabled={ocupado} onClick={() => { setPanel(panel === "reponer" ? null : "reponer"); setMotivo(""); }}>
                Reponer gafete
              </button>
            </div>
            {falta.length > 0 && (
              <p className={s.falta} style={{ marginTop: "0.8rem", fontSize: "0.84rem" }}>
                Antes de mandarlo a imprimir: {falta.includes("foto") ? "súbele su foto" : ""}{falta.length === 2 ? " y " : ""}{falta.includes("puesto") ? "ponle su puesto" : ""}.
              </p>
            )}
            {panel === "reponer" && (
              <div className={s.confirmar}>
                <span>
                  Reponer es para una tarjeta <strong>perdida, robada o rota</strong>. La tarjeta de ahora deja de valer
                  en este momento (dirá NO VÁLIDO) y nace una con <strong>otro código y otro PIN</strong>, que hay que
                  mandar a imprimir y grabarle su chip.
                </span>
                <input className="pt-input" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo: se perdió, se rompió…" aria-label="Motivo de la reposición" maxLength={200} />
                <div className={s.pie}>
                  <button type="button" className="pt-btn" style={{ borderColor: "var(--pt-alerta)", color: "var(--pt-alerta)" }} disabled={ocupado || !motivo.trim()}
                    onClick={() => hacer(() => reponerGafete(empleado.id, motivo))}>
                    Sí, reponer
                  </button>
                  <button type="button" className="pt-btn" onClick={() => setPanel(null)} disabled={ocupado}>Cancelar</button>
                </div>
              </div>
            )}
          </>
        )}

        {anteriores.length > 0 && (
          <ul className={s.historial} aria-label="Gafetes anteriores">
            {anteriores.map((g) => (
              <li key={g.id}>
                <span className={s.mono}>{g.codigo}</span>
                <Insignia clase={CLASE_ESTADO[g.estado]}>{TEXTO_ESTADO[g.estado]}</Insignia>
                <small>
                  Emitido el {dia(g.emitido)}
                  {g.anulado_en ? ` · dejó de valer el ${dia(g.anulado_en)}` : ""}
                  {g.anulado_motivo ? ` · ${g.anulado_motivo}` : ""}
                </small>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---------- Datos ---------- */}
      <section className="pt-card">
        <div className="pt-card-head"><h2>Datos</h2></div>
        {/* `key`: cada vez que se vuelve a leer la ficha, el formulario arranca con lo guardado. */}
        <FormEmpleado key={version} empleado={empleado} jefes={jefes}
          alGuardar={async () => { await cargar(); setAviso(""); }} />
      </section>

      {/* ---------- Baja ---------- */}
      <section className="pt-card">
        <div className="pt-card-head"><h2>{activo ? "Dar de baja" : "Reactivar"}</h2></div>
        {activo ? (
          <>
            <p className={s.nota} style={{ marginTop: 0 }}>
              Cuando alguien deja de trabajar en Morcast. Su gafete dice NO VÁLIDO al instante, aunque no devuelva la
              tarjeta, y su ficha se conserva.
            </p>
            {panel !== "baja" ? (
              <div className={s.pie} style={{ marginTop: "0.9rem" }}>
                <button type="button" className="pt-btn" disabled={ocupado} onClick={() => { setPanel("baja"); setMotivo(""); }}>Dar de baja</button>
              </div>
            ) : (
              <div className={s.confirmar}>
                <span>¿Dar de baja a <strong>{nombreCompleto(empleado)}</strong>? Su gafete deja de valer en este momento.</span>
                <input className="pt-input" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo: renuncia, término de contrato…" aria-label="Motivo de la baja" maxLength={200} />
                <div className={s.pie}>
                  <button type="button" className="pt-btn" style={{ borderColor: "var(--pt-error)", color: "var(--pt-error)" }} disabled={ocupado || !motivo.trim()}
                    onClick={() => hacer(() => darDeBaja(empleado.id, motivo))}>
                    Sí, dar de baja
                  </button>
                  <button type="button" className="pt-btn" onClick={() => setPanel(null)} disabled={ocupado}>Cancelar</button>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <p className={s.nota} style={{ marginTop: 0 }}>
              Vuelve a estar activo y se le emite un gafete <strong>nuevo</strong>: el anterior no revive.
            </p>
            <div className={s.pie} style={{ marginTop: "0.9rem" }}>
              <button type="button" className="pt-btn" disabled={ocupado} onClick={() => hacer(() => reactivar(empleado.id))}>Reactivar</button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
