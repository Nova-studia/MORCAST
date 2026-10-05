"use client";

/**
 * Acceso a CONTENEDORES (el inventario con QR) contra la base de datos.
 *
 * Las reglas las pone el RLS de db/023: el personal (dueño y admin) hace
 * todo con `contenedores_personal`; el chofer solo ve los de sus paradas y
 * el cliente los de sus puntos. Por eso aquí no se revisa ningún rol, y por
 * eso cada escritura CUENTA las filas: un update bloqueado por el RLS no da
 * error, devuelve cero filas.
 *
 * La bitácora (alta, baja, cambio de estado o de punto) la escribe la base
 * sola con `bitacora_contenedores_tg`.
 *
 * MODO PROTOTIPO: sin Supabase, un inventario de ejemplo en memoria.
 */

import { supabaseNavegador, haySupabaseNavegador } from "@/lib/supabase-navegador";
import { CLIENTES_ADMIN } from "@/lib/admin-datos";
import { codigoDeNumero, validarContenedor } from "@/lib/contenedores.mjs";

const COLUMNAS = `
  id, codigo, tipo, medida, estado, domicilio_id, notas, creado, actualizado,
  domicilios ( id, alias, colonia, cliente_id, clientes ( id, empresa ) )
`;

/** Supabase entrega 1000 filas como máximo por consulta. */
const PAGINA = 1000;
/** Y un insert enorme puede rebasar el cuerpo permitido: se manda en tandas. */
const TANDA = 250;

/** Fila de la base → lo que pinta la pantalla. */
function aPantalla(f) {
  const d = f.domicilios;
  return {
    id: f.id,
    codigo: f.codigo,
    tipo: f.tipo,
    medida: f.medida || "",
    estado: f.estado,
    domicilioId: f.domicilio_id || null,
    punto: d ? { id: d.id, alias: d.alias, colonia: d.colonia || "" } : null,
    cliente: d?.clientes ? { id: d.clientes.id, empresa: d.clientes.empresa } : null,
    notas: f.notas || "",
    actualizado: f.actualizado,
  };
}

/* ------------------------------------------------------------------ */
/* Datos de ejemplo                                                    */
/* ------------------------------------------------------------------ */

let demoClientes = null;
let demoContenedores = null;

/** Los clientes de ejemplo del panel, cada uno con uno o dos puntos. */
function clientesDemo() {
  if (demoClientes) return demoClientes;
  const puntos = [
    [{ alias: "Planta 1", colonia: "Parque Industrial" }, { alias: "Planta 2", colonia: "Parque Industrial" }],
    [{ alias: "Anexo", colonia: "Zona Centro" }],
    [{ alias: "Matriz", colonia: "Zona Centro" }],
    [{ alias: "Nave 3", colonia: "Parque Industrial del Norte" }],
    [{ alias: "Sucursal Lauro Villar", colonia: "Lauro Villar" }, { alias: "Bodega", colonia: "Las Brisas" }],
  ];
  demoClientes = CLIENTES_ADMIN.map((c, i) => ({
    id: `demo-c${i + 1}`,
    empresa: c.empresa,
    puntos: (puntos[i] || []).map((p, j) => ({ id: `demo-d${i + 1}-${j + 1}`, ...p })),
  }));
  return demoClientes;
}

function inventarioDemo() {
  if (demoContenedores) return demoContenedores;
  const cl = clientesDemo();
  const asignar = [
    [cl[0], 0], [cl[0], 0], [cl[0], 1], [cl[1], 0], [cl[2], 0], [cl[2], 0], [cl[3], 0], [cl[4], 0], [cl[4], 1],
  ];
  const tipos = [["tolva", "30 m³"], ["contenedor", "3 m³"], ["contenedor", "6 m³"], ["compactador", "21 m³"]];
  demoContenedores = Array.from({ length: 18 }, (_, i) => {
    const [cliente, p] = asignar[i] || [];
    const punto = cliente?.puntos[p];
    const [tipo, medida] = tipos[i % tipos.length];
    const estado = i === 11 ? "danado" : i === 14 ? "perdido" : i >= asignar.length ? "en-bodega" : "en-servicio";
    return {
      id: `demo-k${i + 1}`,
      codigo: codigoDeNumero(i + 1),
      tipo,
      medida,
      estado,
      domicilioId: punto?.id || null,
      punto: punto ? { id: punto.id, alias: punto.alias, colonia: punto.colonia } : null,
      cliente: cliente ? { id: cliente.id, empresa: cliente.empresa } : null,
      notas: i === 11 ? "Bisagra de la tapa rota." : "",
      actualizado: null,
    };
  });
  return demoContenedores;
}

