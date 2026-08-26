"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Camera,
  CheckCircle,
  Hash,
  FloppyDisk,
  ArrowsOut,
  Truck,
  MapPin,
} from "@phosphor-icons/react/dist/ssr";
import VisorFoto from "@/components/VisorFoto";
import { rutaDelDia, marcarEnRuta, cerrarRecoleccion, hoyISO } from "@/lib/datos-chofer";
import { subirEvidencia } from "@/lib/datos-archivos";
import useUbicacion, { esConfiable } from "@/lib/ubicacion";

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
  // El chofer es el primero que necesita ver su foto en grande: es su última
  // oportunidad de notar que salió movida ANTES de irse de la parada.
  const [viendo, setViendo] = useState(null);

  // Se pide al ABRIR la parada, mientras el chofer teclea el código del
  // contenedor. Si se pidiera al tomar la foto, el diálogo del navegador
  // competiría con la cámara abriéndose — dos cosas peleando por la pantalla
  // en el peor momento. Y como vigila, para cuando llega a la foto el GPS ya
  // afinó: la primera lectura suele venir de la red (cientos de metros) y la
  // buena llega unos segundos después.
  const { lectura, estado: estadoGps, motivo: motivoGps } = useUbicacion();

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

    // La lectura se congela AQUÍ, al momento de la foto, y no se vuelve a
    // tocar: si el chofer se mueve entre el antes y el después, cada sello
    // conserva dónde se tomó su propia foto.
    const dato = {
      ruta: r.ruta,
      url: URL.createObjectURL(archivo),
      hora: horaAhora(),
      ubicacion: lectura || null,
    };
    const siguiente = cual === "antes" ? 2 : 4;
    if (cual === "antes") setAntes(dato); else setDespues(dato);
    setPaso(siguiente);

    // El object URL no sobrevive a una recarga; se guarda sin él.
    const sinUrl = { ruta: dato.ruta, hora: dato.hora, ubicacion: dato.ubicacion };
    memoria.guardar(id, {
      qr,
      peso,
      paso: siguiente,
      antes: cual === "antes" ? sinUrl : antes && { ruta: antes.ruta, hora: antes.hora, ubicacion: antes.ubicacion },
      despues: cual === "despues" ? sinUrl : despues && { ruta: despues.ruta, hora: despues.hora, ubicacion: despues.ubicacion },
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
      ubicacionAntes: antes?.ubicacion || null,
      ubicacionDespues: despues?.ubicacion || null,
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
              <ArrowLeft /> Volver a mi ruta
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
        <ArrowLeft /> Mi ruta
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

      {/* El chofer tiene que saber ANTES de tomar la foto si va a llevar
          sello, no enterarse después en la oficina. Se dice en un renglón y
          sin alarma: la parada se puede cerrar igual, sólo que sin respaldo
          de ubicación. */}
      <div className={`ch-gps ${estadoGps === "lista" && esConfiable(lectura) ? "ok" : estadoGps === "pidiendo" ? "buscando" : "sin"}`}>
        <MapPin aria-hidden="true" weight={estadoGps === "lista" ? "fill" : "regular"} />
        {estadoGps === "pidiendo" && <span>Buscando tu ubicación…</span>}
        {estadoGps === "lista" && esConfiable(lectura) && (
          <span>Ubicación lista · precisión ±{lectura.precision_m} m</span>
        )}
        {estadoGps === "lista" && !esConfiable(lectura) && (
          <span>
            Señal débil · ±{lectura.precision_m} m. La foto se guarda, pero la
            ubicación no alcanza para respaldar el domicilio.
          </span>
        )}
        {["negada", "sin-senal", "no-disponible"].includes(estadoGps) && (
          <span>{motivoGps}</span>
        )}
      </div>

      <div className="pt-card">
        {paso === 0 && (
          <>
            <h2 style={{ fontSize: "1rem", marginBottom: "0.3rem" }}>
              <Hash aria-hidden="true" /> Código del contenedor
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
              <Camera aria-hidden="true" /> Foto ANTES
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
              <Camera /> {subiendo === "antes" ? "Subiendo la foto…" : "Tomar foto"}
            </button>
          </>
        )}

        {paso === 2 && (
          <>
            <h2 style={{ fontSize: "1rem", marginBottom: "0.3rem" }}>
              <Truck size={16} /> Recolecta los residuos
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
              <Camera aria-hidden="true" /> Foto DESPUÉS
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
              <Camera /> {subiendo === "despues" ? "Subiendo la foto…" : "Tomar foto"}
            </button>
          </>
        )}

        {paso === 4 && (
          <>
            <h2 style={{ fontSize: "1rem", marginBottom: "0.3rem" }}>
              <FloppyDisk aria-hidden="true" /> Peso recolectado
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
              {guardando ? "Guardando evidencia…" : "Finalizar recolección"} <CheckCircle />
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
              <button
                type="button"
                className="ch-foto-btn"
                onClick={() => setViendo(0)}
                aria-label="Ver en grande la foto de antes"
              >
                <img src={antes.url} alt="Contenedor lleno" className="ch-foto" />
                <span className="ch-foto-lupa" aria-hidden="true"><ArrowsOut /></span>
              </button>
            </div>
          )}
          {despues && (
            <div>
              <div style={{ fontSize: "0.8rem", color: "var(--mc-gris)" }}>Después · {despues.hora}</div>
              <button
                type="button"
                className="ch-foto-btn"
                onClick={() => setViendo(antes ? 1 : 0)}
                aria-label="Ver en grande la foto de después"
              >
                <img src={despues.url} alt="Contenedor vacío" className="ch-foto" />
                <span className="ch-foto-lupa" aria-hidden="true"><ArrowsOut /></span>
              </button>
            </div>
          )}
        </div>
      )}

      {viendo !== null && (
        <VisorFoto
          fotos={[
            antes && { url: antes.url, etiqueta: "Antes · contenedor lleno", hora: antes.hora },
            despues && { url: despues.url, etiqueta: "Después · contenedor vacío", hora: despues.hora },
          ].filter(Boolean)}
          indice={viendo}
          alCerrar={() => setViendo(null)}
        />
      )}
    </>
  );
}
