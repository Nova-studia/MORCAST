"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { FiArrowLeft, FiCamera, FiCheckCircle, FiTruck, FiHash, FiSave } from "react-icons/fi";
import { rutaDelDia, marcarEnRuta, cerrarRecoleccion, hoyISO } from "@/lib/datos-chofer";
import { subirEvidencia } from "@/lib/datos-archivos";

/**
 * Etiquetas cortas A PROPÓSITO. Con "Foto antes" / "Foto después" el quinto
 * rótulo se partía en dos renglones y descuadraba la fila entera; y la
 * palabra "Foto" repetida dos veces no agrega nada, porque el paso ya lo dice
 * con su propio encabezado y su icono de cámara.
 */
const PASOS = ["Contenedor", "Antes", "Recolectar", "Después", "Peso"];

/** Hora local en HH:MM, para mostrarla junto a cada foto. */
const horaAhora = () => {
  const f = new Date();
  return `${String(f.getHours()).padStart(2, "0")}:${String(f.getMinutes()).padStart(2, "0")}`;
};

/**
 * Lo avanzado de una parada se guarda en el propio teléfono.
 *
 * Antes las fotos vivían en memoria hasta el último botón: si el chofer
 * recargaba, se le iba la señal o le entraba una llamada, perdía las dos fotos
 * ya tomadas y tenía que repetir la parada entera. En la calle eso pasa.
 *
 * Ahora cada foto se sube en cuanto se toma y aquí solo se anota su RUTA, que
 * es un texto corto. Al recargar se recupera dónde iba.
 */
const memoria = {
  llave: (id) => `morcast:parada:${id}`,
  leer(id) {
    try {
      return JSON.parse(localStorage.getItem(this.llave(id)) || "null");
    } catch {
      return null;
    }
  },
  guardar(id, datos) {
    try {
      localStorage.setItem(this.llave(id), JSON.stringify(datos));
    } catch { /* sin espacio: se sigue, no vale tumbar la parada por esto */ }
  },
  borrar(id) {
    try { localStorage.removeItem(this.llave(id)); } catch { /* ignore */ }
  },
};