/** Arma la fila de pantalla de un contenedor de ejemplo a partir de su punto. */
function conPuntoDemo(fila) {
  for (const c of clientesDemo()) {
    const p = c.puntos.find((x) => x.id === fila.domicilio_id);
    if (p) return { punto: { id: p.id, alias: p.alias, colonia: p.colonia }, cliente: { id: c.id, empresa: c.empresa } };
  }
  return { punto: null, cliente: null };
}

/* ------------------------------------------------------------------ */
/* Lectura                                                             */
/* ------------------------------------------------------------------ */

/** Todo el inventario, por código. Pide de mil en mil hasta acabar. */
export async function listarContenedores() {
  if (!haySupabaseNavegador()) return [...inventarioDemo()];

  const supabase = supabaseNavegador();
  const filas = [];
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await supabase
      .from("contenedores")
      .select(COLUMNAS)
      .order("codigo")
      .range(desde, desde + PAGINA - 1);
    if (error) {
      console.error("[contenedores] No se pudieron leer:", error.message);
      return filas.map(aPantalla);
    }
    filas.push(...(data || []));
    if (!data || data.length < PAGINA) break;
  }
  return filas.map(aPantalla);
}

/**
 * Los clientes con sus puntos de recolección, para asignar un contenedor y
 * para casar lo que viene del Excel: [{ id, empresa, puntos: [{ id, alias, colonia }] }].
 */
export async function listarClientesConPuntos() {
  if (!haySupabaseNavegador()) return clientesDemo();

  const { data, error } = await supabaseNavegador()
    .from("clientes")
    .select("id, empresa, domicilios ( id, alias, colonia )")
    .order("empresa");
  if (error) {
    console.error("[contenedores] No se pudieron leer los clientes:", error.message);
    return [];
  }
  return (data || []).map((c) => ({
    id: c.id,
    empresa: c.empresa,
    puntos: (c.domicilios || [])
      .map((d) => ({ id: d.id, alias: d.alias, colonia: d.colonia || "" }))
      .sort((a, b) => a.alias.localeCompare(b.alias, "es")),
  }));
}

/* ------------------------------------------------------------------ */
/* Escritura                                                           */
/* ------------------------------------------------------------------ */

/**
 * Crea varios contenedores de una vez (alta individual, lote o Excel).
 * `filas` ya validadas: [{ codigo, tipo, medida, estado?, domicilio_id?, notas? }].
 *
 * Con `ignoreDuplicates` la base se brinca en silencio los códigos que ya
 * existen en vez de tronar todo el lote. Así, si otra persona dio de alta
 * uno de esos códigos entre la vista previa y el guardado, no se pierde la
 * tanda entera: se cuenta lo que SÍ entró y se dice cuáles se saltaron.
 *
 * Devuelve `{ ok, creados: [filas de pantalla], saltados: [códigos] }`.
 */
