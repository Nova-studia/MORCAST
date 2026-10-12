import { almacenPersonal, llavePersonal } from "./personal-almacen";
import { nuevoCodigo, normalizarCodigo } from "./gafetes.mjs";
import { nuevoPin, cifrarPin, descifrarPin } from "./pin-gafete.mjs";
import { validarEmpleado, siguienteNumero, nombreCompleto, TOPES } from "./personal.mjs";

/**
 * PERSONAL Y GAFETES — lo que hace el servidor (sin sesión ni permisos).
 *
 * Las reglas de cada operación, una sola vez, encima de las piezas de
 * lib/personal-almacen.js. Aquí NO se revisa quién llama: lo hace cada
 * acción del panel con `exigirSeccion("personal")` antes de entrar
 * (app/(admin)/admin/personal/acciones.js). La página pública no usa este
 * archivo: lee con `almacenPersonal()` y recorta con lib/personal.mjs.
 *
 * Cada función devuelve `{ ok: true, … }` o `{ ok: false, motivo }` y no
 * lanza: quien la llama es una acción que le contesta a una pantalla.
 */

export const TIPOS_FOTO = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export const MAX_FOTO_BYTES = 2 * 1024 * 1024;

const SIN_LLAVE =
  "Falta la variable PERSONAL_PIN_LLAVE en el servidor: sin ella no se pueden emitir gafetes (el PIN se guarda cifrado).";

const motivoDe = (e) => e?.message || "No se pudo completar. Revisa tu conexión.";

/** ¿Es un archivo de foto que se puede guardar? */
export function validarFoto(archivo) {
  if (!archivo || typeof archivo !== "object" || !archivo.size) return { ok: true, foto: null };
  if (!TIPOS_FOTO[archivo.type]) return { ok: false, motivo: "La foto tiene que ser JPG, PNG o WEBP." };
  if (archivo.size > MAX_FOTO_BYTES) return { ok: false, motivo: "La foto pesa más de 2 MB." };
  return { ok: true, foto: archivo };
}

/**
 * El directorio para la lista del panel: cada empleado con su gafete
 * vigente (o null). Sin datos de emergencia: la lista no los necesita.
 */
export async function directorio() {
  try {
    const almacen = almacenPersonal();
    const [empleados, gafetes] = await Promise.all([almacen.empleados(), almacen.gafetesVigentes()]);
    const porEmpleado = new Map(gafetes.map((g) => [g.empleado_id, g]));
    return {
      ok: true,
      sinLlave: !llavePersonal(),
      empleados: empleados.map((e) => ({
        id: e.id, numero: e.numero, nombre: e.nombre, apellido_paterno: e.apellido_paterno,
        apellido_materno: e.apellido_materno, puesto: e.puesto, area: e.area, tipo: e.tipo,
        reporta_a: e.reporta_a, foto_ruta: e.foto_ruta, estado: e.estado,
        gafete: porEmpleado.get(e.id) || null,
      })),
    };
  } catch (e) {
    return { ok: false, motivo: motivoDe(e), sinTablas: Boolean(e?.sinTablas) };
  }
}

/** La ficha completa: el empleado, su historial de gafetes y a quién puede reportar. */
export async function expediente(id) {
  try {
    const almacen = almacenPersonal();
    const empleado = await almacen.empleado(id);
    if (!empleado) return { ok: false, motivo: "Ese empleado ya no existe." };
    const [gafetes, todos] = await Promise.all([almacen.gafetesDe(id), almacen.empleados()]);
    return {
      ok: true,
      empleado,
      gafetes,
      sinLlave: !llavePersonal(),
      jefes: todos
        .filter((e) => e.id !== id && e.estado === "activo" && e.tipo === "administrativo")
        .map((e) => ({ id: e.id, nombre: nombreCompleto(e), puesto: e.puesto })),
    };
  } catch (e) {
    return { ok: false, motivo: motivoDe(e) };
  }
}

/** Un gafete nuevo para `empleadoId`: código y PIN al azar; el vigente deja de valer. */
export async function emitirGafete(empleadoId, { por = null, motivo = null } = {}) {
  const llave = llavePersonal();
  if (!llave) return { ok: false, motivo: SIN_LLAVE };
  const almacen = almacenPersonal();
  // El código es único en la base. Que se repita uno al azar es de uno en
  // billones, pero si pasa se saca otro en vez de fallarle a la persona.
  for (let intento = 0; intento < 3; intento++) {
    const codigo = nuevoCodigo();
    try {
      const id = await almacen.emitir({
        empleadoId, codigo, pinCifrado: await cifrarPin(nuevoPin(), codigo, llave), por, motivo,
      });
      return { ok: true, id, codigo };
    } catch (e) {
      if (e?.code !== "23505") return { ok: false, motivo: motivoDe(e) };
    }
  }
  return { ok: false, motivo: "No se pudo generar el código del gafete. Inténtalo otra vez." };
}

