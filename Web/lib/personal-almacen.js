import { supabaseServidor, haySupabase } from "./supabase";
import { cifrarPin, llaveDelPin } from "./pin-gafete.mjs";

/**
 * DÓNDE VIVEN LOS EMPLEADOS Y SUS GAFETES — solo para el servidor.
 *
 * Las tablas `empleados` y `gafetes` y la cubeta `personal` (db/032) no
 * tienen políticas: no se leen ni se escriben desde el navegador. Todo pasa
 * por aquí, con la llave de servicio, y quien llama ya revisó el permiso
 * (`exigirSeccion("personal")` en el panel) o saca solo los campos de su
 * nivel (la página pública, con lib/personal.mjs).
 *
 * Este archivo solo guarda y trae: las reglas (qué número sigue, cómo se
 * arma un gafete) viven en lib/personal-servidor.js, una sola vez, encima de
 * estas piezas.
 *
 * MODO PROTOTIPO: sin Supabase hay un directorio de ejemplo en memoria (se
 * pierde al reiniciar), con el mismo gafete que sale en las imágenes de la
 * propuesta, para poder recorrer el panel y la página pública.
 */

const COLUMNAS_EMPLEADO =
  "id, numero, nombre, apellido_paterno, apellido_materno, puesto, area, tipo, reporta_a, foto_ruta, estado, " +
  "baja_fecha, baja_motivo, tipo_sangre, alergias, contacto_emergencia, telefono_emergencia, permiso_emergencia, creado";
// Sin `pin_cifrado`: solo lo trae quien lo va a descifrar o comparar.
const COLUMNAS_GAFETE = "id, empleado_id, codigo, estado, emitido, impreso_en, chip_grabado_en, anulado_en, anulado_motivo";

/** Un error de la base con un texto que le sirve a quien está en el panel. */
function fallo(error, que) {
  console.error(`[personal] ${que}:`, error.message);
  const sinTablas = error.code === "42P01" || error.code === "PGRST205" || /schema cache/i.test(error.message || "");
  return Object.assign(
    new Error(sinTablas ? "Falta correr la migración 032 en la base de datos." : error.message),
    { code: error.code, sinTablas }
  );
}

