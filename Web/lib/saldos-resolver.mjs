/**
 * APLICAR O RECHAZAR UN DEPÓSITO — una sola copia para el panel web
 * (app/acciones-auditadas.js: resolverDepositoAuditado) y la app
 * (/api/app/saldos/resolver).
 *
 * Por qué se sacó aquí (6-oct-2026): la app aplicaba los depósitos con un
 * UPDATE directo desde el teléfono, sin bitácora y sin el correo de "saldo
 * resuelto" al cliente. Aquí se mueve dinero: las dos puertas tienen que
 * dejar la misma huella y avisar igual.
 *
 * Lo que NO cambia: el UPDATE va con la SESIÓN del usuario (`sb`), no con la
 * llave de servicio. El RLS sigue siendo el guardia; esto añade auditoría.
 * Y se cuentan las filas devueltas: un UPDATE que el RLS bloquea no da
 * error, cambia cero filas y responde 200.
 *
 * Sin imports de Next ni de Supabase (correo y bitácora llegan en los
 * parámetros), para probarlo con `node --test` (tests/saldos-resolver.test.mjs).
 */

export const ESTADOS_RESOLUCION = ["aplicada", "rechazada"];
export const MAX_NOTAS = 500;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lo que llega de la pantalla, limpio. `{ ok, limpio }` o `{ ok:false, motivo }`. */
export function validarResolucion({ id, estado, notas } = {}) {
  const idLimpio = String(id ?? "").trim();
  if (!UUID_RE.test(idLimpio)) return { ok: false, motivo: "No se encontró ese depósito. Recarga la lista." };
  if (!ESTADOS_RESOLUCION.includes(estado)) return { ok: false, motivo: "Elige si el depósito se aplica o se rechaza." };
  const n = notas == null ? "" : String(notas).trim();
  if (n.length > MAX_NOTAS) return { ok: false, motivo: `La nota es muy larga (máximo ${MAX_NOTAS} caracteres).` };
  return { ok: true, limpio: { id: idLimpio, estado, notas: n || null } };
}

/**
 * Los avisos NO pueden tumbar la operación (mismo criterio que
 * acciones-auditadas.js): si Resend falla o no está, el saldo ya quedó
 * aplicado en la base, que es la fuente de la verdad; el fallo se ANOTA.
 */
async function avisar(que, fn, { hayResend, log }) {
  if (!hayResend()) {
    log.warn(`[avisos] ${que}: no se mandó, falta RESEND_API_KEY`);
    return;
  }
  try {
    await fn();
  } catch (e) {
    log.error(`[avisos] ${que}: no se pudo mandar —`, e?.message || e);
  }
}

/**
 * @param {{
 *   sb: object,          // con la SESIÓN del usuario (el RLS decide)
 *   actorId: string,     // quién verifica (sale de la sesión, nunca del cuerpo)
 *   id: string, estado: "aplicada"|"rechazada", notas?: string,
 *   anotar: (entrada) => Promise<void>,
 *   deps: { hayResend: () => boolean, correoSaldoResuelto: (d) => Promise<any>, log?: object }
 * }} p
 * @returns {Promise<{ ok: true, yaEstaba?: true } | { ok: false, motivo: string }>}
 */
export async function resolverDepositoCon({ sb, actorId, id, estado, notas, anotar, deps }) {
  const { hayResend, correoSaldoResuelto, log = console } = deps;

  const v = validarResolucion({ id, estado, notas });
  if (!v.ok) return v;
  const { limpio } = v;

  // `.neq("estado", …)`: aplicar dos veces lo mismo (doble toque, o la app
  // que reintenta porque se cayó la señal después de que sí se guardó) no
  // vuelve a escribir, ni a anotar, ni a mandarle otro correo al cliente.
  const { data, error } = await sb
    .from("movimientos_saldo")
    .update({ estado: limpio.estado, notas: limpio.notas, verificado_por: actorId })
    .eq("id", limpio.id)
    .neq("estado", limpio.estado)
    .select("id, folio, monto, cliente_id, clientes ( empresa, correo )");

  if (error) return { ok: false, motivo: error.message };
  if (!data?.length) {
    // ¿Cero filas porque ya estaba así, o porque el RLS no deja? Se pregunta
    // con la misma sesión: si el RLS no lo deja ver, tampoco lo deja tocar.
    const { data: actual } = await sb
      .from("movimientos_saldo")
      .select("id, estado")
      .eq("id", limpio.id)
      .maybeSingle();
    if (actual?.estado === limpio.estado) return { ok: true, yaEstaba: true };
    return {
      ok: false,
      motivo: "No se cambió nada: el permiso de la base no te deja tocar ese movimiento.",
    };
  }

  const fila = data[0];
  await anotar({
    accion: limpio.estado === "aplicada" ? "aplicar_saldo" : "rechazar_saldo",
    tabla: "movimientos_saldo",
    registroId: limpio.id,
    detalle: {
      folio: fila.folio,
      monto: Number(fila.monto),
      cliente_id: fila.cliente_id,
      notas: limpio.notas,
    },
  });

  await avisar(
    "saldo resuelto",
    () =>
      correoSaldoResuelto({
        correo: fila.clientes?.correo,
        empresa: fila.clientes?.empresa,
        monto: Number(fila.monto),
        aplicado: limpio.estado === "aplicada",
        notas: limpio.notas,
      }),
    { hayResend, log }
  );

  return { ok: true };
}
