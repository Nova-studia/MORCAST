/**
 * LO QUE EL CHOFER REPORTA DESDE LA CALLE: "No procedió" e incidentes.
 *
 * ESPEJO de `Web/lib/chofer-reportes.mjs` (y `MOTIVOS_NO_PROCEDIO` de
 * `Web/lib/rutas-datos.js`). Al tocar uno, tocar el otro: la web valida lo
 * mismo en el servidor, y los `id` de los tipos son los que acepta la base
 * (db/023, `incidentes.tipo`).
 *
 * Pedidos de los dueños (4-oct-2026):
 *   · Si al llegar el residuo no es el que se agendó (o no se pudo entrar),
 *     el chofer marca "No procedió" con el motivo, y NO se cobra.
 *   · Un botón para avisar a la oficina de un accidente, un retraso, una
 *     falla, o de un contenedor dañado, movido o que no está.
 *
 * Lógica pura, sin React ni Supabase, para probarla con `node --test`
 * (tests/chofer-reportes.test.mjs). Aquí sirve para decirle al chofer qué
 * falta ANTES de mandar; quien protege la base es el RLS y sus triggers.
 */

/** Los motivos del "No procedió". Son lo que la oficina va a CONTAR. */
export const MOTIVOS_NO_PROCEDIO = [
  "El residuo no es el que se agendó",
  "Cerrado o sin acceso",
  "El contenedor no estaba",
  "El cliente canceló en el lugar",
  "Otro",
];

/** Teléfono de la oficina, para el botón de "llamar" del accidente. */
export const TELEFONO_OFICINA = "868 384 9478";
export const TELEFONO_OFICINA_ENLACE = "tel:+528683849478";

/** Topes de texto. Lo largo se platica por teléfono, no en un formulario. */
export const LIMITES_REPORTE = { descripcion: 1000, detalle: 500 };

/**
 * Los tipos de incidente, en el orden en que se le ofrecen al chofer.
 * `grupo` separa lo que le pasa al camión de lo que le pasa al contenedor,
 * porque lo segundo casi siempre va amarrado a una parada.
 */
export const TIPOS_INCIDENTE = [
  { id: "accidente", texto: "Accidente", grupo: "camino", urgente: true,
    ayuda: "Choque, golpe o alguien lastimado." },
  { id: "retraso", texto: "Retraso", grupo: "camino",
    ayuda: "Vas a llegar tarde a las paradas que siguen." },
  { id: "falla-mecanica", texto: "Falla mecánica", grupo: "camino",
    ayuda: "La unidad no arranca, se calienta, una llanta…" },
  { id: "otro", texto: "Otra cosa", grupo: "camino",
    ayuda: "Cualquier cosa que la oficina deba saber." },
  { id: "contenedor-danado", texto: "Contenedor dañado", grupo: "contenedor",
    ayuda: "Roto, sin tapa, sin ruedas, quemado." },
  { id: "contenedor-movido", texto: "Contenedor movido o en otro lugar", grupo: "contenedor",
    ayuda: "No está donde siempre, o lo cambiaron de sitio." },
  { id: "contenedor-no-esta", texto: "El contenedor no está", grupo: "contenedor",
    ayuda: "No lo encontraste en el punto." },
];

export const tipoIncidente = (id) => TIPOS_INCIDENTE.find((t) => t.id === id) || null;
export const esDeContenedor = (id) => tipoIncidente(id)?.grupo === "contenedor";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Un id que no tiene forma de uuid se trata como "no vino", no como error. */
const uuidONulo = (v) => (typeof v === "string" && UUID.test(v.trim()) ? v.trim().toLowerCase() : null);

const texto = (v) => String(v ?? "").trim();

/**
 * Valida el "No procedió". El motivo tiene que ser uno de la lista (con
 * texto libre no se puede contar), y con "Otro" el detalle es obligatorio:
 * "Otro" a secas no le sirve a nadie para contestarle al cliente.
 */
export function validarNoProcedio({ motivo, detalle } = {}) {
  const m = texto(motivo);
  const d = texto(detalle);
  if (!m) return { ok: false, campo: "motivo", mensaje: "Elige el motivo." };
  if (!MOTIVOS_NO_PROCEDIO.includes(m)) {
    return { ok: false, campo: "motivo", mensaje: "Ese motivo no está en la lista." };
  }
  if (m === "Otro" && d.length < 5) {
    return { ok: false, campo: "detalle", mensaje: "Con «Otro», escribe qué pasó." };
  }
  if (d.length > LIMITES_REPORTE.detalle) {
    return { ok: false, campo: "detalle", mensaje: `El detalle es muy largo (máximo ${LIMITES_REPORTE.detalle} letras).` };
  }
  return { ok: true, datos: { motivo_no_procedio: m, detalle_no_procedio: d || null } };
}

/**
 * La lectura de GPS tal como se guarda, o null. Se rearma campo por campo
 * para que no se cuele nada más dentro del jsonb.
 */
export function limpiarUbicacion(u) {
  if (!u || typeof u !== "object") return null;
  const lat = Number(u.lat);
  const lng = Number(u.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const precision = Number(u.precision_m);
  const capturada = typeof u.capturada === "string" && !Number.isNaN(Date.parse(u.capturada))
    ? new Date(u.capturada).toISOString()
    : null;
  return {
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
    precision_m: Number.isFinite(precision) && precision >= 0 ? Math.round(precision) : null,
    capturada,
  };
}

/**
 * Valida un reporte de incidente y lo deja listo para la tabla.
 *   · Retraso pide los minutos: "voy tarde" sin cuánto no le deja a la
 *     oficina decidir si avisa al cliente.
 *   · "Otra cosa" pide descripción: sin ella el aviso llega vacío.
 *   · El contenedor solo se guarda en los tipos de contenedor.
 */
export function validarReporte({ tipo, descripcion, retrasoMin, solicitudId, contenedorId, ubicacion } = {}) {
  const t = tipoIncidente(texto(tipo));
  if (!t) return { ok: false, campo: "tipo", mensaje: "Elige qué pasó." };

  const desc = texto(descripcion);
  if (desc.length > LIMITES_REPORTE.descripcion) {
    return { ok: false, campo: "descripcion", mensaje: `La descripción es muy larga (máximo ${LIMITES_REPORTE.descripcion} letras).` };
  }
  if (t.id === "otro" && desc.length < 5) {
    return { ok: false, campo: "descripcion", mensaje: "Escribe qué pasó." };
  }

  let minutos = null;
  if (t.id === "retraso") {
    const n = Number(retrasoMin);
    if (retrasoMin === "" || retrasoMin == null || !Number.isInteger(n) || n < 1 || n > 1440) {
      return { ok: false, campo: "retrasoMin", mensaje: "Escribe cuántos minutos de retraso, más o menos." };
    }
    minutos = n;
  }

  return {
    ok: true,
    datos: {
      tipo: t.id,
      descripcion: desc || null,
      retraso_min: minutos,
      solicitud_id: uuidONulo(solicitudId),
      contenedor_id: t.grupo === "contenedor" ? uuidONulo(contenedorId) : null,
      ubicacion: limpiarUbicacion(ubicacion),
    },
  };
}

/** "45 min" o "1 h 30 min": como lo diría alguien por teléfono. */
export function textoMinutos(min) {
  const n = Number(min);
  if (!Number.isFinite(n) || n <= 0) return "";
  const h = Math.floor(n / 60);
  const m = n % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}