async function guardarFoto(almacen, empleado, foto) {
  const ruta = `${empleado.id}/${Date.now()}.${TIPOS_FOTO[foto.type]}`;
  await almacen.subirFoto(ruta, foto, foto.type);
  const guardado = await almacen.actualizarEmpleado(empleado.id, { foto_ruta: ruta });
  if (guardado && empleado.foto_ruta) await almacen.borrarFoto(empleado.foto_ruta);
  return guardado;
}

/**
 * Alta de un empleado, con su gafete. Si el número viene vacío se le pone el
 * siguiente. La foto y el gafete van después del renglón: si alguno falla,
 * la persona YA quedó dada de alta y se dice qué faltó (se arregla desde su
 * ficha), en vez de perder lo capturado.
 */
export async function altaEmpleado(entrada, { por = null, foto = null } = {}) {
  const v = validarEmpleado(entrada);
  if (!v.ok) return { ok: false, motivo: "Revisa los campos marcados.", errores: v.errores };
  const f = validarFoto(foto);
  if (!f.ok) return { ok: false, motivo: f.motivo, errores: { foto: f.motivo } };
  if (!llavePersonal()) return { ok: false, motivo: SIN_LLAVE };

  const almacen = almacenPersonal();
  let empleado = null;
  try {
    const numeroPuesto = Boolean(v.datos.numero);
    for (let intento = 0; intento < 4 && !empleado; intento++) {
      const numero = numeroPuesto ? v.datos.numero : siguienteNumero(await almacen.numeros());
      try {
        empleado = await almacen.insertarEmpleado({ ...v.datos, numero, creado_por: por });
      } catch (e) {
        if (e?.code !== "23505") throw e;
        // Dos altas a la vez tomaron el mismo "siguiente": se vuelve a pedir.
        if (numeroPuesto) {
          return { ok: false, motivo: "Revisa los campos marcados.", errores: { numero: "Ya hay otro empleado con ese número." } };
        }
      }
    }
    if (!empleado) return { ok: false, motivo: "No se pudo asignar el número de empleado. Inténtalo otra vez." };
  } catch (e) {
    return { ok: false, motivo: motivoDe(e) };
  }

  const avisos = [];
  if (f.foto) {
    try {
      empleado = (await guardarFoto(almacen, empleado, f.foto)) || empleado;
    } catch (e) {
      avisos.push(`No se pudo guardar la foto (${motivoDe(e)}). Súbela desde su ficha.`);
    }
  }
  const gafete = await emitirGafete(empleado.id, { por });
  if (!gafete.ok) avisos.push(`No se pudo emitir su gafete (${gafete.motivo}). Emítelo desde su ficha.`);
  return { ok: true, empleado, codigo: gafete.codigo || null, avisos };
}

/** Edita los datos (y la foto, si viene) de un empleado. */
export async function editarEmpleado(id, entrada, { foto = null } = {}) {
  const v = validarEmpleado({ ...entrada, id });
  if (!v.ok) return { ok: false, motivo: "Revisa los campos marcados.", errores: v.errores };
  if (!v.datos.numero) return { ok: false, motivo: "Revisa los campos marcados.", errores: { numero: "El número no puede quedar vacío." } };
  const f = validarFoto(foto);
  if (!f.ok) return { ok: false, motivo: f.motivo, errores: { foto: f.motivo } };

  const almacen = almacenPersonal();
  try {
    let empleado = await almacen.actualizarEmpleado(id, v.datos);
    if (!empleado) return { ok: false, motivo: "Ese empleado ya no existe." };
    if (f.foto) empleado = (await guardarFoto(almacen, empleado, f.foto)) || empleado;
    return { ok: true, empleado, cambioFoto: Boolean(f.foto) };
  } catch (e) {
    if (e?.code === "23505") {
      return { ok: false, motivo: "Revisa los campos marcados.", errores: { numero: "Ya hay otro empleado con ese número." } };
    }
    return { ok: false, motivo: motivoDe(e) };
  }
}

