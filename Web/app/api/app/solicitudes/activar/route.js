/**
 * POST /api/app/solicitudes/activar — "Activar cuenta de cliente" de una
 * solicitud de cotización GANADA, desde la app (antes mandaba a la web).
 *
 *   Body: { cotizacionId, empresa, contacto, telefono, correo, password?, pase }
 *   → 200 { ok: true, cliente: { id, folio, empresa }, correo, password, generada }
 *   → 200 { ok: false, motivo }          (correo ya usado, empresa repetida…)
 *   → 401 / 403 (segundoPaso) / 429 / 503 { ok: false, motivo }
 *
 * Es `activarCuentaClienteCon` (lib/cuentas-servidor.js), el MISMO de la web:
 * crea el usuario, la empresa y el perfil, marca la solicitud como ganada y
 * deja la bitácora (sin la contraseña).
 *
 * Si el admin no escribió contraseña, la genera el servidor con el alfabeto
 * legible de lib/admin-app.mjs (`generada: true`). La contraseña vuelve UNA
 * vez en la respuesta para mandársela al cliente; no se guarda en ningún
 * lado, ni en la bitácora ni en los logs.
 */
import { randomBytes } from "node:crypto";
import { entrarAppAdmin, responder } from "@/lib/app-ruta";
import { anotarBitacora } from "@/lib/app-auth.mjs";
import { activarCuentaClienteCon } from "@/lib/cuentas-servidor";
import { contrasenaLegible, esId } from "@/lib/admin-app.mjs";

export async function POST(peticion) {
  const r = await entrarAppAdmin(peticion, { permiso: "solicitudes",
    freno: { nombre: "app-solicitudes-activar", maximo: 20, minutos: 60 },
  });
  if (r.respuesta) return r.respuesta;

  const { cotizacionId, empresa, contacto, telefono, correo } = r.cuerpo;
  const escrita = typeof r.cuerpo.password === "string" ? r.cuerpo.password : "";
  const generada = !escrita;
  const password = generada ? contrasenaLegible(randomBytes(12)) : escrita;

  const res = await activarCuentaClienteCon(
    { sb: r.sb, anotar: (e) => anotarBitacora(r.sb, { usuario: r.usuario, ...e }) },
    {
      cotizacionId: esId(cotizacionId) ? cotizacionId : null,
      empresa,
      contacto,
      telefono,
      correo,
      password,
    }
  );
  if (!res.ok) return responder({ ok: false, motivo: res.motivo });
  return responder({ ...res, password, generada });
}