function almacenReal() {
  const sb = supabaseServidor();
  return {
    async empleados() {
      const { data, error } = await sb.from("empleados").select(COLUMNAS_EMPLEADO)
        .order("apellido_paterno").order("apellido_materno").order("nombre");
      if (error) throw fallo(error, "no se pudieron leer los empleados");
      return data || [];
    },
    async empleado(id) {
      const { data, error } = await sb.from("empleados").select(COLUMNAS_EMPLEADO).eq("id", id).maybeSingle();
      if (error) throw fallo(error, "no se pudo leer el empleado");
      return data;
    },
    async numeros() {
      const { data, error } = await sb.from("empleados").select("numero");
      if (error) throw fallo(error, "no se pudieron leer los números");
      return (data || []).map((e) => e.numero);
    },
    async gafetesVigentes() {
      const { data, error } = await sb.from("gafetes").select(COLUMNAS_GAFETE).eq("estado", "vigente");
      if (error) throw fallo(error, "no se pudieron leer los gafetes");
      return data || [];
    },
    async gafetesDe(empleadoId) {
      const { data, error } = await sb.from("gafetes").select(COLUMNAS_GAFETE)
        .eq("empleado_id", empleadoId).order("emitido", { ascending: false });
      if (error) throw fallo(error, "no se pudieron leer los gafetes del empleado");
      return data || [];
    },
    /** El gafete vigente de cada uno de `ids`, CON su PIN cifrado. */
    async vigentesConPin(ids) {
      const { data, error } = await sb.from("gafetes").select(`${COLUMNAS_GAFETE}, pin_cifrado`)
        .eq("estado", "vigente").in("empleado_id", ids);
      if (error) throw fallo(error, "no se pudieron leer los gafetes");
      return data || [];
    },
    /** El gafete de ese código (con su PIN cifrado) y su empleado, o nulos. */
    async gafetePorCodigo(codigo) {
      const { data: gafete, error } = await sb.from("gafetes").select(`${COLUMNAS_GAFETE}, pin_cifrado`)
        .eq("codigo", codigo).maybeSingle();
      if (error) throw fallo(error, "no se pudo leer el gafete");
      if (!gafete) return { gafete: null, empleado: null };
      return { gafete, empleado: await this.empleado(gafete.empleado_id) };
    },
    async insertarEmpleado(fila) {
      const { data, error } = await sb.from("empleados").insert(fila).select(COLUMNAS_EMPLEADO).single();
      if (error) throw fallo(error, "no se pudo dar de alta");
      return data;
    },
    async actualizarEmpleado(id, cambios) {
      const { data, error } = await sb.from("empleados").update(cambios).eq("id", id).select(COLUMNAS_EMPLEADO);
      if (error) throw fallo(error, "no se pudo guardar el empleado");
      return data?.[0] || null;
    },
    async emitir({ empleadoId, codigo, pinCifrado, por, motivo }) {
      const { data, error } = await sb.rpc("emitir_gafete", {
        p_empleado: empleadoId, p_codigo: codigo, p_pin_cifrado: pinCifrado, p_por: por, p_motivo: motivo ?? null,
      });
      if (error) throw fallo(error, "no se pudo emitir el gafete");
      return data;
    },
    async baja(id, motivo) {
      const { data, error } = await sb.rpc("baja_empleado", { p_empleado: id, p_motivo: motivo });
      if (error) throw fallo(error, "no se pudo dar de baja");
      return data === true;
    },
    async reactivar(id) {
      const { data, error } = await sb.rpc("reactivar_empleado", { p_empleado: id });
      if (error) throw fallo(error, "no se pudo reactivar");
      return data === true;
    },
    async marcarChip(codigo) {
      const { data, error } = await sb.from("gafetes").update({ chip_grabado_en: new Date().toISOString() })
        .eq("codigo", codigo).eq("estado", "vigente").select(COLUMNAS_GAFETE);
      if (error) throw fallo(error, "no se pudo anotar el chip");
      return data?.[0] || null;
    },
    /** Anota que esos gafetes vigentes ya se mandaron a la imprenta. Devuelve cuántos. */
    async marcarImpresos(ids) {
      const { data, error } = await sb.from("gafetes").update({ impreso_en: new Date().toISOString() })
        .in("id", ids).eq("estado", "vigente").is("impreso_en", null).select("id");
      if (error) throw fallo(error, "no se pudo anotar la impresión");
      return data?.length || 0;
    },
    async subirFoto(ruta, archivo, tipo) {
      const { error } = await sb.storage.from("personal").upload(ruta, archivo, { contentType: tipo, upsert: false });
      if (error) throw fallo(error, "no se pudo subir la foto");
    },
    async borrarFoto(ruta) {
      const { error } = await sb.storage.from("personal").remove([ruta]);
      if (error) console.error("[personal] no se pudo borrar la foto vieja:", error.message);
    },
    async bajarFoto(ruta) {
      const { data, error } = await sb.storage.from("personal").download(ruta);
      if (error || !data) return null;
      return { bytes: await data.arrayBuffer(), tipo: data.type || "image/jpeg" };
    },
  };
}

/* ------------------------------------------------------------------ */
/* Modo prototipo                                                      */
/* ------------------------------------------------------------------ */

/** Solo cifra los PIN del directorio de ejemplo. Nunca se usa con Supabase. */
const LLAVE_DEMO = "llave-solo-para-el-directorio-de-ejemplo";

