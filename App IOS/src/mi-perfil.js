import { useEffect, useState } from "react";
import { sesionActiva } from "./sesion";
import { haySupabase } from "./supabase";
import { ADMIN_PERFIL } from "./datos-admin";
import { CHOFER_PERFIL } from "./datos-chofer";

const DEMO = { admin: ADMIN_PERFIL, chofer: CHOFER_PERFIL };

/**
 * El perfil de QUIEN tiene la sesión, para el admin y el chofer.
 *
 * Es el gemelo de `useMiEmpresa()` del cliente y existe por la misma razón:
 * la pantalla "Más" del panel saludaba a "Ing. Ramón Cázares ·
 * admin@morcast.mx" entrara quien entrara, y el chofer veía "Hola, José"
 * con la unidad "Roll off 04" aunque él se llamara de otra forma. Eran los
 * perfiles de DEMOSTRACIÓN de `datos-admin.js` y `datos-chofer.js`, que
 * siguen siendo lo correcto sólo cuando no hay base conectada.
 *
 * Con base conectada, mientras no se haya leído la sesión devuelve `null`:
 * la pantalla pinta un hueco, nunca un nombre que no es.
 */
export function usePerfilSesion(modo) {
  const [perfil, setPerfil] = useState(haySupabase() ? null : DEMO[modo]);
  const [cargando, setCargando] = useState(haySupabase());

  useEffect(() => {
    if (!haySupabase()) return;
    let vivo = true;
    sesionActiva(modo)
      .then((p) => { if (vivo) { setPerfil(p); setCargando(false); } })
      .catch(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [modo]);

  return { perfil, cargando };
}

/** "Guillermo Cortez Martinez" → "GC". Con un solo nombre, la primera letra. */
export function iniciales(nombre) {
  const partes = String(nombre || "").trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return "·";
  return partes.slice(0, 2).map((p) => p[0].toUpperCase()).join("");
}
