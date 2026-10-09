/**
 * POST /api/app/clientes/crear — "Nuevo cliente" desde la app, como el alta
 * de /admin/clientes (6-oct-2026).
 *
 *   Body: { empresa, contacto?, correo?, telefono?, plan?, pase }
 *   → 200 { ok: true, cliente: { uuid, folio, empresa, contacto, correo,
 *           telefono, plan, estado, desde } }
 *   → 200 { ok: false, motivo }
 *   → 401 / 403 (segundoPaso) / 429 / 503 { ok: false, motivo }
 *
 * Sólo nace el expediente de la empresa: NO crea acceso ni contraseña (eso
 * es "Dar acceso", aparte). La fila sale de `filaClienteNuevo`
 * (lib/admin-app.mjs), la misma que usa `crearCliente` de la web, y se
 * inserta con el token del usuario: el RLS decide y la bitácora de la base
 * (db/022) anota a quien la dio de alta.
 */
import { entrarAppAdmin, responder } from "@/lib/app-ruta";
import { supabaseComoUsuario } from "@/lib/app-sesion-usuario";
import { filaClienteNuevo } from "@/lib/admin-app.mjs";

export async function POST(peticion) {
  const r = await entrarAppAdmin(peticion, { permiso: "clientes",
    freno: { nombre: "app-clientes-crear", maximo: 30, minutos: 60 },
  });
  if (r.respuesta) return r.respuesta;

  const revisado = filaClienteNuevo(r.cuerpo);
  if (!revisado.ok) return responder({ ok: false, motivo: revisado.motivo });

  const { data, error } = await supabaseComoUsuario(peticion)
    .from("clientes")
    .insert(revisado.fila)
    .select("id, folio, empresa, contacto, correo, telefono, plan, estado, desde")
    .single();

  if (error || !data) {
    // 23505: el índice único de `clientes.empresa` (db/020). Se dice qué
    // hacer en vez de enseñar "duplicate key value…".
    if (error?.code === "23505") {
      return responder({ ok: false, motivo: "Ya existe un cliente con ese nombre. Búscalo en la lista." });
    }
    return responder({ ok: false, motivo: error?.message || "No se pudo dar de alta. Vuelve a intentarlo." });
  }
  const { id, ...resto } = data;
  return responder({ ok: true, cliente: { uuid: id, ...resto } });
}
