import { AVISO_BAJA } from "./web/estado-cliente.mjs";

/**
 * ¿LA SESIÓN GUARDADA TODAVÍA VALE? (9-oct-2026, apps al 100%) — lógica pura.
 *
 * Al abrir, la app entra con la sesión guardada en el teléfono (`getSession`,
 * sin red: ver sesion.js). Si a la cuenta la dieron de BAJA (Supabase la
 * banea) o la borraron, esa sesión ya no sirve y la app seguía "dentro",
 * con pantallas vacías y errores de permiso. Ahora se pregunta al servidor
 * (`getUser`) en segundo plano y, si la respuesta es "esta sesión ya no
 * vale", se cierra y se dice por qué.
 *
 * 🔴 Lo importante es NO confundir eso con falta de señal: sacar a un chofer
 * de su ruta porque pasó por un túnel sería peor que el problema. Ante un
 * error que no se reconoce, la respuesta es "red" (no se toca nada).
 */
export const SESION_VENCIDA = "Tu sesión se venció. Vuelve a entrar.";

const CODIGOS_SESION = new Set([
  "session_not_found", "session_expired", "bad_jwt", "user_not_found", "refresh_token_not_found",
  "refresh_token_already_used", "no_authorization",
]);

/** "ok" | "baja" | "sesion" | "red" */
export function quePasaConLaSesion(error) {
  if (!error) return "ok";
  const nombre = String(error.name || "");
  const codigo = String(error.code || "").toLowerCase();
  const texto = `${nombre} ${codigo} ${error.message || ""}`.toLowerCase();
  const estado = Number(error.status) || 0;

  if (/banned/.test(texto)) return "baja";
  if (nombre === "AuthRetryableFetchError" || /network|failed to fetch|timeout|timed out|abort/.test(texto)) return "red";
  if (estado === 0 && !CODIGOS_SESION.has(codigo) && nombre !== "AuthSessionMissingError") return "red";
  if (estado >= 500) return "red";
  if (nombre === "AuthSessionMissingError" || CODIGOS_SESION.has(codigo) || [401, 403, 404].includes(estado)) return "sesion";
  return "red";
}

/** El mensaje del login al sacar a alguien; null si no hay que sacarlo. */
export function avisoDeSalida(que) {
  if (que === "baja") return AVISO_BAJA;
  if (que === "sesion") return SESION_VENCIDA;
  return null;
}
