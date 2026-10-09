/**
 * POST /api/app/usuarios/invitar — "Invitar usuario" de Usuarios y roles.
 *
 *   Body: { nombre, correo, rol: "admin"|"operador", pase }
 *   → 200 { ok: true, correo, rol } | { ok: false, motivo }
 *   → 401 / 403 (segundoPaso o sin permiso) / 429 / 503 { ok: false, motivo }
 *
 * `invitarUsuarioEquipoCon` (lib/equipo-servidor.js) es el de la web, con
 * sus reglas de lib/equipo.mjs: el dueño invita administradores y choferes;
 * un administrador, sólo choferes ("solo el dueño da acceso administrativo",
 * 4-oct-2026). Esa regla depende del ROL que se pide, así que la puerta es
 * `entrarAppAdmin` normal y la decisión la toma `puedeDarRol` con el rol que
 * dice la BASE de quien llama. `soloDueno` para todo le quitaría al
 * administrador invitar choferes, que en la web sí puede.
 */
import { entrarAppAdmin, responder } from "@/lib/app-ruta";
import { anotarBitacora } from "@/lib/app-auth.mjs";
import { origenPermitido } from "@/lib/origen.mjs";
import { invitarUsuarioEquipoCon } from "@/lib/equipo-servidor";

export async function POST(peticion) {
  const r = await entrarAppAdmin(peticion, { permiso: "usuarios",
    freno: { nombre: "app-usuarios-invitar", maximo: 20, minutos: 60 },
  });
  if (r.respuesta) return r.respuesta;

  // rolId (Entrega 2): el rol personalizado del admin invitado; sin él, el completo.
  const { nombre, correo, rol, rolId } = r.cuerpo;
  const res = await invitarUsuarioEquipoCon(
    {
      sb: r.sb,
      quien: { id: r.usuario.id, rol: r.perfil.rol, nombre: r.perfil.nombre },
      anotar: (e) => anotarBitacora(r.sb, { usuario: r.usuario, ...e }),
      origen: origenPermitido(peticion.headers),
    },
    { nombre, correo, rol, rolId }
  );
  return responder(res);
}
