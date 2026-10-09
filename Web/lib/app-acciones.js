import * as C from "./clientes-servidor";
import { editarUsuarioEquipoCon, mandarEnlaceEquipoCon, eliminarUsuarioEquipoCon, detalleEquipoCon } from "./equipo-cuentas.mjs";
import { correoInvitacionEquipo, correoAccesoCliente } from "./correo";
import { enviarPush, tokensDeUsuarios } from "./push.mjs";
import { mensajePushParada } from "./oficina-recolecciones.mjs";
import { leerPermisos } from "./permisos.mjs";
import { puedeEliminarCliente, aplicarPermiso } from "./estado-cliente.mjs";
import { tokenDeCabecera } from "./app-auth.mjs";
import { firmarPase, secretoPanel } from "./mfa.mjs";
import { EMPRESA } from "./datos";
import { destinoPanel } from "./app-acciones-mapa.mjs";
import {
  fichaClienteCon,
  cuentaClienteCon,
  guardarDatosClienteCon,
  cambiarContrasenaServidor,
  crearRecoleccionOficinaCon,
  cambiarSolicitudDeClienteCon,
} from "./apps-servidor";

/**
 * EL TRABAJO DE CADA ACCIÓN DE LAS APPS (9-oct-2026). La puerta (quién puede,
 * con qué sección y freno) está en lib/app-acciones-mapa.mjs y la aplica
 * app/api/app/accion/[nombre]/route.js ANTES de llegar aquí. Cada una reusa
 * la misma función que la acción equivalente de la web.
 *
 * Recibe `{ sb (llave de servicio), usuario, perfil, cuerpo, peticion, anotar, origen }`.
 */

const actorDe = ({ usuario }) => ({ id: usuario.id, correo: usuario.email });
const quienDe = ({ usuario, perfil }) => ({ id: usuario.id, rol: perfil.rol, nombre: perfil.nombre });
const ctxClientes = (x) => ({ sb: x.sb, anotar: x.anotar, actor: actorDe(x) });

/** Un pase de un solo uso (2 min) para abrir el panel web desde la app. */
async function pasePuente(uid) {
  return firmarPase({ uid, sesion: "puente", vence: Math.floor(Date.now() / 1000) + 120 }, secretoPanel());
}

