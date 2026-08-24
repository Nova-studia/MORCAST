import { useEffect, useState } from "react";
import { CLIENTE } from "./datos";
import { miEmpresa } from "./datos-remoto";
import { haySupabase } from "./supabase";

/**
 * Los datos de LA empresa del cliente que tiene la sesión.
 *
 * Existe para que ninguna pantalla vuelva a firmar un documento con la
 * empresa de ejemplo. El manifiesto, la cotización y el reporte llevan razón
 * social, RFC y número de contrato: si ahí va "Industrias del Golfo", el
 * cliente descarga un papel que no es suyo.
 *
 * Devuelve dos cosas:
 *
 *  · `empresa` — lo que se PINTA. Sin base conectada (modo demostración) es
 *    el ejemplo, que ahí sí es lo correcto: no hay sesión de nadie.
 *
 *  · `puedeImprimir` — si eso ya se puede IMPRIMIR. Con base conectada,
 *    mientras la consulta no haya vuelto con datos reales esto es `false`, y
 *    la pantalla debe negarse a generar el PDF. Un documento fiscal en blanco se corrige;
 *    uno con los datos de otra empresa, no.
 */
export function useMiEmpresa() {
  const [empresa, setEmpresa] = useState(null);
  const [cargando, setCargando] = useState(haySupabase());

  useEffect(() => {
    if (!haySupabase()) return;
    let vivo = true;
    miEmpresa()
      .then((e) => { if (vivo) { setEmpresa(e); setCargando(false); } })
      .catch(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, []);

  return {
    empresa: empresa || CLIENTE,
    puedeImprimir: Boolean(empresa) || !haySupabase(),
    cargando,
  };
}

/** El aviso que se le da al cliente cuando todavía no se puede firmar el PDF. */
export function avisoSinEmpresa(cargando) {
  return cargando
    ? ["Un momento", "Todavía estamos leyendo los datos de tu empresa. Vuelve a intentarlo en unos segundos."]
    : ["No se pudo generar", "No pudimos leer los datos de tu empresa, y sin ellos el documento saldría a nombre de nadie. Cierra sesión y vuelve a entrar; si sigue igual, avísanos."];
}
