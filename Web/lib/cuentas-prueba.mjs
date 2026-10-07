/**
 * CUENTAS DE REVISIÓN (MOR-DEMO-*, `clientes.es_prueba`, db/027).
 * Apple y Google las usan para revisar las apps: siguen funcionando, pero
 * NO cuentan en los totales, reportes ni listas de operación del panel
 * (pedido de Luis, 7-oct-2026: "tiene que estar todo en 0").
 */
export function sinCuentasDePrueba(filas, campo = "cliente") {
  return (filas || []).filter((f) => f?.[campo]?.es_prueba !== true);
}
export function idsDePrueba(clientes) {
  return new Set((clientes || []).filter((c) => c.es_prueba).map((c) => c.id));
}

/**
 * A una consulta de supabase-js le quita las filas de cuentas de revisión:
 * `.not(campo, "in", "(id1,id2)")`. Si no hay cuentas de prueba no la toca
 * (un `in ()` vacío es un error de PostgREST).
 */
export function sinPruebasEnConsulta(consulta, ids, campo = "cliente_id") {
  const lista = [...(ids || [])];
  if (!lista.length) return consulta;
  return consulta.not(campo, "in", `(${lista.join(",")})`);
}
