/**
 * CUENTAS Y CATÁLOGO DE LA ADMINISTRACIÓN EN LA APP — la lógica pura
 * (6-oct-2026, paridad de la app 1.1 con el panel web).
 *
 * Altas de clientes, Clientes, Usuarios y roles, Puntos, Zonas pedidas y
 * Unidades. Aquí sólo lo que no necesita red ni React, para probarlo con
 * `node --test`: las listas de estados, quién puede recibir acceso, quién
 * puede invitar a quién, de dónde salió el pin de un punto y cómo se filtra.
 *
 * 🔴 SON ESPEJOS de la web (`Web/lib/admin-app.mjs`, `estado-cliente.mjs`,
 * `equipo.mjs`, `sectores.mjs`, `unidades.mjs`). Las reglas de verdad las
 * aplica el SERVIDOR (`/api/app/...`); éstas sólo deciden qué botón se
 * pinta y con qué texto, para no ofrecer algo que el servidor va a rechazar.
 * `tests/cuentas-admin.test.mjs` compara cada una contra la de la web: si
 * alguien cambia allá, la prueba truena y avisa que falta copiarlo aquí (y
 * en la otra app, donde este archivo es idéntico).
 */

/* ----------------------------- Estados ----------------------------- */

/** Estados de una solicitud de alta. Las clases son las de `BADGE` (tema.js). */
export const ESTADOS_ALTA = [
  { id: "nueva", texto: "Nueva", clase: "" },
  { id: "contactada", texto: "Contactada", clase: "prog" },
  { id: "aprobada", texto: "Aprobada", clase: "ok" },
  { id: "rechazada", texto: "Rechazada", clase: "mal" },
];

/** Estados de una zona pedida (fuera de cobertura). */
export const ESTADOS_ZONA = [
  { id: "nueva", texto: "Nueva", clase: "prog" },
  { id: "en-evaluacion", texto: "En evaluación", clase: "ruta" },
  { id: "aprobada", texto: "Aprobada", clase: "ok" },
  { id: "descartada", texto: "Descartada", clase: "mal" },
];

/** Estados de una unidad (camión). "alerta" no existe en BADGE: se pinta como `ruta`. */
export const ESTADOS_UNIDAD = [
  { id: "activa", texto: "Activa", clase: "ok" },
  { id: "taller", texto: "En taller", clase: "alerta" },
  { id: "baja", texto: "Baja", clase: "" },
];

/** Los tipos de unidad, para enseñar el nombre y no la clave. */
export const TIPOS_UNIDAD = [
  { id: "manual", nombre: "Manual" },
  { id: "roll-off", nombre: "Roll Off" },
  { id: "compactador", nombre: "Compactador" },
  { id: "camioneta", nombre: "Camioneta" },
  { id: "otro", nombre: "Otro" },
];

export const nombreTipoUnidad = (id) => TIPOS_UNIDAD.find((t) => t.id === id)?.nombre || id || "—";

/** El estado de la lista, o uno de paso con el id tal cual (nunca truena). */
export function estadoDe(lista, id) {
  return lista.find((e) => e.id === id) || { id, texto: id || "—", clase: "" };
}

/** La clase de la web → la de `BADGE` de la app ("" y "alerta" no existen allá). */
export function claseBadge(clase) {
  if (clase === "alerta") return "ruta";
  return clase || "none";
}

/* ----------------------------- Clientes ---------------------------- */

/** Planes del alta de cliente (los mismos tres del panel). */
export const PLANES_CLIENTE = ["Por evento", "Contrato mensual", "Contrato anual"];

/** Rellenos que la gente teclea cuando no tiene el dato ("N-A" en el cuaderno). */
const RELLENOS = new Set([
  "na", "n/a", "n-a", "n.a.", "no", "-", "--", ".", "ninguno", "sin correo", "—", "–",
]);

/** ¿Este campo trae un dato de verdad? */
export function hayDato(valor) {
  const v = String(valor ?? "").trim();
  if (!v) return false;
  return !RELLENOS.has(v.toLowerCase());
}

const CAMPOS_PARA_OPERAR = [
  { campo: "contacto", etiqueta: "persona de contacto" },
  { campo: "telefono", etiqueta: "teléfono" },
  { campo: "correo", etiqueta: "correo" },
];

/** Lo que le falta al cliente para operar (contacto, teléfono, correo). */
export function loQueFalta(cliente) {
  return CAMPOS_PARA_OPERAR.filter(({ campo }) => !hayDato(cliente?.[campo])).map(({ etiqueta }) => etiqueta);
}

/**
 * ¿Se le puede dar acceso al portal? La MISMA regla que el servidor
 * (`puedeRecibirAcceso`): primero "ya tiene acceso", luego "sin correo".
 */
export function puedeRecibirAcceso(cliente) {
  if (cliente?.tieneAcceso) return { puede: false, motivo: "ya-tiene-acceso" };
  if (!hayDato(cliente?.correo)) return { puede: false, motivo: "sin-correo" };
  return { puede: true };
}

/** Por qué no se puede pulsar "Dar acceso", con el texto del panel. */
export const MOTIVO_ACCESO = {
  "ya-tiene-acceso": "Ya tiene acceso",
  "sin-correo": "Sin correo",
};

