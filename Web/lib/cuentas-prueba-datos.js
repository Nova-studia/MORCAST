"use client";

/**
 * Los ids de las cuentas de revisión (MOR-DEMO-*, `clientes.es_prueba`,
 * db/027), para quitarlas de totales, reportes y listas del PANEL. Se piden
 * una vez por carga de página. Si la consulta falla, conjunto vacío: el panel
 * sigue funcionando (contaría las de prueba, que es lo de antes).
 */
import { supabaseNavegador, haySupabaseNavegador } from "@/lib/supabase-navegador";

let pendiente = null;

export function idsCuentasPrueba() {
  if (!haySupabaseNavegador()) return Promise.resolve(new Set());
  if (!pendiente) {
    pendiente = supabaseNavegador()
      .from("clientes")
      .select("id")
      .eq("es_prueba", true)
      .then(({ data, error }) => {
        if (error) {
          console.error("[cuentas de revisión] No se pudieron leer:", error.message);
          pendiente = null;
          return new Set();
        }
        return new Set((data || []).map((c) => c.id));
      });
  }
  return pendiente;
}
