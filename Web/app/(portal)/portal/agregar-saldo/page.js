"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  UploadSimple,
  CheckCircle,
  Clock,
  Copy,
  FileText,
  Info,
  X,
} from "@phosphor-icons/react/dist/ssr";
import { pesos, fechaLarga } from "@/lib/portal-datos";
import { DATOS_DEPOSITO, BANCOS, RESPONSABLE_RECARGAS, estadoRecarga } from "@/lib/recargas-datos";
import { listarMovimientos, reportarDeposito, miSaldo } from "@/lib/datos-clientes";
import { clienteActual } from "@/lib/portal-sesion";
import { enHold, HOLD } from "@/lib/estado-sistema";

export default function AgregarSaldo() {
  const inputRef = useRef(null);
  // La referencia se prellena con el RFC de QUIEN ENTRÓ. Antes traía el del
  // cliente de ejemplo, así que el cliente mandaba su depósito con el RFC de
  // otra empresa y Morcast no podía saber de quién era el dinero.
  const [refPropia, setRefPropia] = useState("");
  const [form, setForm] = useState({ monto: "", banco: BANCOS[0], referencia: "" });
  const [archivo, setArchivo] = useState(null); // {archivo, nombre, url, esImagen}
  const [enviando, setEnviando] = useState(false);
  const [enviada, setEnviada] = useState(false);
  const [copiado, setCopiado] = useState("");

  const [misRecargas, setMisRecargas] = useState([]);
  const [cuenta, setCuenta] = useState(null);
  const [errorEnvio, setErrorEnvio] = useState("");

  // No hace falta filtrar por empresa: el RLS ya dejó fuera lo de las demás.
  const recargar = () =>
    Promise.all([listarMovimientos(), miSaldo()]).then(([movs, saldo]) => {
      setMisRecargas(movs.filter((m) => m.tipo === "abono"));
      setCuenta(saldo);
    });

  useEffect(() => {
    let vivo = true;
    recargar().then(() => {
      if (!vivo) return;
    });
    clienteActual().then((yo) => {
      if (!vivo || !yo) return;
      // Si la empresa todavía no tiene RFC capturado se usa su folio, que
      // también identifica el depósito sin inventarle datos fiscales.
      const ref = yo.rfc && yo.rfc !== "—" ? yo.rfc : yo.id;
      setRefPropia(ref);
      setForm((f) => (f.referencia ? f : { ...f, referencia: ref }));
    });
    return () => {
      vivo = false;
    };
  }, []);

  const montoNum = useMemo(() => Number(String(form.monto).replace(/[^\d.]/g, "")) || 0, [form.monto]);
  // `enviando` bloquea el segundo clic: subir el comprobante tarda, y sin
  // esto un doble clic manda el mismo depósito dos veces.
  const puedeEnviar = montoNum > 0 && archivo && !enviando;

  const elegirArchivo = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (archivo?.url) URL.revokeObjectURL(archivo.url); // libera el anterior
    const esImagen = f.type.startsWith("image/");
    // Se guarda el archivo, no solo su nombre: es lo que hay que subir. Antes
    // solo se conservaba `nombre` y la vista previa, así que el comprobante
    // nunca llegaba a ningún lado.
    setArchivo({ archivo: f, nombre: f.name, url: esImagen ? URL.createObjectURL(f) : null, esImagen });
  };

  const copiar = async (texto, cual) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(cual);
      setTimeout(() => setCopiado(""), 1500);
    } catch { /* ignore */ }
  };

  const enviar = async (e) => {
    e.preventDefault();
    if (!puedeEnviar) return;
    setErrorEnvio("");

    setEnviando(true);
    const r = await reportarDeposito({
      monto: montoNum,
      banco: form.banco,
      referencia: form.referencia,
      archivo: archivo.archivo,
    });
    setEnviando(false);

    if (!r.ok) {
      // El motivo real importa: no es lo mismo "se cayó la red" que "ya
      // mandaste este mismo depósito". Con un mensaje genérico el cliente
      // vuelve a intentarlo y duplica el movimiento.
      setErrorEnvio(r.motivo || "No se pudo enviar tu comprobante. Vuelve a intentarlo.");
      return;
    }

    // Se relee de la base: así el cliente ve el registro tal como quedó
    // guardado, no una copia optimista de lo que escribió.
    await recargar();
    setEnviada(true);
    setForm({ monto: "", banco: BANCOS[0], referencia: refPropia });
    if (archivo?.url) URL.revokeObjectURL(archivo.url); // libera el object URL al enviar
    setArchivo(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <>
      <div className="pt-page-head">
        <h1>Agregar saldo</h1>
        <p>Deposita o transfiere a la cuenta de Morcast y sube tu comprobante. Nuestro equipo lo verifica y aplica el saldo a tu cuenta.</p>
      </div>

      {/* Saldo actual */}
      <div className="pt-grid pt-grid-2" style={{ "--pt-cols": "1fr 2fr", gap: "1.1rem", marginBottom: "1.1rem", alignItems: "stretch" }}>
        {enHold() ? (
          <p className="pt-nota-demo">
            {HOLD.motivo} Tu saldo aparecerá aquí en cuanto empiece la facturación.
          </p>
        ) : (
          <div className="pt-saldo">
            <div className="pt-saldo-etiqueta">Saldo a favor actual</div>
            <div className="pt-saldo-monto">{pesos(cuenta ? cuenta.saldoActual : 0)}</div>
            <div className="pt-saldo-fila" style={{ marginTop: "0.6rem" }}>
              <span>Por pagar {pesos(cuenta ? cuenta.porPagar : 0)}</span>
            </div>
          </div>
        )}

        {/* Datos de depósito */}
        <div className="pt-card" style={{ margin: 0 }}>
          <div className="pt-card-head"><h2>Datos para depósito o transferencia</h2></div>
          <div className="pt-deposito">
            {/*
              Mientras los datos sean de demostración NO se enseña la CLABE ni
              la cuenta: son ceros. Un cliente que los copie no puede pagar, y
              la nota de abajo se lee después del error, no antes.
            */}
            {(DATOS_DEPOSITO.demo
              ? [
                  ["Titular", DATOS_DEPOSITO.titular],
                  ["Referencia", DATOS_DEPOSITO.referencia],
                ]
              : [
                  ["Banco", DATOS_DEPOSITO.banco],
                  ["Titular", DATOS_DEPOSITO.titular],
                  ["CLABE", DATOS_DEPOSITO.clabe],
                  ["No. de cuenta", DATOS_DEPOSITO.cuenta],
                  ["Referencia", DATOS_DEPOSITO.referencia],
                ]
            ).map(([k, v]) => (
              <div className="pt-deposito-fila" key={k}>
                <span>{k}</span>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <strong>{v}</strong>
                  {(k === "CLABE" || k === "No. de cuenta") && (
                    <button type="button" className="pt-btn" style={{ padding: "0.25rem 0.5rem" }} onClick={() => copiar(v.replace(/\s/g, ""), k)}>
                      {copiado === k ? <CheckCircle color="#4eb34a" /> : <Copy />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {DATOS_DEPOSITO.demo && (
            <p className="pt-nota-demo">
              <Info /> Todavía no publicamos la cuenta aquí. Pídenos los datos
              para transferir por WhatsApp al <strong>868 384 9478</strong> o al
              correo <strong>contacto@morcast.mx</strong> y sube tu comprobante
              en esta misma pantalla.
            </p>
          )}
        </div>
      </div>

      {/* Formulario de comprobante */}
      <div className="pt-grid pt-grid-2" style={{ "--pt-cols": "1.3fr 1fr", gap: "1.1rem", alignItems: "start" }}>
        <div className="pt-card">
          <div className="pt-card-head"><h2>Registrar comprobante</h2></div>

          {errorEnvio && (
            <p style={{ color: "#ef8080", fontSize: "0.86rem", marginBottom: "0.8rem" }}>{errorEnvio}</p>
          )}

          {enviada && (
            <div className="pt-exito">
              <CheckCircle />
              <div>
                <strong>Comprobante enviado</strong>
                <span>Tu solicitud quedó <b>por verificar</b>. En cuanto {RESPONSABLE_RECARGAS.nombre.split(" ")[0]} confirme el depósito, verás el saldo reflejado. Te avisaremos por correo.</span>
              </div>
              <button className="pt-btn" onClick={() => setEnviada(false)} aria-label="Cerrar"><X /></button>
            </div>
          )}

          <form onSubmit={enviar}>
            <div className="pt-grid pt-grid-2" style={{ gap: "0.8rem", marginBottom: "0.9rem" }}>
              <div className="pt-campo" style={{ margin: 0 }}>
                <label>Monto depositado (MXN)</label>
                <input className="pt-input" inputMode="decimal" placeholder="0.00" value={form.monto}
                  onChange={(e) => setForm({ ...form, monto: e.target.value })} required />
              </div>
              <div className="pt-campo" style={{ margin: 0 }}>
                <label>Banco de origen</label>
                <select className="pt-input" value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })}>
                  {BANCOS.map((b) => <option key={b}>{b}</option>)}
                </select>
              </div>
            </div>
            <div className="pt-campo">
              <label>Referencia o folio de la operación</label>
              <input className="pt-input" value={form.referencia} onChange={(e) => setForm({ ...form, referencia: e.target.value })} placeholder="RFC, contrato o clave de rastreo" />
            </div>

            <label className="pt-dropzone" onClick={() => inputRef.current?.click()}>
              <input ref={inputRef} type="file" accept="image/*,application/pdf" hidden onChange={elegirArchivo} />
              {archivo ? (
                <div className="pt-dropzone-archivo">
                  {archivo.esImagen ? (
                    <img src={archivo.url} alt="Comprobante" />
                  ) : (
                    <div className="pt-dropzone-pdf"><FileText /></div>
                  )}
                  <div>
                    <strong>{archivo.nombre}</strong>
                    <span>Toca para cambiar el archivo</span>
                  </div>
                </div>
              ) : (
                <>
                  <UploadSimple />
                  <strong>Sube tu comprobante</strong>
                  <span>Imagen o PDF de la transferencia / ficha de depósito</span>
                </>
              )}
            </label>

            <button type="submit" className="pt-btn pt-btn-verde" disabled={!puedeEnviar} style={{ marginTop: "1rem", padding: "0.7rem 1.4rem", opacity: puedeEnviar ? 1 : 0.55 }}>
              {enviando ? "Subiendo comprobante…" : "Enviar para verificación"}
            </button>
          </form>
        </div>

        {/* Mis recargas */}
        <div className="pt-card">
          <div className="pt-card-head"><h2>Mis recargas</h2></div>
          {misRecargas.length === 0 ? (
            <div className="pt-vacio">Aún no has registrado recargas.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {misRecargas.map((r) => {
                const est = estadoRecarga(r.estado);
                return (
                  <div key={r.id} style={{ display: "flex", alignItems: "center", gap: "0.7rem", padding: "0.7rem 0", borderBottom: "1px solid var(--mc-linea)" }}>
                    <div className="pt-stat-icono" style={{ margin: 0, width: 36, height: 36 }}>
                      {r.estado === "aplicada" ? <CheckCircle /> : <Clock />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong style={{ fontSize: "0.95rem" }}>{pesos(r.monto)}</strong>
                      <div style={{ color: "var(--mc-gris)", fontSize: "0.8rem" }}>{fechaLarga(r.fecha)} · {r.banco}</div>
                    </div>
                    <span className={`pt-badge ${est.clase}`}>{est.texto}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