const CORREO_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const pareceCorreo = (v) => CORREO_RE.test(String(v ?? "").trim());

/**
 * Filtro por sector de la lista de clientes: "" = todos, una clave ("A"…)
 * o "ninguno". Un cliente está en un sector si ALGUNO de sus puntos cae ahí.
 */
export function filtrarClientesPorSector(clientes, filtro) {
  return (clientes || []).filter((c) => {
    const claves = (c.sectores || []).map((s) => s.clave);
    if (filtro === "ninguno") return claves.length === 0;
    return !filtro || claves.includes(filtro);
  });
}

/* ------------------------------ Equipo ----------------------------- */

/** Los roles que se pueden dar al invitar. El dueño no se invita. */
export const ROLES_INVITABLES = {
  admin: "Administrador",
  operador: "Chofer / Operador",
};

export const ROLES_LEGIBLES = {
  dueno: "Dueño",
  admin: "Administrador",
  operador: "Chofer / Operador",
};

const ES_PERSONAL = (rol) => rol === "dueno" || rol === "admin";

/** ¿Puede `quien` dar este rol? Administradores, sólo el dueño (4-oct-2026). */
export function puedeDarRol(quien, rol) {
  if (!ES_PERSONAL(quien?.rol)) return false;
  if (rol === "admin") return quien.rol === "dueno";
  return rol === "operador";
}

/** ¿Puede `quien` desactivar o reactivar a `objetivo`? Mismos motivos que el servidor. */
export function puedeCambiarActivo({ quien, objetivo } = {}) {
  if (!ES_PERSONAL(quien?.rol)) return { puede: false, motivo: "No tienes permiso para cambiar al equipo." };
  if (!objetivo) return { puede: false, motivo: "No se encontró a esa persona." };
  if (objetivo.rol === "dueno") return { puede: false, motivo: "La cuenta del dueño no se puede desactivar." };
  if (objetivo.id === quien.id) return { puede: false, motivo: "No puedes desactivar tu propia cuenta." };
  if (objetivo.rol !== "admin" && objetivo.rol !== "operador") {
    return { puede: false, motivo: "Desde aquí solo se administra al personal de Morcast." };
  }
  if (objetivo.rol === "admin" && quien.rol !== "dueno") {
    return { puede: false, motivo: "Solo el dueño puede desactivar o reactivar a un administrador." };
  }
  return { puede: true };
}

/* ------------------------------ Puntos ----------------------------- */

/** Caja de Matamoros: la MISMA que exige la base (db/023) y el servidor. */
export const LIMITES_MATAMOROS = { latMin: 25.5, latMax: 26.2, lngMin: -98.0, lngMax: -97.0 };

export function dentroDeMatamoros(lat, lng) {
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return false;
  const L = LIMITES_MATAMOROS;
  return la >= L.latMin && la <= L.latMax && ln >= L.lngMin && ln <= L.lngMax;
}

const tienePin = (p) =>
  p != null && p.lat != null && p.lng != null && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng));

/**
 * De dónde salió la ubicación de un punto, en palabras de la oficina.
 * "cliente" = el pin que puso el cliente en su alta: sin origen pero CON
 * fecha. Queda "por revisar" hasta que la oficina lo confirme o lo mueva.
 */
export function estadoUbicacion(punto) {
  if (!tienePin(punto)) return { id: "sin", texto: "Sin ubicación", corto: "Sin ubicación", clase: "mal" };
  if (punto.origen === "chofer") return { id: "chofer", texto: "La puso el chofer", corto: "Del chofer", clase: "ruta" };
  if (!punto.origen && punto.fecha) {
    return { id: "cliente", texto: "La puso el cliente: por revisar", corto: "Por revisar", clase: "prog" };
  }
  return { id: "panel", texto: "La puso la oficina", corto: "De la oficina", clase: "ok" };
}

/** Los filtros de la lista de puntos de la app (los de la web, sin mapa). */
export const FILTROS_PUNTO = [
  { id: "todos", texto: "Todos" },
  { id: "sin", texto: "Sin ubicación" },
  { id: "cliente", texto: "Por revisar" },
  { id: "sin-ruta", texto: "Sin ruta" },
  { id: "chofer", texto: "Del chofer" },
];