export const MANEJADORES = {
  // ---------------------------------------------------------------- personal
  "mis-permisos": async (x) => {
    const p = await leerPermisos(x.sb, x.usuario.id);
    return { ok: true, rol: p.rol, rolNombre: p.rolNombre, permisos: p.permisos };
  },
  "puente-admin": async (x) => {
    const correo = x.usuario?.email;
    if (!correo) return { ok: false, motivo: "Tu cuenta no tiene correo." };
    const { data, error } = await x.sb.auth.admin.generateLink({ type: "magiclink", email: correo });
    const th = data?.properties?.hashed_token;
    if (error || !th) return { ok: false, motivo: "No se pudo abrir el panel. Inténtalo otra vez." };
    const destino = destinoPanel(x.cuerpo?.destino);
    const sitio = String(EMPRESA.sitio).replace(/\/+$/, "");
    const pp = await pasePuente(x.usuario.id);
    return { ok: true, url: `${sitio}/admin/entrar?th=${encodeURIComponent(th)}&pp=${encodeURIComponent(pp)}&a=${encodeURIComponent(destino)}` };
  },
  "cuenta-contrasena": async (x) =>
    cambiarContrasenaServidor(
      { sbServicio: x.sb, uid: x.usuario.id, correo: x.usuario.email, token: tokenDeCabecera(x.peticion.headers.get("authorization")), anotar: x.anotar },
      x.cuerpo
    ),

  // ---------------------------------------------------------------- cliente
  "cliente-cuenta": async (x) => (x.perfil.cliente_id ? cuentaClienteCon(x.sb, x.perfil.cliente_id) : { ok: false, motivo: "Tu cuenta no tiene empresa." }),
  "cliente-guardar": async (x) =>
    x.perfil.cliente_id
      ? guardarDatosClienteCon({ sb: x.sb, anotar: x.anotar }, { clienteId: x.perfil.cliente_id }, x.cuerpo)
      : { ok: false, motivo: "Tu cuenta no tiene empresa." },
  "solicitud-cambiar": async (x) =>
    x.perfil.cliente_id
      ? cambiarSolicitudDeClienteCon(
          { sb: x.sb, quien: { id: x.usuario.id, cliente_id: x.perfil.cliente_id }, anotar: x.anotar, origen: x.origen },
          { id: x.cuerpo.id, accion: x.cuerpo.accion, fecha: x.cuerpo.fecha, motivo: x.cuerpo.motivo }
        )
      : { ok: false, motivo: "Tu cuenta no tiene empresa." },

  // ---------------------------------------------------------------- clientes (oficina)
  "cliente-ficha": async (x) => {
    const p = await leerPermisos(x.sb, x.usuario.id);
    return fichaClienteCon(x.sb, { clienteId: x.cuerpo.clienteId, rol: x.perfil.rol, permisos: p.permisos });
  },
  "cliente-estado": async (x) =>
    C.cambiarEstadoClienteCon(
      {
        ...ctxClientes(x),
        avisarChoferes: async (lista) => {
          for (const { uid, parada } of lista) {
            const tokens = await tokensDeUsuarios(x.sb, [uid]);
            if (tokens.length) await enviarPush(tokens, mensajePushParada("quitada", parada), { sb: x.sb });
          }
        },
      },
      { clienteId: x.cuerpo.clienteId, estado: x.cuerpo.estado, motivo: x.cuerpo.motivo }
    ),
  "cliente-editar": async (x) => C.editarClienteCon(ctxClientes(x), { clienteId: x.cuerpo.clienteId, cambios: x.cuerpo.cambios || {} }),
  "cliente-eliminar": async (x) => {
    const p = await leerPermisos(x.sb, x.usuario.id);
    if (!puedeEliminarCliente({ rol: x.perfil.rol, permisos: p.permisos })) {
      return { ok: false, motivo: "Solo el dueño (o a quien él le dé el permiso) puede eliminar clientes." };
    }
    return C.eliminarClienteCon(ctxClientes(x), { clienteId: x.cuerpo.clienteId, confirmacion: x.cuerpo.confirmacion });
  },
  "cliente-acceso": async (x) =>
    C.quitarAccesoClienteCon(ctxClientes(x), { clienteId: x.cuerpo.clienteId, perfilId: x.cuerpo.perfilId, activo: x.cuerpo.activo }),
  "cliente-reenviar": async (x) =>
    C.reenviarAccesoClienteCon(
      { ...ctxClientes(x), origen: x.origen, enviarCorreo: correoAccesoCliente },
      { clienteId: x.cuerpo.clienteId, perfilId: x.cuerpo.perfilId }
    ),
  "cliente-punto-agregar": async (x) => C.agregarPuntoCon(ctxClientes(x), { clienteId: x.cuerpo.clienteId, punto: x.cuerpo.punto || {} }),
  "cliente-punto-quitar": async (x) => C.quitarPuntoCon(ctxClientes(x), { clienteId: x.cuerpo.clienteId, domicilioId: x.cuerpo.domicilioId }),
  "cliente-servicio": async (x) =>
    C.cambiarServicioCon(ctxClientes(x), { clienteId: x.cuerpo.clienteId, suscripcionId: x.cuerpo.suscripcionId, estado: x.cuerpo.estado }),

  // ---------------------------------------------------------------- equipo (oficina)
  "usuarios-detalle": async (x) => {
    const r = await detalleEquipoCon({ sb: x.sb });
    if (!r.ok) return r;
    // Solo el personal: los correos de los clientes no salen aquí.
    const { data: equipo } = await x.sb.from("perfiles").select("id").in("rol", ["dueno", "admin", "operador"]);
    const porId = {};
    for (const { id } of equipo || []) if (r.porId[id]) porId[id] = r.porId[id];
    return { ok: true, porId };
  },
  "usuario-editar": async (x) => {
    const datos = { id: x.cuerpo.id, nombre: x.cuerpo.nombre, telefono: x.cuerpo.telefono };
    if (Object.hasOwn(x.cuerpo, "rolId")) datos.rolId = x.cuerpo.rolId;
    return editarUsuarioEquipoCon({ sb: x.sb, quien: quienDe(x), anotar: x.anotar }, datos);
  },
  "usuario-enlace": async (x) =>
    mandarEnlaceEquipoCon({ sb: x.sb, quien: quienDe(x), anotar: x.anotar, origen: x.origen, enviarCorreo: correoInvitacionEquipo }, { id: x.cuerpo.id }),
  "usuario-eliminar": async (x) => eliminarUsuarioEquipoCon({ sb: x.sb, quien: quienDe(x), anotar: x.anotar }, { id: x.cuerpo.id }),
  "usuario-permiso": async (x) => {
    if (x.perfil.rol !== "dueno") return { ok: false, motivo: "Solo el dueño asigna permisos." };
    const { data: actual } = await x.sb.from("perfiles").select("permisos, rol").eq("id", x.cuerpo.perfilId).maybeSingle();
    if (!actual || actual.rol !== "admin") return { ok: false, motivo: "Solo a administradores." };
    let nuevos;
    try {
      nuevos = aplicarPermiso(actual.permisos, x.cuerpo.permiso, Boolean(x.cuerpo.valor));
    } catch (e) {
      return { ok: false, motivo: e.message };
    }
    const { data, error } = await x.sb.from("perfiles").update({ permisos: nuevos }).eq("id", x.cuerpo.perfilId).select("id");
    if (error || !data?.length) return { ok: false, motivo: error?.message || "No se guardó." };
    await x.anotar({ accion: "permiso_cambiado", tabla: "perfiles", registroId: x.cuerpo.perfilId, detalle: { permiso: x.cuerpo.permiso, valor: Boolean(x.cuerpo.valor) } });
    return { ok: true, permisos: nuevos };
  },

  // ---------------------------------------------------------------- recolecciones (oficina)
  "recoleccion-crear": async (x) =>
    crearRecoleccionOficinaCon({ sb: x.sb, sbServicio: x.sb, actor: actorDe(x), anotar: x.anotar }, x.cuerpo),
};
