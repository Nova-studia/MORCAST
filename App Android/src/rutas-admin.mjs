/**
 * RUTAS Y PUNTOS PARA LA OFICINA (apps al 100%, 9-oct-2026). Puro, con
 * pruebas en tests/oficina-100.test.mjs.
 */

/**
 * Los puntos de un cliente para "Nueva recolección", como `puntosDeCliente`
 * de la web: con la ruta de su servicio ACTIVO y quién la maneja, para decir
 * quién es "El de la ruta" y avisar cuando nadie la va a ver.
 */
export function puntosParaOficina(filas = []) {
  return (filas || []).map((d) => {
    const s = (d.suscripciones || []).find((x) => x.estado === "activa") || null;
    return {
      id: d.id,
      texto: [d.alias, d.colonia].filter(Boolean).join(" · ") || "Punto sin nombre",
      ruta: s?.rutas?.nombre || "",
      rutaChoferId: s?.rutas?.chofer_id || null,
      rutaChofer: s?.rutas?.chofer || "",
    };
  });
}

export const textoDiasRuta = (dias) => ((dias || []).length ? dias.join(", ") : "Sin días");
