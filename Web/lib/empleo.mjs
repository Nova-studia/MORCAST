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

/**
 * A qué extensión corresponde cada tipo de `TIPOS_CV`.
 *
 * `acciones-empleo.js` la usa para nombrar el archivo en Storage EN VEZ de
 * tomar la extensión del nombre que mandó el navegador: ese nombre es texto
 * libre que la persona (o un bot) escribe a su antojo, y va derecho a la ruta
 * de un archivo (`${folio}/${Date.now()}.${extension}`) — una extensión con
 * un `/` o `..` metida ahí rompería esa ruta. El tipo (`archivo.type`) ya
 * pasó por `validarArchivo()` antes de llegar aquí, así que sólo puede ser
 * uno de estos tres.
 */
export const EXTENSION_POR_TIPO_CV = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

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

/**
 * Desde cuándo se puede borrar un renglón de `intentos_empleo` (db/021).
 *
 * Esa tabla existe SÓLO para el freno de arriba (`TOPE_POR_DIA`,
 * `puede_solicitar_empleo` en el SQL): un renglón de hace más de 24 horas ya
 * no frena a nadie —la siguiente solicitud de ese teléfono reinicia la
 * ventana igual, la encuentre vieja o no—, así que guardarlo más tiempo no
 * cumple ninguna función. Y sí tiene un costo: es una lista de teléfonos de
 * gente que buscó trabajo, algo que el Aviso de Privacidad ni siquiera
 * contempla para esta tabla (sólo promete 12 meses para `solicitudes_empleo`,
 * que es otra cosa). Por eso la tarea de purga (`purgar-empleo/route.js`)
 * también la limpia, con el mismo corte de 24 horas del freno, no con los 12
 * meses de `MESES_QUE_SE_GUARDA`.
 */
export function corteIntentosEmpleo(ahora = new Date()) {
  return new Date(ahora.getTime() - 24 * 60 * 60 * 1000);
}

export const ESTADOS_SOLICITUD = ["nueva", "revisada", "contactada", "descartada"];
export const AREAS = ["operacion", "oficina"];
export const TIPOS_VACANTE = ["tiempo-completo", "medio-tiempo", "temporal"];

/**
 * Nombre fijo de la casilla trampa (honeypot) del formulario público.
 *
 * Un campo oculto que ninguna persona ve ni llena, pero que un bot que
 * rellena todos los `<input>` sí. Calcado de `sitio_web` en
 * `FormularioCotizacion.js` / `app/actions.js`: mismo nombre, mismo criterio
 * ("si viene lleno, es un bot"). Vive en UN solo lugar para que el formulario
 * y la acción de servidor nunca se desincronicen en el nombre del campo.
 */
export const CAMPO_HONEYPOT = "sitio_web";

/**
 * No es una vacante real —no tiene id—, así que la solicitud que la usa
 * nunca lleva `vacanteId`: es justo la opción que la vuelve general.
 *
 * Vive aquí y no en `FormularioEmpleo.js` porque `nombreDeSolicitud()`
 * también la necesita, para distinguir "de verdad no pidió nada" de "sí
 * pidió un puesto, pero la vacante ya no existe".
 */
export const CUALQUIER_PUESTO = "Cualquier puesto disponible";

/**
 * Topes de lo que Morcast escribe en una vacante.
 *
 * Van aparte de `LIMITES`, que son los del candidato: no es lo mismo el puesto
 * que alguien BUSCA que el titulo de una plaza que se PUBLICA. Y existen
 * porque esto sale en /empleo, que es publico: un texto pegado por error
 * revienta la maqueta de las tarjetas y del desplegable del formulario. La
 * columna es `text` sin tope en la base, asi que sin esto nada lo para.
 */
export const LIMITES_VACANTE = {
  puesto: 120,
  descripcion: 1200,
  requisito: 200,
  requisitos: 12, // cuantos renglones de requisitos, como maximo
};

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

/**
 * Cómo se llama la vacante de una SOLICITUD, en el panel.
 *
 * Distinto de `nombreDeVacante()`: esa función sólo mira la vacante (o su
 * ausencia). Ésta mira también `solicitud.puesto` —el texto que el
 * candidato tenía delante al mandar el formulario, que la acción de servidor
 * SIEMPRE guarda, tenga o no `vacante_id`—: si la vacante se cerró a medio
 * llenado el formulario, `vacante_id` queda `null` pero `puesto` sí quedó
 * escrito. El panel llamaba antes a `nombreDeVacante(vacantePorId.get(...))`
 * a secas, así que ese caso mostraba "Solicitud general" y se perdía a qué
 * plaza quería entrar la persona.
 *
 * "Solicitud general" a secas queda sólo para quien de verdad no pidió
 * nada (mandó el formulario con el centinela `CUALQUIER_PUESTO`).
 */
export function nombreDeSolicitud(solicitud, vacante) {
  if (vacante) return nombreDeVacante(vacante);
  const puesto = solicitud?.puesto;
  if (puesto && puesto !== CUALQUIER_PUESTO) {
    return `Solicitud general · pedía: ${puesto}`;
  }
  return "Solicitud general";
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
 * Recorta y valida lo que Morcast escribe al publicar (o editar) una
 * vacante. Se llama ANTES de escribir, no después: `puesto` y `descripcion`
 * salen tal cual a /empleo, que es pública.
 *
 * Recortar en vez de rechazar sigue el mismo criterio que `texto()` usa para
 * el candidato: un puesto larguísimo pegado por error se acorta, no revienta
 * el guardado. Un puesto vacío sí se rechaza —no hay nada razonable que
 * recortar de la nada.
 */
export function validarVacante(entrada) {
  const puesto = texto(entrada?.puesto, LIMITES_VACANTE.puesto);
  const descripcion = texto(entrada?.descripcion, LIMITES_VACANTE.descripcion);
  // Renglones vacíos (el candado "Enter" de más en el formulario) se caen
  // ANTES de contar el máximo, para no gastar un lugar de los 12 en nada.
  const requisitos = (Array.isArray(entrada?.requisitos) ? entrada.requisitos : [])
    .map((r) => texto(r, LIMITES_VACANTE.requisito))
    .filter(Boolean)
    .slice(0, LIMITES_VACANTE.requisitos);

  if (!puesto) return { ok: false, motivo: "Falta el puesto." };

  return {
    ok: true,
    limpia: { puesto, area: entrada?.area, tipo: entrada?.tipo, descripcion, requisitos },
  };
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
