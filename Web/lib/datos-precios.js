"use client";

/**
 * PRECIOS PARA EL PORTAL DEL CLIENTE (7-oct-2026).
 *
 * Lee la lista con la sesión del cliente: el RLS de db/027 le deja ver los
 * precios de lista y SOLO sus precios especiales, y su propia ficha (para
 * saber si requiere factura). La regla de cuál precio toca es `precioVigente`,
 * espejo de `precio_de` en la base.
 *
 * Sin base (modo demostración local) devuelve el catálogo de ejemplo de
 * `portal-datos.js`, marcado como tal.
 */
import { supabaseNavegador, haySupabaseNavegador } from "@/lib/supabase-navegador";
import { precioVigente } from "@/lib/precios.mjs";
import { CATALOGO_COTIZADOR } from "@/lib/portal-datos";

export async function catalogoDelCliente() {
  if (!haySupabaseNavegador()) {
    return {
      ok: true,
      demo: true,
      requiereFactura: true,
      conceptos: CATALOGO_COTIZADOR.map((s) => ({ id: s.id, nombre: s.servicio, unidad: s.unidad, precio: s.precio })),
    };
  }
  const sb = supabaseNavegador();
  const [c, p, yo] = await Promise.all([
    sb.from("conceptos").select("id, nombre, unidad, modalidad, orden").eq("activo", true).order("orden").order("nombre"),
    sb.from("precios").select("concepto_id, cliente_id, precio, quitado, vale_desde, creado"),
    sb.from("clientes").select("id, requiere_factura").limit(1).maybeSingle(),
  ]);
  if (c.error || p.error) {
    console.error("[precios] No se pudieron leer:", (c.error || p.error).message);
    return { ok: false, motivo: "No se pudieron leer los precios. Intenta de nuevo." };
  }
  const clienteId = yo.data?.id || null;
  return {
    ok: true,
    requiereFactura: Boolean(yo.data?.requiere_factura),
    conceptos: (c.data || []).map((k) => ({
      ...k,
      precio: precioVigente(p.data || [], { clienteId, conceptoId: k.id }),
    })),
  };
}
