import { hayResend, correoAvisoCliente } from "./correo";
import { enviarPush, tokensDeUsuarios, usuariosClienteDe } from "./push.mjs";
import { mandarAvisoCon, contarDestinatariosCon } from "./avisos-envio.mjs";

/**
 * Los avisos a clientes con sus piezas reales (Resend y Expo) ya puestas.
 * Lo llaman la acción del panel web (app/acciones-avisos.js) y la ruta de la
 * app (app/api/app/avisos/*): las dos pasan por aquí para que nada se
 * desvíe. La lógica vive en lib/avisos-envio.mjs, con pruebas.
 *
 * Solo servidor. Quien llama YA comprobó que es dueño o administrador.
 */

const DEPS = {
  hayResend,
  mandarCorreo: correoAvisoCliente,
  push: { enviarPush, tokensDeUsuarios, usuariosClienteDe },
};

/** @param {{ sbUsuario, sbServicio, datos, idEnvio?, anotar }} p */
export function mandarAvisoServidor(p) {
  return mandarAvisoCon({ ...p, deps: DEPS });
}

export function contarDestinatariosServidor(sbServicio, datos) {
  return contarDestinatariosCon(sbServicio, datos);
}
