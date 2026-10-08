/**
 * POST /api/app/altas/activar — "Activar cuenta" de Altas de clientes desde
 * la app, para quien se registró con Google (6-oct-2026, paridad con
 * /admin/altas).
 *
 *   Authorization: Bearer <token de un dueño o administrador>
 *   Body: { solicitudId, pase }
 *   → 200 { ok: true, cliente: { id, folio, empresa }, correo, password,
 *           avisoPunto, puntoId }
 *   → 200 { ok: false, motivo }          (ya activada, sin cuenta ligada…)
 *   → 400 { ok: false, motivo }          (id malo)
 *   → 401 / 403 (segundoPaso) / 429 / 503 { ok: false, motivo }
 *
 * El trabajo es `activarCuentaRegistradaCon` (lib/cuentas-servidor.js), el
 * MISMO de la web: empresa, sello, perfil, punto de recolección con el pin
 * del cliente, correo y bitácora.
 *
 * La contraseña: en la web la genera el navegador del admin; aquí la genera
 * el servidor con `randomBytes` (no todos los teléfonos traen un generador
 * criptográfico sin un módulo nativo de más) con el MISMO alfabeto
 * (lib/admin-app.mjs). Viaja UNA vez en la respuesta para que el admin se la
 * mande al cliente; no se guarda, no va a la bitácora ni a ningún log.
 */
import { randomBytes } from "node:crypto";
import { entrarAppAdmin, responder } from "@/lib/app-ruta";
import { anotarBitacora } from "@/lib/app-auth.mjs";
import { activarCuentaRegistradaCon } from "@/lib/cuentas-servidor";
import { contrasenaLegible, esId } from "@/lib/admin-app.mjs";

export async function POST(peticion) {
  const r = await entrarAppAdmin(peticion, {
    freno: { nombre: "app-altas-activar", maximo: 20, minutos: 60 },
  });
  if (r.respuesta) return r.respuesta;

  const solicitudId = typeof r.cuerpo.solicitudId === "string" ? r.cuerpo.solicitudId.trim().toLowerCase() : "";
  if (!esId(solicitudId)) return responder({ ok: false, motivo: "Esa solicitud no existe." }, 400);

  const password = contrasenaLegible(randomBytes(12));
  const res = await activarCuentaRegistradaCon(
    { sb: r.sb, anotar: (e) => anotarBitacora(r.sb, { usuario: r.usuario, ...e }) },
    { solicitudId, password }
  );
  if (!res.ok) return responder({ ok: false, motivo: res.motivo });
  // Cuenta de Apple: se activó sin contraseña, así que no se manda ninguna.
  return responder(res.sinContrasena ? res : { ...res, password });
}
