/**
 * POST /api/app/segundo-paso/verificar — la app manda el código que llegó al
 * correo y recibe el pase de ESTA sesión.
 *
 *   Authorization: Bearer <access_token de Supabase>
 *   Body: { codigo: "123456" }
 *   → 200 { ok: true, pase, vence }   `vence` en segundos Unix
 *   → 400 { ok: false, motivo }       (incorrecto, vencido, sin intentos…)
 *   → 401 / 403 / 429 / 503 { ok: false, motivo }
 *
 * El pase es el mismo de la web (lib/mfa.mjs): firmado con HMAC y amarrado al
 * usuario y al `session_id` del token. Si la persona cierra sesión y vuelve a
 * entrar, la sesión es otra y el pase ya no sirve: se pide código otra vez.
 * La app lo guarda en el almacenamiento seguro (Keychain / Keystore) y lo
 * revisa con /api/app/segundo-paso/estado.
 *
 * Protege la PANTALLA de administración de la app, no la base (lib/mfa.mjs).
 */
import { entrarApp, responder } from "@/lib/app-ruta";
import { ROLES_PERSONAL, anotarBitacora } from "@/lib/app-auth.mjs";
import { verificarCodigo } from "@/lib/segundo-paso.mjs";
import { secretoPanel } from "@/lib/mfa.mjs";

export async function POST(peticion) {
  // Cada código ya trae su tope de 5 intentos; este freno cuida que nadie
  // pida códigos nuevos sin parar para seguir adivinando.
  const r = await entrarApp(peticion, {
    roles: ROLES_PERSONAL,
    freno: { nombre: "app-2p-verificar", maximo: 20, minutos: 15 },
  });
  if (r.respuesta) return r.respuesta;

  const res = await verificarCodigo({
    usuario: r.usuario,
    sesion: r.sesion,
    codigo: r.cuerpo.codigo,
    sb: r.sb,
    secreto: secretoPanel(),
  });
  if (!res.ok) return responder(res, 400);

  await anotarBitacora(r.sb, {
    usuario: r.usuario,
    accion: "entrar_panel",
    tabla: "perfiles",
    registroId: r.usuario.id,
    detalle: { metodo: "codigo_correo" },
  });
  return responder({ ok: true, pase: res.pase, vence: res.vence });
}