/** Personas inventadas. La primera es la de las imágenes de la propuesta. */
const GENTE_DEMO = [
  ["0001", "Dora Elena", "Garza", "Treviño", "Gerente general", "Dirección", "administrativo", null],
  ["0002", "Ramiro", "Salinas", "Cantú", "Jefe de operaciones", "Operación", "administrativo", "0001"],
  ["0003", "Ana Sofía", "Núñez", "Leal", "Contadora", "Administración", "administrativo", "0001"],
  ["0004", "Héctor", "Villarreal", "Ríos", "Supervisor de rutas", "Operación", "administrativo", "0002"],
  ["0024", "Juan Carlos", "Pérez", "López", "Operador de recolección", "Ruta Norte", "general", null],
  ["0025", "Miguel Ángel", "Torres", "Guerra", "Ayudante de recolección", "Ruta Norte", "general", null],
  ["0031", "Luis Fernando", "Soto", "Medina", "Operador de roll-off", "Ruta Industrial", "general", null],
];
const GAFETES_DEMO = { "0024": ["K7M2X9FDQ4", "482913"], "0001": ["ABCDEFGH23", "135790"], "0002": ["M4P7R2T9W3", "246801"] };

async function sembrar() {
  const ahora = new Date().toISOString();
  const empleados = GENTE_DEMO.map(([numero, nombre, apellido_paterno, apellido_materno, puesto, area, tipo]) => ({
    id: `demo-${numero}`, numero, nombre, apellido_paterno, apellido_materno, puesto, area, tipo,
    reporta_a: null, foto_ruta: null, estado: "activo", baja_fecha: null, baja_motivo: null,
    tipo_sangre: null, alergias: null, contacto_emergencia: null, telefono_emergencia: null,
    permiso_emergencia: false, creado: ahora,
  }));
  for (const [numero, , , , , , , jefe] of GENTE_DEMO) {
    if (jefe) empleados.find((e) => e.numero === numero).reporta_a = `demo-${jefe}`;
  }
  Object.assign(empleados.find((e) => e.numero === "0024"), {
    tipo_sangre: "O+", alergias: "Penicilina", contacto_emergencia: "María López (esposa)",
    telefono_emergencia: "8681234567", permiso_emergencia: true,
  });
  const gafetes = [];
  for (const [numero, [codigo, pin]] of Object.entries(GAFETES_DEMO)) {
    gafetes.push({
      id: `demo-g-${codigo}`, empleado_id: `demo-${numero}`, codigo, estado: "vigente", emitido: ahora,
      impreso_en: numero === "0024" ? null : ahora,
      chip_grabado_en: numero === "0001" ? ahora : null, anulado_en: null, anulado_motivo: null,
      pin_cifrado: await cifrarPin(pin, codigo, LLAVE_DEMO),
    });
  }
  return { empleados, gafetes, fotos: new Map(), sig: 1 };
}

