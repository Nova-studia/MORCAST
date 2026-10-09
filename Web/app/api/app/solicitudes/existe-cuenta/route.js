/**
 * POST /api/app/solicitudes/existe-cuenta — ¿ya hay una cuenta con este
 * correo? Lo pregunta la ficha de una solicitud GANADA para no ofrecer
 * "Activar" sobre algo ya activado (igual que `existeCuenta` de la web).
 *
 *   Body: { correo, pase }
 *   → 200 { ok: true, existe: bool }
 *   → 401 / 403 (segundoPaso) / 429 / 503 { ok: false, motivo }
 */
import { entrarAppAdmin, responder } from "@/lib/app-ruta";
import { existeCuentaCon } from "@/lib/cuentas-servidor";

export async function POST(peticion) {
  const r = await entrarAppAdmin(peticion, { permiso: "solicitudes",
    freno: { nombre: "app-solicitudes-existe", maximo: 120, minutos: 60 },
  });
  if (r.respuesta) return r.respuesta;

  const correo = typeof r.cuerpo.correo === "string" ? r.cuerpo.correo : "";
  return responder(await existeCuentaCon(r.sb, correo));
}