export default function RecoleccionChofer() {
  const { id } = useParams();
  const router = useRouter();

  const [parada, setParada] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [paso, setPaso] = useState(0);

  const [qr, setQr] = useState("");
  const [antes, setAntes] = useState(null);    // { archivo, url, hora }
  const [despues, setDespues] = useState(null);
  const [peso, setPeso] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState("");   // "antes" | "despues" | ""
  const [error, setError] = useState("");

  const refAntes = useRef(null);
  const refDespues = useRef(null);

  useEffect(() => {
    let vivo = true;
    rutaDelDia(hoyISO()).then((lista) => {
      if (!vivo) return;
      setParada(lista.find((p) => p.id === id) || null);
      setCargando(false);
    });
    // Se recupera lo que ya se había hecho en esta parada.
    const previo = memoria.leer(id);
    if (previo) {
      setQr(previo.qr || "");
      setPeso(previo.peso || "");
      if (previo.antes) setAntes(previo.antes);
      if (previo.despues) setDespues(previo.despues);
      setPaso(previo.paso || 0);
    }
    return () => {
      vivo = false;
    };
  }, [id]);

  // Los object URL de las fotos se liberan al salir, o el navegador se los
  // queda en memoria hasta que se recargue la página.
  useEffect(() => {
    return () => {
      if (antes?.url) URL.revokeObjectURL(antes.url);
      if (despues?.url) URL.revokeObjectURL(despues.url);
    };
  }, [antes, despues]);

  const tomarFoto = (cual) => async (e) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setError("");
    setSubiendo(cual);

    // Se sube YA, no al final. Si algo pasa después, la foto ya está a salvo.
    const r = await subirEvidencia(id, cual, archivo);
    setSubiendo("");
    if (!r.ok) {
      setError("No se pudo subir la foto. Revisa tu señal y tómala otra vez.");
      return;
    }

    const dato = { ruta: r.ruta, url: URL.createObjectURL(archivo), hora: horaAhora() };
    const siguiente = cual === "antes" ? 2 : 4;
    if (cual === "antes") setAntes(dato); else setDespues(dato);
    setPaso(siguiente);

    // El object URL no sobrevive a una recarga; se guarda sin él.
    const sinUrl = { ruta: dato.ruta, hora: dato.hora };
    memoria.guardar(id, {
      qr,
      peso,
      paso: siguiente,
      antes: cual === "antes" ? sinUrl : antes && { ruta: antes.ruta, hora: antes.hora },
      despues: cual === "despues" ? sinUrl : despues && { ruta: despues.ruta, hora: despues.hora },
    });
  };

  const confirmarContenedor = async () => {
    if (!qr.trim()) return;
    await marcarEnRuta(id);
    setPaso(1);
    memoria.guardar(id, { qr: qr.trim(), peso, paso: 1, antes: null, despues: null });
  };

  const finalizar = async () => {
    setGuardando(true);
    setError("");
    const r = await cerrarRecoleccion({
      solicitudId: id,
      qr: qr.trim(),
      pesoKg: peso,
      // Ya subidas: aquí solo viajan sus rutas.
      rutaAntes: antes?.ruta || null,
      rutaDespues: despues?.ruta || null,
      horaAntes: antes ? new Date().toISOString() : null,
      horaDespues: despues ? new Date().toISOString() : null,
    });
    if (!r.ok) {
      setError(r.motivo || "No se pudo guardar. Revisa tu señal e intenta otra vez.");
      setGuardando(false);
      return;
    }
    memoria.borrar(id);   // la parada quedó cerrada: ya no hay nada que retomar
    router.replace("/chofer");
  };

  const puedeFinalizar = useMemo(
    () => Boolean(qr.trim() && antes && despues && Number(peso) > 0),
    [qr, antes, despues, peso]
  );

  if (cargando) return <div className="pt-vacio">Cargando…</div>;

  if (!parada) {
    return (
      <div className="pt-card">
        <div className="pt-vacio">
          Esta recolección no está en tu ruta de hoy.
          <div style={{ marginTop: "0.8rem" }}>
            <Link href="/chofer" className="pt-btn ch-volver">
              <FiArrowLeft /> Volver a mi ruta
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Volver es el escape de esta pantalla: con guantes tiene que
          alcanzarse igual que los demás botones, no ser el más chico. */}
      <Link href="/chofer" className="pt-btn ch-volver">
        <FiArrowLeft /> Mi ruta
      </Link>

      <div className="pt-page-head ch-encabezado">
        <h1>{parada.cliente}</h1>
        <p>{parada.direccion}</p>
      </div>

      <div className="ch-pasos">
        {PASOS.map((p, i) => (
          <div key={p} className={`ch-paso ${i === paso ? "activo" : ""} ${i < paso ? "hecho" : ""}`}>
            <div className="ch-paso-bola">{i < paso ? "✓" : i + 1}</div>
            <div className="ch-paso-txt">{p}</div>
          </div>
        ))}
      </div>

      <div className="pt-card">
        {paso === 0 && (
          <>
            <h2 style={{ fontSize: "1rem", marginBottom: "0.3rem" }}>
              <FiHash aria-hidden="true" /> Código del contenedor
            </h2>
            <p style={{ fontSize: "0.85rem", color: "var(--mc-gris)", marginBottom: "0.8rem" }}>
              Escríbelo tal como viene en la calcomanía, por ejemplo MOR-C-0421.
            </p>
            <input
              className="pt-input"
              value={qr}
              onChange={(e) => setQr(e.target.value.toUpperCase())}
              placeholder="MOR-C-0000"
              autoCapitalize="characters"
              style={{ width: "100%", marginBottom: "0.9rem", fontSize: "1.05rem" }}
            />
            <button
              type="button"
              className="pt-btn pt-btn-verde ch-boton-grande"
              onClick={confirmarContenedor}
              disabled={!qr.trim()}
            >
              Continuar
            </button>
          </>
        )}

        {paso === 1 && (
          <>
            <h2 style={{ fontSize: "1rem", marginBottom: "0.3rem" }}>
              <FiCamera aria-hidden="true" /> Foto ANTES
            </h2>
            <p style={{ fontSize: "0.85rem", color: "var(--mc-gris)", marginBottom: "0.8rem" }}>
              Toma la foto del contenedor lleno. Es el comprobante del cliente.
            </p>
            {/* capture="environment" abre directo la cámara trasera del
                teléfono, sin pasar por la galería. */}
            <input
              ref={refAntes}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={tomarFoto("antes")}
            />
            <button
              type="button"
              className="pt-btn pt-btn-verde ch-boton-grande"
              onClick={() => refAntes.current?.click()}
              disabled={subiendo === "antes"}
            >
              <FiCamera /> {subiendo === "antes" ? "Subiendo la foto…" : "Tomar foto"}
            </button>
          </>
        )}

        {paso === 2 && (
          <>
            <h2 style={{ fontSize: "1rem", marginBottom: "0.3rem" }}>
              <FiTruck aria-hidden="true" /> Recolecta los residuos
            </h2>
            <p style={{ fontSize: "0.85rem", color: "var(--mc-gris)", marginBottom: "0.8rem" }}>
              Vacía el contenedor y confirma cuando termines.
            </p>
            <button
              type="button"
              className="pt-btn pt-btn-verde ch-boton-grande"
              onClick={() => setPaso(3)}
            >
              Ya recolecté
            </button>
          </>
        )}

        {paso === 3 && (
          <>
            <h2 style={{ fontSize: "1rem", marginBottom: "0.3rem" }}>
              <FiCamera aria-hidden="true" /> Foto DESPUÉS
            </h2>
            <p style={{ fontSize: "0.85rem", color: "var(--mc-gris)", marginBottom: "0.8rem" }}>
              Toma la foto del contenedor ya vacío.
            </p>
            <input
              ref={refDespues}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={tomarFoto("despues")}
            />
            <button
              type="button"
              className="pt-btn pt-btn-verde ch-boton-grande"
              onClick={() => refDespues.current?.click()}
              disabled={subiendo === "despues"}
            >
              <FiCamera /> {subiendo === "despues" ? "Subiendo la foto…" : "Tomar foto"}
            </button>
          </>
        )}

        {paso === 4 && (
          <>
            <h2 style={{ fontSize: "1rem", marginBottom: "0.3rem" }}>
              <FiSave aria-hidden="true" /> Peso recolectado
            </h2>
            <p style={{ fontSize: "0.85rem", color: "var(--mc-gris)", marginBottom: "0.8rem" }}>
              En kilogramos. Si no lo pesaste, pon el estimado.
            </p>
            <input
              className="pt-input"
              type="number"
              inputMode="decimal"
              min="0"
              value={peso}
              onChange={(e) => setPeso(e.target.value)}
              placeholder="0"
              style={{ width: "100%", marginBottom: "0.9rem", fontSize: "1.05rem" }}
            />
            {error && (
              <p style={{ color: "#ef8080", fontSize: "0.86rem", marginBottom: "0.7rem" }}>{error}</p>
            )}
            <button
              type="button"
              className="pt-btn pt-btn-verde ch-boton-grande"
              onClick={finalizar}
              disabled={!puedeFinalizar || guardando}
            >
              {guardando ? "Guardando evidencia…" : "Finalizar recolección"} <FiCheckCircle />
            </button>
          </>
        )}
      </div>

      {(antes || despues) && (
        <div className="pt-card">
          <h2 style={{ fontSize: "0.95rem", marginBottom: "0.5rem" }}>Evidencia</h2>
          {antes && (
            <div style={{ marginBottom: "0.8rem" }}>
              <div style={{ fontSize: "0.8rem", color: "var(--mc-gris)" }}>Antes · {antes.hora}</div>
              <img src={antes.url} alt="Contenedor lleno" className="ch-foto" />
            </div>
          )}
          {despues && (
            <div>
              <div style={{ fontSize: "0.8rem", color: "var(--mc-gris)" }}>Después · {despues.hora}</div>
              <img src={despues.url} alt="Contenedor vacío" className="ch-foto" />
            </div>
          )}
        </div>
      )}
    </>
  );
}
