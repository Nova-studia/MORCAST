import { haySupabase } from "./supabase";
import { accionAdmin } from "./accion";

/**
 * LA FICHA DEL CLIENTE DESDE LA APP (apps al 100%, fase C). Todo va por la
 * web (`/api/app/accion/cliente-*`, con el pase del segundo paso): son las
 * mismas funciones que usa /admin/clientes/[id], con su bitácora, sus avisos
 * a los choferes y la regla de quién puede eliminar. Nunca lanzan; devuelven
 * `{ ok, motivo?, sinRed?, segundoPaso? }`.
 *
 * Sin base (demostración) contestan "listo" sin hacer nada.
 */
const DEMO = { ok: true, demo: true };
const enDemo = (r) => (haySupabase() ? r() : Promise.resolve(DEMO));

export async function fichaCliente(clienteId) {
  if (!haySupabase()) {
    return {
      ok: true,
      demo: true,
      cliente: { id: clienteId, folio: "MOR-DEMO", empresa: "Cliente de demostración", estado: "activo" },
      puntos: [],
      solicitudes: [],
      movimientos: [],
      usuarios: [],
      conteos: {},
      puedeEliminar: false,
    };
  }
  return accionAdmin("cliente-ficha", { clienteId });
}

export const cambiarEstadoCliente = ({ clienteId, estado, motivo }) =>
  enDemo(() => accionAdmin("cliente-estado", { clienteId, estado, motivo }));

export const editarCliente = ({ clienteId, cambios }) =>
  enDemo(() => accionAdmin("cliente-editar", { clienteId, cambios }));

export const eliminarCliente = ({ clienteId, confirmacion }) =>
  enDemo(() => accionAdmin("cliente-eliminar", { clienteId, confirmacion }));

export const accesoUsuarioCliente = ({ clienteId, perfilId, activo }) =>
  enDemo(() => accionAdmin("cliente-acceso", { clienteId, perfilId, activo: Boolean(activo) }));

export const reenviarAccesoCliente = ({ clienteId, perfilId }) =>
  enDemo(() => accionAdmin("cliente-reenviar", { clienteId, perfilId }));

export const agregarPunto = ({ clienteId, punto }) =>
  enDemo(() => accionAdmin("cliente-punto-agregar", { clienteId, punto }));

export const quitarPunto = ({ clienteId, domicilioId }) =>
  enDemo(() => accionAdmin("cliente-punto-quitar", { clienteId, domicilioId }));

export const cambiarServicio = ({ clienteId, suscripcionId, estado }) =>
  enDemo(() => accionAdmin("cliente-servicio", { clienteId, suscripcionId, estado }));