/** Baja: deja de estar activo y su gafete se anula en el mismo paso. */
export async function bajaEmpleado(id, motivo) {
  const texto = String(motivo ?? "").replace(/\s+/g, " ").trim().slice(0, TOPES.motivo);
  if (!texto) return { ok: false, motivo: "Escribe el motivo de la baja." };
  try {
    const hecho = await almacenPersonal().baja(id, texto);
    return hecho ? { ok: true } : { ok: false, motivo: "Ese empleado ya estaba de baja." };
  } catch (e) {
    return { ok: false, motivo: motivoDe(e) };
  }
}

/** Reactivar: vuelve a estar activo y se le emite un gafete NUEVO. */
export async function reactivarEmpleado(id, { por = null } = {}) {
  if (!llavePersonal()) return { ok: false, motivo: SIN_LLAVE };
  try {
    if (!(await almacenPersonal().reactivar(id))) return { ok: false, motivo: "Ese empleado no está de baja." };
  } catch (e) {
    return { ok: false, motivo: motivoDe(e) };
  }
  const gafete = await emitirGafete(id, { por });
  return gafete.ok
    ? { ok: true, codigo: gafete.codigo }
    : { ok: true, codigo: null, avisos: [`Quedó activo, pero no se pudo emitir su gafete (${gafete.motivo}).`] };
}

/**
 * Lo que hace falta para imprimir: de cada empleado activo de `ids` con
 * gafete vigente, lo que va en la tarjeta y su PIN en claro.
 */
export async function paraImprimir(ids) {
  const llave = llavePersonal();
  if (!llave) return { ok: false, motivo: SIN_LLAVE };
  const lista = [...new Set((Array.isArray(ids) ? ids : []).map(String))].slice(0, 300);
  if (!lista.length) return { ok: true, gafetes: [], sinGafete: [] };
  try {
    const almacen = almacenPersonal();
    const [empleados, vigentes] = await Promise.all([almacen.empleados(), almacen.vigentesConPin(lista)]);
    const porEmpleado = new Map(vigentes.map((g) => [g.empleado_id, g]));
    const gafetes = [];
    const sinGafete = [];
    for (const e of empleados.filter((x) => lista.includes(x.id))) {
      const g = porEmpleado.get(e.id);
      const pin = g && e.estado === "activo" ? await descifrarPin(g.pin_cifrado, g.codigo, llave) : null;
      if (!pin) { sinGafete.push(nombreCompleto(e)); continue; }
      gafetes.push({
        empleadoId: e.id, numero: e.numero, nombre: e.nombre, apellido_paterno: e.apellido_paterno,
        apellido_materno: e.apellido_materno, puesto: e.puesto, foto_ruta: e.foto_ruta,
        gafeteId: g.id, codigo: g.codigo, pin, emitido: g.emitido, chip_grabado_en: g.chip_grabado_en,
      });
    }
    return { ok: true, gafetes, sinGafete };
  } catch (e) {
    return { ok: false, motivo: motivoDe(e) };
  }
}

/** El PIN en claro del gafete vigente de un empleado (para enseñarlo en su ficha). */
export async function pinVigente(empleadoId) {
  const r = await paraImprimir([empleadoId]);
  if (!r.ok) return r;
  const g = r.gafetes[0];
  return g ? { ok: true, pin: g.pin, gafeteId: g.gafeteId, codigo: g.codigo } : { ok: false, motivo: "No tiene un gafete vigente." };
}

/** Anota que el chip de ese gafete ya se grabó. */
export async function anotarChip(codigo) {
  const c = normalizarCodigo(codigo);
  if (!c) return { ok: false, motivo: "Ese código no es de un gafete." };
  try {
    const gafete = await almacenPersonal().marcarChip(c);
    return gafete
      ? { ok: true, gafete }
      : { ok: false, motivo: "Ese código no es de un gafete vigente: el chip se grabó, pero no hay a quién anotárselo." };
  } catch (e) {
    return { ok: false, motivo: motivoDe(e) };
  }
}

/**
 * Pone el jefe directo de varios a la vez (la carga del Excel: primero se
 * dan de alta todos y después se enlazan, porque el jefe puede venir más
 * abajo en la hoja). Devuelve cuántos se enlazaron.
 */
export async function enlazarJefes(pares) {
  const almacen = almacenPersonal();
  let hechos = 0;
  for (const par of (Array.isArray(pares) ? pares : []).slice(0, 300)) {
    if (!par?.id || !par?.jefe || par.id === par.jefe) continue;
    try {
      if (await almacen.actualizarEmpleado(String(par.id), { reporta_a: String(par.jefe) })) hechos++;
    } catch (e) {
      console.error("[personal] no se pudo poner el jefe:", motivoDe(e));
    }
  }
  return { ok: true, hechos };
}
