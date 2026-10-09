/**
 * LA BITÁCORA EN LA APP DE ADMINISTRACIÓN — lógica pura (sin React ni red).
 *
 * ESPEJO de la web, para que el teléfono diga exactamente lo mismo que
 * morcast.mx/admin/bitacora:
 *   · el día de Matamoros y su rango de instantes → Web/lib/bitacora-vista.mjs
 *   · cómo se lee cada acción y tabla             → Web/lib/bitacora.js
 * Las pruebas (tests/) comparan esta copia contra la web cuando la carpeta
 * Web está al lado. Al cambiar allá, copiar aquí (y en la otra app).
 */

export const ZONA_OFICINA = "America/Matamoros";

const FECHA_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** ¿"2026-10-06" es una fecha de calendario de verdad? */
export function fechaValida(texto) {
  const m = FECHA_RE.exec(String(texto ?? ""));
  if (!m) return false;
  const [a, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const f = new Date(Date.UTC(a, mes - 1, d));
  return f.getUTCFullYear() === a && f.getUTCMonth() === mes - 1 && f.getUTCDate() === d;
}

/** Fecha de calendario de un instante, vista desde Matamoros ("2026-10-06"). */
export function diaEnMatamoros(instante = new Date()) {
  const d = instante instanceof Date ? instante : new Date(instante);
  if (Number.isNaN(d.getTime())) return "";
  try {
    // en-CA formatea como AAAA-MM-DD. Un motor que no lo conozca devuelve
    // "10/6/2026": entonces se usa la fecha local, como sin zonas horarias.
    const f = new Intl.DateTimeFormat("en-CA", {
      timeZone: ZONA_OFICINA, year: "numeric", month: "2-digit", day: "2-digit",
    }).format(d);
    if (FECHA_RE.test(f)) return f;
  } catch {
    /* sin datos de zona horaria: abajo */
  }
  // La fecha local (quien usa la app está en Matamoros).
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Suma (o resta) días a una fecha de calendario. Sin zonas: aritmética de calendario. */
export function moverDia(fecha, dias) {
  const m = FECHA_RE.exec(String(fecha ?? ""));
  if (!m) return "";
  const f = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + Number(dias || 0)));
  return f.toISOString().slice(0, 10);
}

/**
 * Minutos que Matamoros va DETRÁS de UTC en ese instante (360 en invierno,
 * 300 en horario de verano). null si el motor no sabe de zonas horarias.
 */
