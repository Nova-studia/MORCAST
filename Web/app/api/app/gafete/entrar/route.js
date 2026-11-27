/**
 * POST /api/app/gafete/entrar — entrar a la app acercando el gafete, SIN
 * sesión (27-nov-2026). Diseño: docs/superpowers/specs/2026-11-27-entrar-con-gafete-design.md
 *   Body: { codigo, serie, dispositivoId, secreto }
 *   → 200 { ok:true, sesion:{ access_token, refresh_token }, pase?, vence?, bienvenida:{ nombre, saludo, puesto } }
 *         la app hace setSession; `pase` = segundo paso del dueño y los admins
 *   → 401 { ok:false, motivo }     siempre el mismo texto, falle lo que falle
 *   → 423 { ok:false, motivo, usaCorreo:true }   4.º fallo seguido en este teléfono
 *   → 429 freno · 503 sin base
 *
 * TODO EN UN VIAJE (prueba en aparato del 27-nov: tardaba ~1.7 s en cuatro
 * viajes). Aquí se canjea el enlace por la sesión y se firma el pase, que
 * antes pedía la app en llamadas aparte. La bitácora y el "último uso" se
 * anotan DESPUÉS de contestar (`after`).
 * El correo sale de la cuenta ligada al empleado, nunca del cuerpo.
 */
import { after } from "next/server";
import { responder } from "@/lib/app-ruta";
import { haySupabase, supabaseServidor } from "@/lib/supabase";
import { pasarFreno } from "@/lib/freno";
import { anotarBitacora, MENSAJES_APP } from "@/lib/app-auth.mjs";
import { firmarPase, secretoPanel, sesionDelToken, VIGENCIA_PASE_S } from "@/lib/mfa.mjs";
import {
  validarPeticion, decidirEntrada, respuestaEntrar, hashSecreto, clavesFreno,
  vinculoExigePase, puedeDarPase, bienvenidaDe,
} from "@/lib/gafete-acceso.mjs";
import { leerParaEntrar, contarFallo, anotarUso, abrirSesion } from "@/lib/gafete-acceso-servidor";

export async function POST(peticion) {
  if (!haySupabase()) return responder({ ok: false, motivo: MENSAJES_APP.demo }, 503);

  let cuerpo = {};
  try { cuerpo = (await peticion.json()) || {}; } catch { /* se valida abajo */ }
  const p = validarPeticion(cuerpo);
  const generico = respuestaEntrar({ ok: false, motivo: "noEntra" });
  if (!p.ok) return responder(generico.cuerpo, generico.status);

  // Por IP (bots) y por gafete+teléfono, a la vez. NUNCA por código solo: es
  // público (QR) y con su foto se bloquearía al dueño (ver `clavesFreno`).
  const frenos = await Promise.all([
    pasarFreno("app-gafete-ip", { maximo: 30, minutos: 15 }),
    ...clavesFreno(p).map((clave) => pasarFreno(clave, { maximo: 10, minutos: 15, porIp: false })),
  ]);
  if (frenos.includes(false)) return responder({ ok: false, motivo: MENSAJES_APP.freno }, 429);

  const sb = supabaseServidor();
  try {
    const [datos, hashRecibido] = await Promise.all([leerParaEntrar(sb, p.codigo, p.dispositivoId), hashSecreto(p.secreto)]);
    const decision = decidirEntrada({ ...datos, serie: p.serie, hashRecibido });
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
    const sesion = await abrirSesion(tokenHash);

    // El pase del segundo paso, atado al session_id de ESTA sesión, solo si el
    // vínculo se hizo con segundo paso (`puedeDarPase`).
    let pase = null;
    let vence = null;
    const secreto = secretoPanel();
    const sesionId = sesionDelToken(sesion.access_token);
    if (vinculoExigePase(datos.perfil.rol) && puedeDarPase({ par: datos.par, uid: datos.perfil.id }) && secreto && sesionId) {
      vence = Math.floor(Date.now() / 1000) + VIGENCIA_PASE_S;
      pase = await firmarPase({ uid: datos.perfil.id, sesion: sesionId, vence }, secreto);
    }

    after(async () => {
      const usuario = { id: datos.perfil.id, email: correo };
      await anotarUso(sb, datos.par.id).catch((e) => console.error("[gafete/entrar] último uso:", e?.message || e));
      await anotarBitacora(sb, {
        usuario, accion: "gafete_entrar", tabla: "gafetes", registroId: datos.gafete.id, detalle: { telefono: datos.par.id },
      });
      if (pase) {
        await anotarBitacora(sb, {
          usuario, accion: "entrar_panel", tabla: "perfiles", registroId: datos.perfil.id, detalle: { metodo: "gafete" },
        });
      }
    });

    return responder({
      ok: true,
      sesion: { access_token: sesion.access_token, refresh_token: sesion.refresh_token },
      pase,
      vence,
      bienvenida: bienvenidaDe(datos.empleado),
    });
  } catch (e) {
    console.error("[gafete/entrar]", e?.message || e);
    return responder({ ok: false, motivo: MENSAJES_APP.fallo }, 500);
  }
}
