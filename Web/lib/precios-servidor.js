/**
 * PRECIOS EN EL SERVIDOR — la MISMA copia para la web (app/acciones-precios.js)
 * y para la app (/api/app/precios). Recibe `sb` con la SESIÓN del usuario:
 * el RLS de db/027 es el guardia; aquí se cuentan filas porque un insert
 * bloqueado por RLS no siempre da error.
 */
import { leerMonto, validarConcepto, precioVigente } from "./precios.mjs";

const NO_SE_GUARDO = "No se guardó. ¿Tienes permiso de precios?";
const contar = ({ data, error }) => (error ? { ok: false, motivo: error.message } : data?.length ? { ok: true, filas: data } : { ok: false, motivo: NO_SE_GUARDO });

export async function leerCatalogo(sb) {
  const [c, p] = await Promise.all([
    sb.from("conceptos").select("id, clave, nombre, unidad, modalidad, orden, activo").order("orden").order("nombre"),
    sb.from("precios").select("id, concepto_id, cliente_id, precio, quitado, vale_desde, creado, creado_por").order("vale_desde", { ascending: false }),
  ]);
  if (c.error || p.error) return { ok: false, motivo: (c.error || p.error).message };
  return { ok: true, conceptos: c.data || [], renglones: p.data || [] };
}

export async function preciosDeCliente(sb, clienteId) {
  if (!clienteId) return { ok: false, motivo: "Falta el cliente." };
  const [cat, cli] = await Promise.all([
    leerCatalogo(sb),
    sb.from("clientes").select("id, empresa, folio, requiere_factura").eq("id", clienteId).maybeSingle(),
  ]);
  if (!cat.ok) return cat;
  if (cli.error || !cli.data) return { ok: false, motivo: "No encontré ese cliente." };
  const conceptos = cat.conceptos.map((k) => {
    const lista = precioVigente(cat.renglones, { clienteId: null, conceptoId: k.id });
    const vigente = precioVigente(cat.renglones, { clienteId, conceptoId: k.id });
    const ultimoEsp = cat.renglones.find((r) => r.concepto_id === k.id && r.cliente_id === clienteId && new Date(r.vale_desde) <= new Date());
    const especial = ultimoEsp && !ultimoEsp.quitado ? Number(ultimoEsp.precio) : null;
    const historial = cat.renglones.filter((r) => r.concepto_id === k.id && (r.cliente_id === clienteId || r.cliente_id == null));
    return { ...k, lista, especial, vigente, historial };
  });
  return { ok: true, cliente: cli.data, conceptos };
}

export async function crearConcepto(sb, { datos }) {
  const v = validarConcepto(datos);
  if (!v.ok) return v;
  const r = contar(await sb.from("conceptos").insert({ ...v.limpio, orden: Number(datos.orden) || 0 }).select());
  if (!r.ok && /duplicate|unique/i.test(r.motivo)) return { ok: false, motivo: "Ya existe un concepto con ese nombre." };
  return r.ok ? { ok: true, id: r.filas[0].id } : r;
}

export async function cambiarConcepto(sb, { id, cambios }) {
  const permitido = {};
  for (const k of ["nombre", "unidad", "modalidad", "orden", "activo"]) if (k in (cambios || {})) permitido[k] = cambios[k];
  if (permitido.nombre || permitido.unidad || permitido.modalidad) {
    const v = validarConcepto({ nombre: permitido.nombre ?? "xx", unidad: permitido.unidad ?? "xx", modalidad: permitido.modalidad ?? "mensual" });
    if (!v.ok) return v;
  }
  const r = contar(await sb.from("conceptos").update(permitido).eq("id", id).select());
  return r.ok ? { ok: true } : r;
}

export async function ponerPrecio(sb, { actorId, conceptoId, clienteId = null, texto }) {
  const m = leerMonto(texto);
  if (!m.ok) return m;
  if (!conceptoId) return { ok: false, motivo: "Falta el concepto." };
  const r = contar(await sb.from("precios").insert({ concepto_id: conceptoId, cliente_id: clienteId, precio: m.valor, creado_por: actorId }).select());
  return r.ok ? { ok: true, precio: m.valor } : r;
}

export async function quitarEspecial(sb, { actorId, conceptoId, clienteId }) {
  if (!clienteId || !conceptoId) return { ok: false, motivo: "Falta el cliente o el concepto." };
  const r = contar(await sb.from("precios").insert({ concepto_id: conceptoId, cliente_id: clienteId, quitado: true, creado_por: actorId }).select());
  return r.ok ? { ok: true } : r;
}

export async function cambiarFactura(sb, { clienteId, requiereFactura }) {
  if (typeof requiereFactura !== "boolean") return { ok: false, motivo: "Elige Sí o No." };
  const r = contar(await sb.from("clientes").update({ requiere_factura: requiereFactura }).eq("id", clienteId).select());
  return r.ok ? { ok: true } : r;
}