function desfaseMin(instanteMs) {
  try {
    const partes = new Intl.DateTimeFormat("en-US", {
      timeZone: ZONA_OFICINA, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(new Date(instanteMs));
    const v = Object.fromEntries(partes.map((p) => [p.type, p.value]));
    const comoUtc = Date.UTC(Number(v.year), Number(v.month) - 1, Number(v.day), Number(v.hour) % 24, Number(v.minute), Number(v.second));
    return Math.round((instanteMs - comoUtc) / 60000);
  } catch {
    return null;
  }
}

/** El instante (ms) de la medianoche de Matamoros que abre ese día. */
function medianoche(fecha) {
  const m = FECHA_RE.exec(fecha);
  const comoUtc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d1 = desfaseMin(comoUtc);
  if (d1 === null) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
  // Dos pasadas: el desfase de la medianoche puede no ser el de la hora UTC
  // con que se adivinó (el cambio de horario cae de madrugada).
  const intento = comoUtc + d1 * 60000;
  const d2 = desfaseMin(intento);
  return comoUtc + (d2 ?? d1) * 60000;
}

/**
 * El rango de instantes de un día de Matamoros, para la consulta:
 * `creado >= desde` y `creado < hasta`. null si la fecha no es válida.
 *
 * @param {string} fecha "2026-10-06"
 * @returns {{ desde: string, hasta: string } | null}  ISO en UTC
 */
export function rangoDelDia(fecha) {
  if (!fechaValida(fecha)) return null;
  return {
    desde: new Date(medianoche(fecha)).toISOString(),
    hasta: new Date(medianoche(moverDia(fecha, 1))).toISOString(),
  };
}

/** "Hoy", "Ayer" o la fecha escrita ("lun 5 oct 2026"), para el encabezado. */
export function nombreDelDia(fecha, hoy = diaEnMatamoros()) {
  if (fecha === hoy) return "Hoy";
  if (fecha === moverDia(hoy, -1)) return "Ayer";
  const m = FECHA_RE.exec(String(fecha ?? ""));
  if (!m) return "";
  const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const f = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return `${DIAS[f.getUTCDay()]} ${f.getUTCDate()} ${MESES[f.getUTCMonth()]} ${f.getUTCFullYear()}`;
}

/**
 * El día que se pide, ya decidido: el de la dirección si es válido y no es
 * futuro; si no, hoy. Un día futuro siempre estaría vacío.
 */
export function diaPedido(texto, hoy = diaEnMatamoros()) {
  const t = String(texto ?? "").trim();
  if (!fechaValida(t) || t > hoy) return hoy;
  return t;
}

/**
 * Lo que hace falta saber de un movimiento, sin volcarle el JSON encima.
 * (Vivía dentro de /admin/bitacora; aquí para que la app diga lo mismo.)
 */
export function resumenBitacora(fila) {
  const d = fila?.detalle || {};
  const partes = [];
  if (d.folio) partes.push(d.folio);
  if (d.monto != null) {
    partes.push(new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(d.monto));
  }
  if (d.nombre) partes.push(d.nombre);
  if (d.titulo) partes.push(`«${d.titulo}»`);
  if (d.rol_nuevo) partes.push(`rol: ${d.rol_nuevo}`);
  if (d.estado) partes.push(d.estado);
  if (d.notas) partes.push(`«${d.notas}»`);
  // Las filas que anota la base (db/022) traen qué columnas cambiaron.
  if (d.cambios) partes.push(`cambió: ${Object.keys(d.cambios).join(", ")}`);
  // Lo que se hizo desde el teléfono lo dice (anotarBitacora pone `origen`).
  if (d.origen === "app") partes.push("desde la app");
  return partes.join(" · ") || "—";
}

/* ------------------------------------------------------------------ */
/* Cómo se lee cada acción (copia de Web/lib/bitacora.js)              */
/* ------------------------------------------------------------------ */

/**
 * La bitácora la lee alguien de administración, no un programador:
 * `aplicar_saldo` no sirve.
 */
export const TEXTO_ACCION = {
  // Entrega 4 (9-oct-2026): portal del cliente.
  cliente_edita_contacto: "El cliente cambió sus datos de contacto",
  cliente_cancela_recoleccion: "El cliente canceló una recolección",
  cliente_reagenda_recoleccion: "El cliente cambió la fecha de una recolección",
  // Entrega 3 (9-oct-2026): operación.
  crear_recoleccion_oficina: "Creó una recolección desde la oficina",
  // Entrega 2 (9-oct-2026): roles y cuentas del equipo.
  rol_creado: "Creó un rol",
  rol_cambiado: "Cambió un rol",
  rol_borrado: "Borró un rol",
  editar_usuario: "Editó una cuenta del equipo",
  enlace_contrasena_equipo: "Mandó un enlace de contraseña",
  eliminar_usuario: "Eliminó una cuenta del equipo",
  mi_cuenta: "Cambió sus datos",
  mi_contrasena: "Cambió su contraseña",
  // Entrega 1 (8-oct-2026): clientes.
  cliente_suspendido: "Suspendió a un cliente",
  cliente_baja: "Dio de baja a un cliente",
  cliente_activo: "Reactivó a un cliente",
  cliente_editado: "Editó los datos de un cliente",
  cliente_eliminado: "Eliminó definitivamente a un cliente",
  reenviar_acceso: "Reenvió el acceso de un usuario de cliente",
  punto_agregado: "Agregó un punto de recolección",
  punto_cancelado: "Canceló un punto de recolección",
  punto_eliminado: "Quitó un punto de recolección",
  servicio_cambiado: "Cambió un servicio de un punto",
  aplicar_saldo: "Aplicó un depósito al saldo",
  rechazar_saldo: "Rechazó un depósito",
  confirmar_recoleccion: "Confirmó una recolección",
  rechazar_recoleccion: "Rechazó una recolección",
  // equipo 1 (6-oct-2026): ya se anotaban y salían con su clave cruda.
  reagendar_recoleccion_vencida: "Reagendó una recolección que se pasó de fecha",
  cambiar_recoleccion_confirmada: "Cambió el día, la hora o el chofer de una recolección",
  aviso_oficina_solicitud: "Pidió una recolección (se avisó a la oficina)",
  cerrar_recoleccion: "Cerró una recolección con evidencia",
  cambiar_rol: "Cambió el rol de un usuario",
  alta_cliente: "Dio de alta un cliente",
  invitar_cliente: "Invitó a un cliente al portal",
  invitar_equipo: "Invitó a alguien al equipo",
  desactivar_usuario: "Desactivó la cuenta de alguien del equipo",
  reactivar_usuario: "Reactivó la cuenta de alguien del equipo",
  cambiar_estado_cotizacion: "Cambió el estado de una cotización",
  entrar_panel: "Entró al panel con el código de su correo",
  atender_incidente: "Marcó como atendido un incidente del chofer",
  enviar_aviso: "Mandó un aviso a clientes",
  // Las del chofer (app/acciones-chofer.js).
  no_procedio: "Marcó una parada como \"No procedió\"",
  reportar_incidente: "Reportó un incidente desde su ruta",
  // Éstas ya se anotaban pero salían con su clave cruda en la pantalla.
  activar_cuenta_registrada: "Activó la cuenta de un cliente registrado",
  alta_solicitada: "Llegó una solicitud de alta",
  registro_google: "Un cliente se registró con Google",
  // Alta con firma electrónica (lib/alta-servidor.js, db/025). Las dos puertas
  // —formulario y Google— anotan lo mismo; el detalle dice de cuál vino.
  alta_firmada: "Un cliente firmó su solicitud de alta",
  alta_correo_confirmado: "Un cliente confirmó el correo de su alta",
  eliminar_cuenta: "Eliminó su cuenta desde la app",
  eliminar_cuenta_simulada: "Pidió eliminar la cuenta de muestra",
  // Peso real del relleno (app/acciones-peso.js, db/023).
  registrar_viaje_relleno: "Registró un viaje al relleno con su peso real",
  editar_viaje_relleno: "Editó un viaje al relleno",
  borrar_viaje_relleno: "Borró un viaje al relleno",
  subir_ticket_viaje: "Subió la foto del ticket de báscula de un viaje",
  poner_peso_real: "Puso el peso real de una recolección",
  quitar_peso_real: "Quitó el peso real de una recolección",
  // Las anota la propia base (db/022), venga el cambio de la web, de la app
  // o de una llamada directa a la API.
  db_insert: "Alta",
  db_update: "Cambio",
  db_delete: "Borrado",
};

export const TEXTO_TABLA = {
  movimientos_saldo: "movimiento de saldo",
  perfiles: "cuenta de acceso",
  roles: "rol",
  clientes: "cliente",
  rutas: "ruta",
  solicitudes_recoleccion: "solicitud de recolección",
  domicilios: "punto de recolección",
  unidades: "unidad",
  contenedores: "contenedor",
  viajes_relleno: "viaje al relleno",
  suscripciones: "servicio contratado",
};

/**
 * El texto de la columna «Qué hizo». Igual que la web, con una diferencia a
 * propósito: una acción nueva que esta copia todavía no conoce se lee
 * "Asignar ruta punto" en vez de su clave cruda con guiones bajos.
 */
export function textoDeAccion(fila) {
  const clave = String(fila?.accion ?? "");
  const base = TEXTO_ACCION[clave] || (clave ? clave.charAt(0).toUpperCase() + clave.slice(1).replace(/_/g, " ") : "—");
  if (!clave.startsWith("db_")) return base;
  return `${base} de ${TEXTO_TABLA[fila.tabla] || fila.tabla || "registro"}`;
}

/** Las acciones del filtro, con su texto, en el orden de la lista. */
export const OPCIONES_ACCION = Object.keys(TEXTO_ACCION).map((id) => ({ id, texto: textoDeAccion({ accion: id }) }));
