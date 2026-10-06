/**
 * POST /api/app/clientes/dar-acceso — "Dar acceso" al portal a un cliente que
 * ya está en la base, como /admin/clientes.
 *
 *   Body: { clienteId (uuid), pase }
 *   → 200 { ok: true, correo, folio } | { ok: false, motivo }
 *   → 400 / 401 / 403 (segundoPaso) / 429 / 503 { ok: false, motivo }
 *
 * `darAccesoAClienteCon` (lib/cuentas-servidor.js) es el de la web: la regla
 * `puedeRecibirAcceso` ("Ya tiene acceso" / "Sin correo"), la guardia de no
 * sellar a personal ni a otra empresa, el correo con el enlace para que el
 * cliente escoja su contraseña y el deshacer si algo truena. Nadie ve
 * ninguna contraseña.
 */
import { entrarAppAdmin, responder } from "@/lib/app-ruta";
import { anotarBitacora } from "@/lib/app-auth.mjs";
import { origenPermitido } from "@/lib/origen.mjs";
import { darAccesoAClienteCon } from "@/lib/cuentas-servidor";
import { esId } from "@/lib/admin-app.mjs";

export async function POST(peticion) {
  // Cada llamada puede crear un usuario y mandar un correo.
  const r = await entrarAppAdmin(peticion, {
    freno: { nombre: "app-clientes-acceso", maximo: 20, minutos: 60 },
  });
  if (r.respuesta) return r.respuesta;

  const clienteId = typeof r.cuerpo.clienteId === "string" ? r.cuerpo.clienteId.trim().toLowerCase() : "";
  if (!esId(clienteId)) return responder({ ok: false, motivo: "No se encontró ese cliente." }, 400);

  const res = await darAccesoAClienteCon(
    {
      sb: r.sb,
      anotar: (e) => anotarBitacora(r.sb, { usuario: r.usuario, ...e }),
      origen: origenPermitido(peticion.headers),
    },
    { clienteId }
  );
  return responder(res);
}