function almacenDemo() {
  // En `globalThis`: el servidor de desarrollo carga este módulo más de una
  // vez (páginas, acciones, rutas) y cada copia tendría su propio directorio.
  const datos = async () => (globalThis.__morcastPersonalDemo ||= sembrar());
  const sinPin = ({ pin_cifrado, ...g }) => g;
  const orden = (a, b) =>
    `${a.apellido_paterno} ${a.apellido_materno} ${a.nombre}`.localeCompare(`${b.apellido_paterno} ${b.apellido_materno} ${b.nombre}`, "es");
  return {
    async empleados() { return [...(await datos()).empleados].sort(orden).map((e) => ({ ...e })); },
    async empleado(id) { const e = (await datos()).empleados.find((x) => x.id === id); return e ? { ...e } : null; },
    async numeros() { return (await datos()).empleados.map((e) => e.numero); },
    async gafetesVigentes() { return (await datos()).gafetes.filter((g) => g.estado === "vigente").map(sinPin); },
    async gafetesDe(empleadoId) {
      return (await datos()).gafetes.filter((g) => g.empleado_id === empleadoId)
        .sort((a, b) => b.emitido.localeCompare(a.emitido)).map(sinPin);
    },
    async vigentesConPin(ids) {
      return (await datos()).gafetes.filter((g) => g.estado === "vigente" && ids.includes(g.empleado_id)).map((g) => ({ ...g }));
    },
    async gafetePorCodigo(codigo) {
      const gafete = (await datos()).gafetes.find((g) => g.codigo === codigo);
      return gafete ? { gafete: { ...gafete }, empleado: await this.empleado(gafete.empleado_id) } : { gafete: null, empleado: null };
    },
    async insertarEmpleado(fila) {
      const d = await datos();
      if (d.empleados.some((e) => e.numero === fila.numero)) throw Object.assign(new Error("número repetido"), { code: "23505" });
      const nuevo = {
        apellido_materno: "", area: "", reporta_a: null, foto_ruta: null, estado: "activo", baja_fecha: null,
        baja_motivo: null, tipo_sangre: null, alergias: null, contacto_emergencia: null, telefono_emergencia: null,
        permiso_emergencia: false, ...fila, id: `demo-n${d.sig++}`, creado: new Date().toISOString(),
      };
      delete nuevo.creado_por;
      d.empleados.push(nuevo);
      return { ...nuevo };
    },
    async actualizarEmpleado(id, cambios) {
      const d = await datos();
      const e = d.empleados.find((x) => x.id === id);
      if (!e) return null;
      if (cambios.numero && d.empleados.some((x) => x.id !== id && x.numero === cambios.numero)) {
        throw Object.assign(new Error("número repetido"), { code: "23505" });
      }
      Object.assign(e, cambios);
      return { ...e };
    },
    async emitir({ empleadoId, codigo, pinCifrado, motivo }) {
      const d = await datos();
      const ahora = new Date().toISOString();
      if (!d.empleados.some((e) => e.id === empleadoId && e.estado === "activo")) throw new Error("Solo se emite gafete a un empleado activo.");
      for (const g of d.gafetes) {
        if (g.empleado_id === empleadoId && g.estado === "vigente") {
          Object.assign(g, { estado: "repuesto", anulado_en: ahora, anulado_motivo: motivo || "Repuesto" });
        }
      }
      const id = `demo-g-${codigo}`;
      d.gafetes.push({
        id, empleado_id: empleadoId, codigo, pin_cifrado: pinCifrado, estado: "vigente", emitido: ahora,
        impreso_en: null, chip_grabado_en: null, anulado_en: null, anulado_motivo: null,
      });
      return id;
    },
    async baja(id, motivo) {
      const d = await datos();
      const e = d.empleados.find((x) => x.id === id && x.estado === "activo");
      if (!e) return false;
      const ahora = new Date().toISOString();
      Object.assign(e, { estado: "baja", baja_fecha: ahora.slice(0, 10), baja_motivo: motivo });
      for (const g of d.gafetes) {
        if (g.empleado_id === id && g.estado === "vigente") {
          Object.assign(g, { estado: "anulado", anulado_en: ahora, anulado_motivo: "Baja del empleado" });
        }
      }
      return true;
    },
    async reactivar(id) {
      const e = (await datos()).empleados.find((x) => x.id === id && x.estado === "baja");
      if (!e) return false;
      Object.assign(e, { estado: "activo", baja_fecha: null, baja_motivo: null });
      return true;
    },
    async marcarChip(codigo) {
      const g = (await datos()).gafetes.find((x) => x.codigo === codigo && x.estado === "vigente");
      if (!g) return null;
      g.chip_grabado_en = new Date().toISOString();
      return sinPin(g);
    },
    async marcarImpresos(ids) {
      const ahora = new Date().toISOString();
      const suyos = (await datos()).gafetes.filter((g) => ids.includes(g.id) && g.estado === "vigente" && !g.impreso_en);
      suyos.forEach((g) => { g.impreso_en = ahora; });
      return suyos.length;
    },
    async subirFoto(ruta, archivo, tipo) { (await datos()).fotos.set(ruta, { bytes: await archivo.arrayBuffer(), tipo }); },
    async borrarFoto(ruta) { (await datos()).fotos.delete(ruta); },
    async bajarFoto(ruta) { return (await datos()).fotos.get(ruta) || null; },
  };
}

/** El almacén que toca: la base, o el directorio de ejemplo si no hay Supabase. */
export function almacenPersonal() {
  return haySupabase() ? almacenReal() : almacenDemo();
}

/**
 * La llave para cifrar y descifrar PIN. Con Supabase, la de Vercel
 * (`PERSONAL_PIN_LLAVE`) o null: sin ella no se emiten gafetes.
 */
export function llavePersonal() {
  return haySupabase() ? llaveDelPin() : LLAVE_DEMO;
}
