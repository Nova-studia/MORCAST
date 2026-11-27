/**
 * POST /api/app/gafete/entrar — entrar a la app acercando el gafete, SIN
 * sesión (27-nov-2026). Diseño: docs/superpowers/specs/2026-11-27-entrar-con-gafete-design.md
 *   Body: { codigo, serie, dispositivoId, secreto }
 *   → 200 { ok:true, tokenHash }   la app hace verifyOtp({ token_hash, type:"magiclink" })
 *   → 401 { ok:false, motivo }     siempre el mismo texto, falle lo que falle
 *   → 423 { ok:false, motivo, usaCorreo:true }   4.º fallo seguido en este teléfono
 *   → 429 freno · 503 sin base
 * El correo sale de la cuenta ligada al empleado, nunca del cuerpo.
 * generateLink NO manda correo (igual que api/app/puente-web).
 */
import { responder } from "@/lib/app-ruta";
import { haySupabase, supabaseServidor } from "@/lib/supabase";
import { pasarFreno } from "@/lib/freno";
import { anotarBitacora, MENSAJES_APP } from "@/lib/app-auth.mjs";
import { validarPeticion, decidirEntrada, respuestaEntrar, hashSecreto, clavesFreno } from "@/lib/gafete-acceso.mjs";
import { leerParaEntrar, contarFallo, anotarUso } from "@/lib/gafete-acceso-servidor";

export async function POST(peticion) {
  if (!haySupabase()) return responder({ ok: false, motivo: MENSAJES_APP.demo }, 503);

  let cuerpo = {};
  try { cuerpo = (await peticion.json()) || {}; } catch { /* se valida abajo */ }
  const p = validarPeticion(cuerpo);
  const generico = respuestaEntrar({ ok: false, motivo: "noEntra" });
  if (!p.ok) return responder(generico.cuerpo, generico.status);

  // Por IP (bots) y por gafete+teléfono. NUNCA por código solo: es público
  // (QR) y con su foto se bloquearía al dueño (ver `clavesFreno`).
  let pasa = await pasarFreno("app-gafete-ip", { maximo: 30, minutos: 15 });
  for (const clave of clavesFreno(p)) {
    if (pasa) pasa = await pasarFreno(clave, { maximo: 10, minutos: 15, porIp: false });
  }
  if (!pasa) return responder({ ok: false, motivo: MENSAJES_APP.freno }, 429);

  const sb = supabaseServidor();
  try {
    const datos = await leerParaEntrar(sb, p.codigo, p.dispositivoId);
    const decision = decidirEntrada({ ...datos, serie: p.serie, hashRecibido: await hashSecreto(p.secreto) });
    if (!decision.ok) {
      if (decision.contarFallo) await contarFallo(sb, p.dispositivoId);
      const r = respuestaEntrar(decision);
      return responder(r.cuerpo, r.status);
    }

    const { data: cuenta, error: errCuenta } = await sb.auth.admin.getUserById(datos.perfil.id);
    const correo = cuenta?.user?.email;
    if (errCuenta || !correo) throw new Error(errCuenta?.message || "la cuenta no tiene correo");
    const { data, error } = await sb.auth.admin.generateLink({ type: "magiclink", email: correo });
    const tokenHash = data?.properties?.hashed_token;
    if (error || !tokenHash) throw new Error(error?.message || "sin hashed_token");

    await anotarUso(sb, datos.par.id);
    await anotarBitacora(sb, {
      usuario: { id: datos.perfil.id, email: correo },
      accion: "gafete_entrar",
      tabla: "gafetes",
      registroId: datos.gafete.id,
      detalle: { telefono: datos.par.id },
    });
    return responder({ ok: true, tokenHash });
  } catch (e) {
    console.error("[gafete/entrar]", e?.message || e);
    return responder({ ok: false, motivo: MENSAJES_APP.fallo }, 500);
  }
}
