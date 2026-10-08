/**
 * Los ids de las cuentas de revisión de Apple y Google (MOR-DEMO-*,
 * `clientes.es_prueba`, db/027), para quitarlas de totales, reportes y listas
 * del MODO ADMINISTRACIÓN (8-oct-2026, igual que la web). Se piden una vez por
 * sesión. Si fallan, conjunto vacío: el panel sigue funcionando.
 */
import { supabase, haySupabase } from "./supabase";

let pendiente = null;

export function idsCuentasPrueba() {
  if (!haySupabase()) return Promise.resolve(new Set());
  if (!pendiente) {
    pendiente = supabase
      .from("clientes")
      .select("id")
      .eq("es_prueba", true)
      .then(({ data, error }) => {
        if (error) {
          console.warn("[cuentas de revisión] No se pudieron leer:", error.message);
          pendiente = null;
          return new Set();
        }
        return new Set((data || []).map((c) => c.id));
      });
  }
  return pendiente;
}

/** Al cerrar sesión: la siguiente cuenta vuelve a preguntar. */
export function olvidarCuentasPrueba() {
  pendiente = null;
}
