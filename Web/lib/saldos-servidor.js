import { hayResend, correoSaldoResuelto } from "./correo";
import { resolverDepositoCon } from "./saldos-resolver.mjs";

/**
 * Aplicar o rechazar un depósito con el correo de verdad (Resend) ya puesto.
 * Lo llaman el panel web (app/acciones-auditadas.js) y la app
 * (/api/app/saldos/resolver); la lógica vive en lib/saldos-resolver.mjs.
 *
 * Solo servidor. Quien llama YA comprobó que es dueño o administrador.
 *
 * @param {{ sb, actorId, id, estado, notas?, anotar }} p
 */
export function resolverDepositoServidor(p) {
  return resolverDepositoCon({ ...p, deps: { hayResend, correoSaldoResuelto } });
}
