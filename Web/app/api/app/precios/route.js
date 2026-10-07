/**
 * POST /api/app/precios — conceptos y precios que le tocan a quien pregunta (7-oct-2026).
 * La app 1.1.1 deja de traer precios escritos en el código: los pide aquí, y así
 * un cambio en el panel se ve en la app sin sacar otra versión. Con el Hold
 * activo no sale ningún monto. Ver docs/superpowers/specs/2026-10-07-precios-design.md
 */
import { entrarApp, responder } from "@/lib/app-ruta";
import { enHold } from "@/lib/estado-sistema";
import { leerCatalogo } from "@/lib/precios-servidor";
import { respuestaPrecios } from "@/lib/precios-app.mjs";

export async function POST(peticion) {
  const r = await entrarApp(peticion, {
    roles: ["cliente", "dueno", "admin"],
    freno: { nombre: "app-precios", maximo: 120, minutos: 60 },
  });
  if (r.respuesta) return r.respuesta;

  const clienteId = r.perfil?.rol === "cliente" ? r.perfil?.cliente_id || null : null;
  const cat = await leerCatalogo(r.sb);
  if (!cat.ok) return responder({ ok: false, motivo: "No se pudieron leer los precios." }, 500);

  let requiereFactura = null;
  let renglones = cat.renglones;
  if (clienteId) {
    const { data } = await r.sb.from("clientes").select("requiere_factura").eq("id", clienteId).maybeSingle();
    requiereFactura = Boolean(data?.requiere_factura);
    // `r.sb` es la llave de servicio (entrarApp): se filtra a mano lo que el RLS filtraría.
    renglones = renglones.filter((x) => x.cliente_id == null || x.cliente_id === clienteId);
  }
  const conceptos = cat.conceptos.filter((k) => k.activo);
  return responder(respuestaPrecios({ hold: enHold(), requiereFactura, conceptos, renglones, clienteId }));
}
