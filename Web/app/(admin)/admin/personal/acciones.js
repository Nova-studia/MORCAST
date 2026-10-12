"use server";

import { exigirSeccion } from "@/lib/permisos-servidor";
import { haySupabase } from "@/lib/supabase";
import { registrar } from "@/lib/bitacora";
import { nombreCompleto } from "@/lib/personal.mjs";
import {
  directorio,
  expediente,
  altaEmpleado,
  editarEmpleado,
  bajaEmpleado,
  reactivarEmpleado,
  emitirGafete,
  paraImprimir,
  pinVigente,
  anotarChip,
  enlazarJefes,
} from "@/lib/personal-servidor";

/**
 * LAS ACCIONES DE LA SECCIÓN PERSONAL (db/032).
 *
 * Las tablas de empleados y gafetes no se tocan desde el navegador: todo
 * pasa por aquí. Cada acción es un endpoint abierto al mundo, así que cada
 * una pide SU permiso antes de hacer nada (`entrar`): la sección `personal`,
 * que da el dueño, y con ella el segundo paso del panel.
 *
 * La bitácora anota quién hizo qué, sin datos de emergencia: el nombre y el
 * número del empleado, nunca su tipo de sangre ni su contacto.
 */

/** `{ quien }` o `{ error }`. En modo prototipo no hay sesión que revisar. */
async function entrar() {
  if (!haySupabase()) return { quien: { id: null } };
  return exigirSeccion("personal");
}

const quienEs = (e) => ({ nombre: nombreCompleto(e), numero: e.numero });

/** Los campos del formulario, uno por uno: nada de lo que mande el navegador entra sin nombre. */
function camposDe(formData) {
  const campo = (nombre) => formData.get(nombre);
  return {
    numero: campo("numero"),
    nombre: campo("nombre"),
    apellido_paterno: campo("apellido_paterno"),
    apellido_materno: campo("apellido_materno"),
    puesto: campo("puesto"),
    area: campo("area"),
    tipo: campo("tipo"),
    reporta_a: campo("reporta_a") || null,
    tipo_sangre: campo("tipo_sangre"),
    alergias: campo("alergias"),
    contacto_emergencia: campo("contacto_emergencia"),
    telefono_emergencia: campo("telefono_emergencia"),
    permiso_emergencia: campo("permiso_emergencia") === "si",
  };
}

export async function listarPersonal() {
  const { error } = await entrar();
  if (error) return { ok: false, motivo: error };
  return { ...(await directorio()), demo: !haySupabase() };
}

export async function leerEmpleado(id) {
  const { error } = await entrar();
  if (error) return { ok: false, motivo: error };
  return expediente(String(id || ""));
}

/** Alta (sin `id`) o edición (con `id`). Llega como FormData porque puede traer la foto. */
export async function guardarEmpleado(formData) {
  const { quien, error } = await entrar();
  if (error) return { ok: false, motivo: error };

  const id = String(formData.get("id") || "");
  const foto = formData.get("foto");
  const campos = camposDe(formData);

  if (!id) {
    const r = await altaEmpleado(campos, { por: quien.id, foto });
    if (r.ok) {
      await registrar({ accion: "personal_alta", tabla: "empleados", registroId: r.empleado.id, detalle: quienEs(r.empleado) });
      if (r.codigo) await registrar({ accion: "gafete_emitido", tabla: "empleados", registroId: r.empleado.id, detalle: quienEs(r.empleado) });
    }
    return r.ok ? { ok: true, id: r.empleado.id, avisos: r.avisos } : r;
  }

  const r = await editarEmpleado(id, campos, { foto });
  if (r.ok) {
    await registrar({
      accion: r.cambioFoto ? "personal_foto" : "personal_editado",
      tabla: "empleados", registroId: id, detalle: quienEs(r.empleado),
    });
  }
  return r.ok ? { ok: true, id } : r;
}

export async function darDeBaja(id, motivo) {
  const { error } = await entrar();
  if (error) return { ok: false, motivo: error };
  const r = await bajaEmpleado(String(id || ""), motivo);
  if (r.ok) await registrar({ accion: "personal_baja", tabla: "empleados", registroId: id, detalle: { motivo: String(motivo).trim() } });
  return r;
}

export async function reactivar(id) {
  const { quien, error } = await entrar();
  if (error) return { ok: false, motivo: error };
  const r = await reactivarEmpleado(String(id || ""), { por: quien.id });
  if (r.ok) await registrar({ accion: "personal_reactivado", tabla: "empleados", registroId: id });
  return r;
}

/**
 * Reponer la tarjeta (perdida, rota) o emitir la primera si el alta no pudo.
 * La anterior deja de valer en el mismo paso; la nueva nace con el chip sin
 * grabar y hay que mandarla a imprimir.
 */
export async function reponerGafete(id, motivo) {
  const { quien, error } = await entrar();
  if (error) return { ok: false, motivo: error };
  const texto = String(motivo ?? "").replace(/\s+/g, " ").trim().slice(0, 200) || "Repuesto";
  const r = await emitirGafete(String(id || ""), { por: quien.id, motivo: texto });
  if (r.ok) await registrar({ accion: "gafete_repuesto", tabla: "empleados", registroId: id, detalle: { motivo: texto } });
  return r;
}

/** El PIN del gafete vigente. Verlo queda anotado: es lo que abre la ficha de emergencia. */
export async function verPin(id) {
  const { error } = await entrar();
  if (error) return { ok: false, motivo: error };
  const r = await pinVigente(String(id || ""));
  if (r.ok) await registrar({ accion: "gafete_pin_visto", tabla: "gafetes", registroId: r.gafeteId });
  return r.ok ? { ok: true, pin: r.pin } : r;
}

/** Lo que va impreso en cada tarjeta, PIN incluido, para la hoja de la imprenta. */
export async function datosDeImpresion(ids) {
  const { error } = await entrar();
  if (error) return { ok: false, motivo: error };
  const r = await paraImprimir(ids);
  if (r.ok && r.gafetes.length) {
    await registrar({ accion: "gafete_impresion", tabla: "gafetes", detalle: { gafetes: r.gafetes.length } });
  }
  return r;
}

/** La pantalla de grabar chips avisa aquí cuando terminó con una tarjeta. */
export async function chipGrabado({ codigo, sellado, serie } = {}) {
  const { error } = await entrar();
  if (error) return { ok: false, motivo: error };
  const r = await anotarChip(codigo);
  if (r.ok) {
    await registrar({
      accion: "gafete_chip", tabla: "gafetes", registroId: r.gafete.id,
      detalle: { sellado: Boolean(sellado), serie: String(serie || "").slice(0, 40) || undefined },
    });
  }
  return r.ok ? { ok: true } : r;
}

/** Cierre de la carga del Excel: enlaza a cada quien con su jefe y lo deja anotado. */
export async function cerrarCarga({ jefes, creados } = {}) {
  const { error } = await entrar();
  if (error) return { ok: false, motivo: error };
  const r = await enlazarJefes(jefes);
  await registrar({
    accion: "personal_importado", tabla: "empleados",
    detalle: { empleados: Number(creados) || 0, jefes_enlazados: r.hechos },
  });
  return r;
}
