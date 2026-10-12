/**
 * PERSONAL Y GAFETES — las reglas (sin React ni Supabase).
 *
 * El directorio de empleados de Morcast y lo que enseña su gafete en
 * `morcast.mx/g/<código>`, en tres niveles:
 *   1. Verificación, pública: VIGENTE o NO VÁLIDO, foto, nombre, puesto.
 *   2. Emergencia, con el PIN impreso atrás: sangre, alergias, a quién llamar.
 *   3. Expediente: solo en el panel, con la sección Personal.
 * Diseño: docs/superpowers/specs/2026-10-09-gafetes-personal-design.md.
 *
 * Aquí se decide QUÉ campos salen en cada nivel, en un solo lugar: la página
 * pública arma su respuesta con `fichaPublica` y `fichaEmergencia`, nunca
 * con el renglón entero del empleado.
 *
 * Va en .mjs y sin dependencias para que `node --test` lo importe directo
 * (tests/personal.test.mjs).
 */

export const TIPOS_EMPLEADO = [
  { id: "administrativo", texto: "Administrativo" },
  { id: "general", texto: "Personal general" },
];

export const TIPOS_SANGRE = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];

/** Topes de cada campo: lo que cabe en la tarjeta y en la pantalla. */
export const TOPES = {
  numero: 12,
  nombre: 60,
  apellido: 40,
  puesto: 60,
  area: 60,
  alergias: 200,
  contacto: 120,
  motivo: 200,
};

const sinAcentos = (texto) => String(texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "");
const limpio = (texto) => String(texto ?? "").replace(/\s+/g, " ").trim();

/** Para comparar nombres sin que estorben acentos, mayúsculas ni espacios. */
export function claveDeNombre(texto) {
  return sinAcentos(limpio(texto)).toLowerCase();
}

/** "Juan Carlos Pérez López". */
export function nombreCompleto(e) {
  return [e?.nombre, e?.apellido_paterno, e?.apellido_materno].map(limpio).filter(Boolean).join(" ");
}

/** Los dos renglones del gafete: nombres arriba, apellidos abajo. */
export function nombreEnDosLineas(e) {
  return [limpio(e?.nombre), [e?.apellido_paterno, e?.apellido_materno].map(limpio).filter(Boolean).join(" ")];
}

/**
 * "o positivo", "O +", "ORH+", "a neg" → "O+", "O+", "O+", "A-". Lo que no se
 * entiende da null: un tipo de sangre no se adivina.
 */
export function normalizarSangre(texto) {
  const t = sinAcentos(String(texto ?? "")).toUpperCase().replace(/\s+/g, "");
  if (!t) return null;
  const m = t.match(/^(AB|A|B|O|0)(?:RH)?(\+|-|POSITIVO|POS|NEGATIVO|NEG)$/);
  if (!m) return null;
  const grupo = m[1] === "0" ? "O" : m[1];
  return `${grupo}${m[2] === "+" || m[2].startsWith("POS") ? "+" : "-"}`;
}

/**
 * Un teléfono, como se guarda: diez dígitos si es de México ("8681234567"),
 * o "+1" y diez dígitos si es de Estados Unidos ("+19561234567"). null si no
 * se entiende.
 *
 * Matamoros es frontera: el contacto de emergencia de más de uno vive en
 * Brownsville. Diez dígitos a secas se toman como de México; el de Estados
 * Unidos hay que escribirlo con su +1 (o 1 por delante), porque por la lada
 * sola no se puede saber de qué lado es.
 */
export function normalizarTelefono(texto) {
  const crudo = String(texto ?? "");
  const d = crudo.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) return `+1${d.slice(1)}`;
  if (d.length === 12 && d.startsWith("52")) return d.slice(2);
  if (d.length === 13 && d.startsWith("521")) return d.slice(3);
  return d.length === 10 && !crudo.trim().startsWith("+") ? d : null;
}

