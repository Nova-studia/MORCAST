/**
 * LAS REGLAS DE "TRABAJA CON NOSOTROS", SUELTAS Y COMPROBABLES.
 *
 * Este archivo NO importa React ni Supabase a propósito: las pruebas del
 * proyecto (`npm test`) corren con `node --test` y sólo pueden importar
 * módulos así. Si una regla vive dentro de una pantalla, nadie la prueba.
 *
 * Lo usan los dos lados: la acción de servidor que recibe la solicitud y el
 * formulario del navegador, que valida lo mismo para ser amable. Quien manda
 * es el servidor; el navegador sólo se adelanta.
 */

export const LIMITES = {
  nombre: 120,
  telefono: 30,
  correo: 160,
  puesto: 120,
  experiencia: 2000,
};

/** Lo que se acepta como currículum. */
export const TIPOS_CV = ["application/pdf", "image/jpeg", "image/png"];
export const MAX_CV_BYTES = 5 * 1024 * 1024;

/** Cuánto se guarda una solicitud. Lo promete el Aviso de Privacidad. */
export const MESES_QUE_SE_GUARDA = 12;

/**
 * Cuántas puede mandar el mismo teléfono en 24 horas.
 *
 * ⚠️ Este número está escrito DOS veces: aquí y en la función
 * `puede_solicitar_empleo` de `db/021`. Manda **el SQL**, porque es donde la
 * decisión es atómica; éste sirve sólo para redactar el mensaje. Si se cambia
 * uno, se cambia el otro.
 */
export const TOPE_POR_DIA = 3;

export const ESTADOS_SOLICITUD = ["nueva", "revisada", "contactada", "descartada"];
export const AREAS = ["operacion", "oficina"];
export const TIPOS_VACANTE = ["tiempo-completo", "medio-tiempo", "temporal"];

/** Recorta al límite en vez de reventar. Igual que en `acciones-alta.js`. */
export const texto = (v, max) => String(v ?? "").trim().slice(0, max);

/**
 * Folio de la solicitud: `EMP-2026-8F3K`.
 *
 * Sufijo al azar y NO un consecutivo, calcado de `solicitudes_alta`. Un
 * consecutivo obligaría a leer la tabla antes de escribir —o a un disparador
 * con candado— para resolver una carrera que así ni siquiera existe. Se lee
 * igual por teléfono.
 */
export function folioEmpleo(fecha = new Date()) {
  const azar = Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, "X");
  return `EMP-${fecha.getFullYear()}-${azar}`;
}

/** Sólo dígitos: "868 111 2233" y "(868) 111-2233" son la misma persona. */
const soloDigitos = (v) => String(v ?? "").replace(/\D/g, "");

export function validarSolicitud(entrada) {
  const nombre = texto(entrada?.nombre, LIMITES.nombre);
  const telefono = soloDigitos(entrada?.telefono).slice(0, LIMITES.telefono);
  const correo = texto(entrada?.correo, LIMITES.correo);
  const puesto = texto(entrada?.puesto, LIMITES.puesto);
  const experiencia = texto(entrada?.experiencia, LIMITES.experiencia);

  if (!nombre) return { ok: false, motivo: "Falta tu nombre." };
  if (telefono.length < 10) {
    return { ok: false, motivo: "El teléfono debe tener 10 dígitos." };
  }
  if (!puesto) return { ok: false, motivo: "Dinos qué puesto buscas." };
  if (!experiencia) {
    return { ok: false, motivo: "Cuéntanos dónde has trabajado." };
  }
  // El correo es opcional a propósito: el chofer o el ayudante muchas veces
  // no usa correo, y exigirlo lo dejaría fuera. Pero si lo escribe, que sirva.
  if (correo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) {
    return { ok: false, motivo: "El correo no parece válido." };
  }
  if (!entrada?.aviso) {
    return { ok: false, motivo: "Hay que aceptar el Aviso de Privacidad." };
  }

  return {
    ok: true,
    limpia: { nombre, telefono, correo, puesto, experiencia },
  };
}

/** Sin archivo también vale: el currículum es opcional. */
export function validarArchivo(archivo) {
  if (!archivo) return { ok: true };
  if (!TIPOS_CV.includes(archivo.type)) {
    return { ok: false, motivo: "El currículum debe ser PDF, JPG o PNG." };
  }
  if (Number(archivo.size) > MAX_CV_BYTES) {
    return { ok: false, motivo: "El currículum no puede pasar de 5 MB." };
  }
  return { ok: true };
}

/**
 * Desde qué fecha para atrás se borra.
 *
 * `setMonth` se pasa de mes cuando el día no existe en el mes destino (el 29
 * de febrero restándole 12 meses caería en el 1 de marzo). Se corrige hacia
 * ATRÁS: borrar un día después de tiempo es legal, borrar un día antes no.
 */
export function fechaDeCorte(hoy = new Date(), meses = MESES_QUE_SE_GUARDA) {
  const dia = hoy.getUTCDate();
  const corte = new Date(hoy);
  corte.setUTCMonth(corte.getUTCMonth() - meses);
  if (corte.getUTCDate() !== dia) corte.setUTCDate(0);
  return corte;
}

/**
 * Cómo se llama la vacante de una solicitud, en pantalla.
 *
 * La mayoría de las solicitudes van SIN vacante (son generales), así que este
 * caso NO es raro: es el normal. Escribirlo suelto en la pantalla imprimiría
 * la palabra "undefined" en vivo — que es exactamente lo que le pasó a
 * /admin/recolecciones y se arregló el 2-sep-2026.
 */
export function nombreDeVacante(vacante) {
  return vacante?.puesto || "Solicitud general";
}

/** Etiquetas legibles de área y tipo. */
const NOMBRE_AREA = { operacion: "Operación", oficina: "Oficina" };
const NOMBRE_TIPO = {
  "tiempo-completo": "Tiempo completo",
  "medio-tiempo": "Medio tiempo",
  temporal: "Temporal",
};

/**
 * "Operación · Tiempo completo".
 *
 * Las piezas vacías se caen ANTES de unirlas. Escrito a mano con el "·" en
 * medio, una vacante sin tipo saldría como "Operación ·", con el separador
 * colgando de la nada.
 */
export function fichaDeVacante(vacante) {
  return [NOMBRE_AREA[vacante?.area], NOMBRE_TIPO[vacante?.tipo]]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Una vacante con candidatos NO se borra, se cierra. Si se borrara, sus
 * solicitudes quedarían apuntando al vacío y se perdería a qué aplicó cada
 * quien.
 */
export function puedeBorrarseVacante(numeroDeSolicitudes) {
  const n = Number(numeroDeSolicitudes) || 0;
  if (n > 0) {
    return {
      ok: false,
      motivo: `Esta vacante tiene ${n} candidato${n === 1 ? "" : "s"}. Ciérrala en vez de borrarla, para no perder a quién aplicó.`,
    };
  }
  return { ok: true };
}
