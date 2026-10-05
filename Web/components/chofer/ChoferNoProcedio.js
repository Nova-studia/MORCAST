"use client";

import { useRef, useState } from "react";
import { Prohibit, Camera, CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { MOTIVOS_NO_PROCEDIO } from "@/lib/rutas-datos";
import { validarNoProcedio, LIMITES_REPORTE } from "@/lib/chofer-reportes.mjs";
import { subirEvidencia } from "@/lib/datos-archivos";
import { marcarNoProcedio } from "@/app/acciones-chofer";

/**
 * "NO PROCEDIÓ": el chofer llegó y no se pudo recoger.
 *
 * Pedido de los dueños (4-oct-2026): si el residuo no es el que se agendó
 * (o estaba cerrado, o no estaba el contenedor), el chofer lo marca con el
 * motivo y NO se le cobra al cliente. El motivo es obligatorio —la base lo
 * exige (db/023)— porque es el respaldo de Morcast cuando el cliente
 * pregunte por qué no le recogieron.
 *
 * Empieza cerrado: es la salida rara, no el camino normal. Un formulario
 * abierto debajo de cada parada invitaría a usarlo por no hacer la parada.
 */
export default function ChoferNoProcedio({ parada, alTerminar }) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [detalle, setDetalle] = useState("");
  const [foto, setFoto] = useState(null); // { ruta, url }
  const [subiendo, setSubiendo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const refFoto = useRef(null);

  const tomarFoto = async (e) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setError("");
    setSubiendo(true);
    // Misma cubeta y carpeta que la evidencia (`evidencias/<solicitud>/…`):
    // la política de db/008 ya deja al chofer subir ahí, y la oficina la
    // encuentra junto a las demás fotos de esa parada.
    const r = await subirEvidencia(parada.id, "no-procedio", archivo);
    setSubiendo(false);
    if (!r.ok) {
      setError("No se pudo subir la foto. Revisa tu señal o sigue sin foto.");
      return;
    }
    if (foto?.url) URL.revokeObjectURL(foto.url);
    setFoto({ ruta: r.ruta || null, url: URL.createObjectURL(archivo) });
  };

  const enviar = async () => {
    const v = validarNoProcedio({ motivo, detalle });
    if (!v.ok) {
      setError(v.mensaje);
      return;
    }
    setEnviando(true);
    setError("");
    const r = await marcarNoProcedio(parada.id, { motivo, detalle, foto: foto?.ruta || null });
    setEnviando(false);
    if (!r.ok) {
      setError(r.motivo || "No se pudo guardar. Revisa tu señal e intenta otra vez.");
      return;
    }
    alTerminar?.();
  };

  if (!abierto) {
    return (
      <button type="button" className="pt-btn ch-boton-peligro" onClick={() => setAbierto(true)}>
        <Prohibit aria-hidden="true" /> No procedió
      </button>
    );
  }

  return (
    <div className="pt-card">
      <h2 className="ch-form-titulo">
        <Prohibit aria-hidden="true" /> No procedió
      </h2>
      <p className="ch-form-ayuda">
        Úsalo solo si llegaste y no se pudo recolectar. La parada se cierra sin
        recolección.
      </p>

      <div className="ch-sin-cobro">
        <CheckCircle aria-hidden="true" weight="fill" />
        <span>
          <strong>No se le cobra al cliente.</strong> La oficina ve el motivo y
          le avisa.
        </span>
      </div>

      <span className="ch-etiqueta" id="motivo-np">¿Qué pasó?</span>
      <div className="ch-opciones" role="radiogroup" aria-labelledby="motivo-np">
        {MOTIVOS_NO_PROCEDIO.map((m) => (
          <label key={m} className={`ch-opcion ${motivo === m ? "activa" : ""}`}>
            <input
              type="radio"
              name="motivo-no-procedio"
              value={m}
              checked={motivo === m}
              onChange={() => setMotivo(m)}
            />
            {m}
          </label>
        ))}
      </div>
      {motivo === "El residuo no es el que se agendó" && parada.tipoResiduo && (
        <p className="ch-form-ayuda" style={{ marginTop: "0.6rem", marginBottom: 0 }}>
          Se agendó: <strong>{parada.tipoResiduo}</strong>. Escribe abajo qué encontraste.
        </p>
      )}

      <label className="ch-etiqueta" htmlFor="detalle-np">
        Detalle {motivo === "Otro" ? "(obligatorio)" : <small>(opcional)</small>}
      </label>
      <textarea
        id="detalle-np"
        className="pt-input"
        rows={3}
        maxLength={LIMITES_REPORTE.detalle}
        value={detalle}
        onChange={(e) => setDetalle(e.target.value)}
        placeholder="Ej. había llantas y escombro, no RSU"
      />

      <span className="ch-etiqueta">
        Foto <small>(opcional, ayuda con el cliente)</small>
      </span>
      <input ref={refFoto} type="file" accept="image/*" capture="environment" hidden onChange={tomarFoto} />
      <button
        type="button"
        className="pt-btn ch-boton-sec"
        onClick={() => refFoto.current?.click()}
        disabled={subiendo}
      >
        <Camera aria-hidden="true" /> {subiendo ? "Subiendo la foto…" : foto ? "Tomar otra foto" : "Tomar foto"}
      </button>
      {foto?.url && <img src={foto.url} alt="Foto de lo que se encontró" className="ch-foto-mini" />}

      {error && <div className="ch-error" role="alert">{error}</div>}

      <div className="ch-fila-botones">
        <button
          type="button"
          className="pt-btn ch-boton-peligro"
          onClick={enviar}
          disabled={enviando || subiendo || !motivo}
        >
          {enviando ? "Guardando…" : "Marcar «No procedió»"}
        </button>
        <button type="button" className="pt-btn ch-boton-sec" onClick={() => setAbierto(false)} disabled={enviando}>
          Cancelar, sí se puede recolectar
        </button>
      </div>
    </div>
  );
}