/** "8681234567" → "868 123 4567"; "+19561234567" → "+1 956 123 4567". */
export function telefonoLegible(texto) {
  const t = normalizarTelefono(texto);
  if (!t) return limpio(texto);
  const d = t.slice(-10);
  return `${t.startsWith("+1") ? "+1 " : ""}${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

/** El enlace para marcarlo con un toque, con la lada del país que le toca. */
export function enlaceDeTelefono(texto) {
  const t = normalizarTelefono(texto);
  if (!t) return null;
  return `tel:${t.startsWith("+") ? t : `+52${t}`}`;
}

/** "sí", "si", "x", "1", true → true. Lo demás, false: el permiso no se supone. */
export function esSi(valor) {
  if (valor === true) return true;
  return ["si", "s", "x", "1", "true", "firmo", "firmado"].includes(sinAcentos(limpio(valor)).toLowerCase());
}

/**
 * Limpia y valida un empleado antes de guardarlo. Devuelve `{ ok, datos }` o
 * `{ ok: false, errores }` con un texto por campo.
 *
 * El número de empleado puede venir vacío: se le pone el siguiente
 * (`siguienteNumero`); uno de puros dígitos se completa a cuatro cifras
 * ("24" → "0024") para que no convivan los dos. El puesto puede faltar (la
 * lista avisa: `faltantes`), porque así llegan renglones del Excel de la
 * empresa. Los datos de emergencia son opcionales, pero el permiso NO se
 * puede marcar sin tener a quién llamar: una ficha de emergencia vacía no le
 * sirve a nadie.
 */
export function validarEmpleado(entrada = {}) {
  const errores = {};
  const datos = {
    numero: normalizarNumero(entrada.numero),
    nombre: limpio(entrada.nombre),
    apellido_paterno: limpio(entrada.apellido_paterno),
    apellido_materno: limpio(entrada.apellido_materno),
    puesto: limpio(entrada.puesto),
    area: limpio(entrada.area),
    tipo: entrada.tipo === "administrativo" ? "administrativo" : "general",
    reporta_a: entrada.reporta_a || null,
    tipo_sangre: null,
    alergias: limpio(entrada.alergias) || null,
    contacto_emergencia: limpio(entrada.contacto_emergencia) || null,
    telefono_emergencia: null,
    permiso_emergencia: esSi(entrada.permiso_emergencia),
  };

  if (datos.numero && !/^[A-Z0-9-]+$/.test(datos.numero)) errores.numero = "Solo letras, números y guiones.";
  else if (datos.numero.length > TOPES.numero) errores.numero = `Máximo ${TOPES.numero} caracteres.`;

  if (!datos.nombre) errores.nombre = "Escribe el nombre.";
  else if (datos.nombre.length > TOPES.nombre) errores.nombre = `Máximo ${TOPES.nombre} caracteres.`;
  if (!datos.apellido_paterno) errores.apellido_paterno = "Escribe el apellido paterno.";
  for (const campo of ["apellido_paterno", "apellido_materno"]) {
    if (datos[campo].length > TOPES.apellido) errores[campo] = `Máximo ${TOPES.apellido} caracteres.`;
  }
  if (datos.puesto.length > TOPES.puesto) errores.puesto = `Máximo ${TOPES.puesto} caracteres.`;
  if (datos.area.length > TOPES.area) errores.area = `Máximo ${TOPES.area} caracteres.`;

  if (limpio(entrada.tipo_sangre)) {
    datos.tipo_sangre = normalizarSangre(entrada.tipo_sangre);
    if (!datos.tipo_sangre) errores.tipo_sangre = "No se entiende. Usa O+, O-, A+, A-, B+, B-, AB+ o AB-.";
  }
  if (limpio(entrada.telefono_emergencia)) {
    datos.telefono_emergencia = normalizarTelefono(entrada.telefono_emergencia);
    if (!datos.telefono_emergencia) errores.telefono_emergencia = "Deben ser 10 dígitos (si es de Estados Unidos, con +1 por delante).";
  }
  if ((datos.alergias || "").length > TOPES.alergias) errores.alergias = `Máximo ${TOPES.alergias} caracteres.`;
  if ((datos.contacto_emergencia || "").length > TOPES.contacto) {
    errores.contacto_emergencia = `Máximo ${TOPES.contacto} caracteres.`;
  }
  if (datos.permiso_emergencia && !datos.telefono_emergencia && !errores.telefono_emergencia) {
    errores.permiso_emergencia = "Para enseñar la ficha de emergencia hace falta al menos el teléfono de emergencia.";
  }
  if (datos.reporta_a && datos.reporta_a === entrada.id) errores.reporta_a = "No puede reportarse a sí mismo.";

  return Object.keys(errores).length ? { ok: false, errores } : { ok: true, datos };
}

/** El número de empleado como se guarda: en mayúsculas y, si es de puros dígitos, con cuatro cifras. */
export function normalizarNumero(texto) {
  const n = limpio(texto).toUpperCase();
  return /^\d{1,3}$/.test(n) ? n.padStart(4, "0") : n;
}

/**
 * El número que sigue: el más alto de los que son solo dígitos, más uno, con
 * cuatro cifras ("0024"). Los números con letras de la empresa no cuentan.
 */
export function siguienteNumero(existentes = []) {
  const mayor = existentes
    .map((n) => String(n ?? ""))
    .filter((n) => /^\d+$/.test(n))
    .reduce((m, n) => Math.max(m, Number(n)), 0);
  return String(mayor + 1).padStart(4, "0");
}

/* ------------------------------------------------------------------ */
/* Lo que enseña la página pública                                     */
/* ------------------------------------------------------------------ */

/**
 * ¿Qué dice el sello? "vigente" solo si el gafete es el vigente Y la persona
 * sigue activa. Un código que no existe, un gafete repuesto o anulado y un
 * empleado de baja dan lo mismo: "no-valido".
 */
export function estadoPublico({ gafete, empleado } = {}) {
  return gafete?.estado === "vigente" && empleado?.estado === "activo" ? "vigente" : "no-valido";
}

/**
 * NIVEL 1 — lo que ve cualquiera. Si no es vigente NO sale nada de la
 * persona: quien encuentre un gafete viejo no aprende de quién era.
 */
export function fichaPublica({ gafete, empleado } = {}) {
  const estado = estadoPublico({ gafete, empleado });
  if (estado !== "vigente") return { estado };
  return {
    estado,
    nombre: nombreCompleto(empleado),
    puesto: limpio(empleado.puesto),
    area: limpio(empleado.area),
    numero: limpio(empleado.numero),
    hayFoto: Boolean(empleado.foto_ruta),
    hayEmergencia: tieneEmergencia(empleado),
  };
}

/** ¿Hay ficha de emergencia que enseñar? Solo con permiso firmado y un teléfono. */
export function tieneEmergencia(empleado) {
  return Boolean(empleado?.permiso_emergencia && empleado?.telefono_emergencia);
}

/**
 * NIVEL 2 — lo que se enseña con el PIN correcto. null si el gafete no es
 * vigente o la persona no firmó el permiso.
 */
export function fichaEmergencia({ gafete, empleado } = {}) {
  if (estadoPublico({ gafete, empleado }) !== "vigente" || !tieneEmergencia(empleado)) return null;
  return {
    nombre: nombreCompleto(empleado),
    tipo_sangre: empleado.tipo_sangre || null,
    alergias: limpio(empleado.alergias) || null,
    contacto: limpio(empleado.contacto_emergencia) || null,
    telefono: normalizarTelefono(empleado.telefono_emergencia),
  };
}

/** "10/2026", como va impresa la emisión en la vuelta del gafete. */
export function emisionLegible(fecha) {
  const f = new Date(fecha);
  if (Number.isNaN(f.getTime())) return "";
  // Matamoros va en -05/-06: con UTC, un gafete emitido la noche del 31
  // saldría con el mes siguiente.
  const partes = new Intl.DateTimeFormat("es-MX", { timeZone: "America/Matamoros", month: "2-digit", year: "numeric" })
    .formatToParts(f);
  const de = (tipo) => partes.find((p) => p.type === tipo)?.value;
  return `${de("month")}/${de("year")}`;
}

/* ------------------------------------------------------------------ */
/* El panel                                                            */
/* ------------------------------------------------------------------ */

/** Qué le falta a un empleado para que su gafete se pueda mandar a imprimir. */
export function faltantes(empleado) {
  const falta = [];
  if (!empleado?.foto_ruta) falta.push("foto");
  if (!limpio(empleado?.puesto)) falta.push("puesto");
  return falta;
}

/**
 * En qué va el gafete de un empleado de la lista (`e.gafete` es el vigente):
 * "baja" · "sin-gafete" · "sin-imprimir" · "chip-pendiente" · "listo".
 * Si el chip ya se grabó es que la tarjeta existe, aunque nadie haya marcado
 * que se mandó a la imprenta.
 */
export function pasoDelGafete(e) {
  if (e?.estado !== "activo") return "baja";
  if (!e.gafete) return "sin-gafete";
  if (e.gafete.chip_grabado_en) return "listo";
  return e.gafete.impreso_en ? "chip-pendiente" : "sin-imprimir";
}

/**
 * La lista del panel, filtrada. `texto` busca en nombre, puesto, área,
 * número y código del gafete; `sinImprimir` deja los que tienen un gafete
 * vigente que todavía no se manda a la imprenta, y `chip` los que ya se
 * mandaron pero siguen con el chip sin grabar.
 */
export function filtrarPersonal(lista, { texto = "", tipo = "", estado = "", chip = false, sinImprimir = false } = {}) {
  const busca = claveDeNombre(texto);
  return (lista || []).filter((e) => {
    if (tipo && e.tipo !== tipo) return false;
    if (estado && e.estado !== estado) return false;
    if (sinImprimir && pasoDelGafete(e) !== "sin-imprimir") return false;
    if (chip && pasoDelGafete(e) !== "chip-pendiente") return false;
    if (!busca) return true;
    const pajar = claveDeNombre([nombreCompleto(e), e.puesto, e.area, e.numero, e.gafete?.codigo].join(" "));
    return busca.split(" ").every((palabra) => pajar.includes(palabra));
  });
}

/**
 * El organigrama: los administrativos activos, en árbol por "Reporta a".
 * Quien reporta a alguien que no está en la lista (de baja, o personal
 * general) queda arriba, como raíz. Un ciclo (A reporta a B y B a A) no
 * cuelga el dibujo: los que están en el ciclo se ponen como raíces.
 */
export function armarOrganigrama(empleados) {
  const gente = (empleados || []).filter((e) => e.tipo === "administrativo" && e.estado === "activo");
  const porId = new Map(gente.map((e) => [e.id, { ...e, subordinados: [] }]));

  // ¿Siguiendo los jefes desde `id` se vuelve a `id`?
  const enCiclo = (id) => {
    const visto = new Set();
    let actual = porId.get(id)?.reporta_a;
    while (actual && porId.has(actual) && !visto.has(actual)) {
      if (actual === id) return true;
      visto.add(actual);
      actual = porId.get(actual).reporta_a;
    }
    return false;
  };

  const raices = [];
  for (const nodo of porId.values()) {
    const jefe = nodo.reporta_a && porId.get(nodo.reporta_a);
    if (jefe && !enCiclo(nodo.id)) jefe.subordinados.push(nodo);
    else raices.push(nodo);
  }
  const ordenar = (lista) => {
    lista.sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b), "es"));
    lista.forEach((n) => ordenar(n.subordinados));
    return lista;
  };
  return ordenar(raices);
}