/** Minúsculas y sin acentos, para buscar. */
export function normalizar(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Filtra los puntos. `filtro`: uno de FILTROS_PUNTO. `sector`: "" | "ninguno"
 * | id de sector. `texto`: empresa, folio, alias, calle, colonia o CP.
 */
export function filtrarPuntos(puntos, { filtro = "todos", sector = "", texto = "" } = {}) {
  const buscado = normalizar(texto);
  return (puntos || []).filter((p) => {
    if (filtro === "sin-ruta") {
      if (p.ruta?.clave) return false;
    } else if (filtro !== "todos" && estadoUbicacion(p).id !== filtro) {
      return false;
    }
    if (sector === "ninguno" && p.sectorId) return false;
    if (sector && sector !== "ninguno" && p.sectorId !== sector) return false;
    if (buscado) {
      const pajar = normalizar([p.empresa, p.clienteFolio, p.alias, p.calle, p.colonia, p.cp].join(" "));
      if (!pajar.includes(buscado)) return false;
    }
    return true;
  });
}

const CIUDAD = "Matamoros, Tamaulipas";

/** La dirección escrita, completa (como `direccionDe` de Web/lib/mapas.mjs). */
export function direccionPunto(punto) {
  return [punto?.calle, punto?.colonia, punto?.cp ? `C.P. ${punto.cp}` : null, CIUDAD]
    .map((x) => String(x || "").trim())
    .filter(Boolean)
    .join(", ");
}

/**
 * "Ver en Google Maps" (como `enlaceVerEnMapa` de la web): al pin si lo hay;
 * si no, busca la dirección escrita. No necesita llave de API.
 */
export function enlaceVerPunto(punto) {
  const consulta = tienePin(punto) ? `${Number(punto.lat)},${Number(punto.lng)}` : direccionPunto(punto);
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(consulta)}`;
}

/** Más de esto y la lectura del GPS no sirve para fijar la puerta de un punto. */
export const PRECISION_PIN_M = 100;

/**
 * ¿Sirve esta lectura del GPS del teléfono para "Usar mi ubicación actual
 * aquí"? Tiene que caer en Matamoros; si la precisión es peor que 100 m se
 * avisa (bajo techo de lámina el GPS se va lejos).
 */
export function revisarLecturaPin(lectura) {
  if (!lectura || !Number.isFinite(Number(lectura.lat)) || !Number.isFinite(Number(lectura.lng))) {
    return { ok: false, motivo: "El GPS no dio una ubicación. Inténtalo otra vez al aire libre." };
  }
  if (!dentroDeMatamoros(lectura.lat, lectura.lng)) {
    return { ok: false, motivo: "Tu ubicación queda fuera de Matamoros: no se puede usar para este punto." };
  }
  const precision = Number(lectura.precision_m);
  const imprecisa = Number.isFinite(precision) && precision > PRECISION_PIN_M;
  return {
    ok: true,
    pin: [Number(Number(lectura.lat).toFixed(6)), Number(Number(lectura.lng).toFixed(6))],
    imprecisa,
    precision: Number.isFinite(precision) ? Math.round(precision) : null,
  };
}

const DIAS_CORTOS = {
  lunes: "Lun", martes: "Mar", miercoles: "Mié", miércoles: "Mié", jueves: "Jue",
  viernes: "Vie", sabado: "Sáb", sábado: "Sáb", domingo: "Dom",
};

/** "Lun, Jue" a partir de los días de una ruta. */
export const diasDeRuta = (r) => (r?.dias || []).map((d) => DIAS_CORTOS[d] || d).join(", ");

/** Las recolecciones al mes: entero de 1 a 200 (la misma regla del servidor). */
export function revisarServiciosPorMes(valor) {
  const n = Number(valor);
  if (!Number.isInteger(n) || n < 1 || n > 200) {
    return { ok: false, motivo: "Las recolecciones al mes deben ser un número entero de 1 a 200." };
  }
  return { ok: true, n };
}

/* ----------------------------- WhatsApp ---------------------------- */

/**
 * El teléfono en el formato de WhatsApp (10 dígitos, sin el 52/521 de país).
 * El registro acepta de 10 a 15 dígitos "por si traen lada": quien escribió
 * `+52 868 384 9478` terminaba en `52528683849478`, que no lleva a ningún
 * lado — y con la contraseña de una sola vez eso es PERDERLA. `abrirWhatsApp`
 * (whatsapp.js) antepone el 52.
 */
export function telefonoWhatsApp(telefono) {
  let n = String(telefono || "").replace(/\D/g, "");
  if (n.startsWith("521") && n.length >= 13) n = n.slice(3);
  else if (n.startsWith("52") && n.length >= 12) n = n.slice(2);
  return n;
}

/** El mensaje de "Mandar por WhatsApp" al activar una cuenta registrada (el de la web). */
export function mensajeCuentaActivada(correo, password) {
  return (
    "Tu cuenta de Morcast del Norte ya está activa. Entra en morcast.mx/portal/login con tu cuenta " +
    `de Google, o con este correo y contraseña desde la app: ${correo} / ${password}`
  );
}

/** El mensaje de credenciales al activar desde una solicitud de cotización (el de la web). */
/**
 * Cuenta de "Continuar con Apple" activada (8-oct-2026, Apple guía 4): se
 * activó SIN contraseña, así que el WhatsApp solo le dice cómo entrar.
 */
export function mensajeCuentaActivadaApple() {
  return 'Tu cuenta de Morcast del Norte ya está activa. Abre la app y toca "Ya me activaron — revisar" (entras con Apple, sin contraseña).';
}

export function mensajeCredenciales(nombre, correo, password) {
  return (
    `Hola ${nombre}, su cuenta del Portal de Clientes de Morcast del Norte ya está activa.\n\n` +
    `Ingrese en: morcast.mx/portal/login\nCorreo: ${correo}\nContraseña: ${password}\n\nConserve estos datos.`
  );
}