export async function crearContenedores(filas) {
  const limpias = [];
  for (const f of filas) {
    const v = validarContenedor(f);
    if (!v.ok) return { ok: false, motivo: `${f.codigo || "Un renglón"}: ${Object.values(v.errores).join(" ")}` };
    limpias.push(v.datos);
  }

  if (!haySupabaseNavegador()) {
    const inv = inventarioDemo();
    const ya = new Set(inv.map((c) => c.codigo));
    const creados = [];
    const saltados = [];
    for (const d of limpias) {
      if (ya.has(d.codigo)) { saltados.push(d.codigo); continue; }
      ya.add(d.codigo);
      const fila = {
        id: `demo-k${Date.now()}-${d.codigo}`,
        codigo: d.codigo, tipo: d.tipo, medida: d.medida || "", estado: d.estado,
        domicilioId: d.domicilio_id, notas: d.notas || "", actualizado: null,
        ...conPuntoDemo(d),
      };
      inv.push(fila);
      creados.push(fila);
    }
    inv.sort((a, b) => a.codigo.localeCompare(b.codigo));
    return { ok: true, creados, saltados, demo: true };
  }

  const supabase = supabaseNavegador();
  const creados = [];
  for (let i = 0; i < limpias.length; i += TANDA) {
    const tanda = limpias.slice(i, i + TANDA);
    const { data, error } = await supabase
      .from("contenedores")
      .upsert(tanda, { onConflict: "codigo", ignoreDuplicates: true })
      .select(COLUMNAS);
    if (error) {
      console.error("[contenedores] No se pudo crear la tanda:", error.message);
      // Lo de las tandas anteriores SÍ quedó guardado: se dice cuánto.
      return {
        ok: false,
        motivo: creados.length
          ? `Se guardaron ${creados.length} y luego falló: ${error.message}. Revisa la lista antes de reintentar.`
          : error.message,
        creados: creados.map(aPantalla),
      };
    }
    creados.push(...(data || []));
  }
  const entraron = new Set(creados.map((c) => c.codigo));
  const saltados = limpias.map((d) => d.codigo).filter((c) => !entraron.has(c));
  return { ok: true, creados: creados.map(aPantalla), saltados };
}

/**
 * Guarda tipo, medida, estado, punto y notas de un contenedor. El código NO
 * se cambia: es lo que está impreso en la etiqueta pegada al contenedor, y
 * cambiarlo aquí dejaría al QR apuntando a nada.
 */
export async function guardarContenedor(c) {
  const v = validarContenedor({ ...c, domicilio_id: c.domicilioId });
  if (!v.ok) return { ok: false, motivo: "Revisa los campos marcados.", errores: v.errores };
  const { tipo, medida, estado, domicilio_id, notas } = v.datos;

  if (!haySupabaseNavegador()) {
    const inv = inventarioDemo();
    const i = inv.findIndex((x) => x.id === c.id);
    inv[i] = { ...inv[i], tipo, medida: medida || "", estado, domicilioId: domicilio_id, notas: notas || "", ...conPuntoDemo({ domicilio_id }) };
    return { ok: true, contenedor: inv[i], demo: true };
  }

  const { data, error } = await supabaseNavegador()
    .from("contenedores")
    // `actualizado` no tiene disparador en la 023: se pone aquí.
    .update({ tipo, medida, estado, domicilio_id, notas, actualizado: new Date().toISOString() })
    .eq("id", c.id)
    .select(COLUMNAS);
  if (error) {
    console.error("[contenedores] No se pudo guardar:", error.message);
    return { ok: false, motivo: error.message };
  }
  if (!data?.length) {
    return { ok: false, motivo: "No se guardó nada: la base no te dejó cambiar ese contenedor." };
  }
  return { ok: true, contenedor: aPantalla(data[0]) };
}

/**
 * Borra un contenedor capturado por error. Si ya tiene incidentes, no: el
 * incidente se quedaría sin saber de qué contenedor era (la llave es
 * `on delete set null`). Para uno que ya existió de verdad está el estado
 * 'baja'.
 */
export async function borrarContenedor(c) {
  if (!haySupabaseNavegador()) {
    demoContenedores = inventarioDemo().filter((x) => x.id !== c.id);
    return { ok: true, demo: true };
  }

  const supabase = supabaseNavegador();
  const { count, error: errorCuenta } = await supabase
    .from("incidentes")
    .select("id", { count: "exact", head: true })
    .eq("contenedor_id", c.id);
  if (errorCuenta) return { ok: false, motivo: "No se pudo revisar si tiene incidentes; no se borró." };
  if (count) {
    return { ok: false, motivo: `No se puede borrar: tiene ${count} incidente(s). Dalo de baja en su lugar.` };
  }

  const { data, error } = await supabase.from("contenedores").delete().eq("id", c.id).select("id");
  if (error) return { ok: false, motivo: error.message };
  if (!data?.length) return { ok: false, motivo: "No se borró nada: la base no permitió eliminarlo." };
  return { ok: true };
}
