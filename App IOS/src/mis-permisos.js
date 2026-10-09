import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { haySupabase } from "./supabase";
import { accionAdmin } from "./accion";
import { falloDePermisos } from "./resultado";

/**
 * MIS PERMISOS EN LA ADMINISTRACIÓN (9-oct-2026, apps al 100%).
 *
 * Desde la Entrega 2 el dueño arma roles por sección ("Caja: Saldos y
 * Clientes"). La app los pide UNA vez al pasar el segundo paso
 * (`mis-permisos` va con el pase) y todas las pantallas leen la misma copia:
 * las pestañas, el menú "Más" y el guardia de cada pantalla.
 *
 * `{ yo: {rol, rolNombre, permisos} | null, cargando, fallo: {sinRed, motivo} | null }`
 *
 *  · Mientras `yo` es null solo se enseña lo que no pide sección (Panel,
 *    Mi cuenta): nunca de más.
 *  · Si falla se reintenta solo (2, 4, 8… hasta 60 s), salvo el segundo
 *    paso; la pantalla también ofrece "Reintentar" y al volver a la app se
 *    piden otra vez.
 *  · Sin base (demostración) se es dueño: se ve todo, como antes.
 */
let estado = { yo: null, cargando: false, fallo: null };
const oyentes = new Set();
let reloj = null;
let intento = 0;
let vuelta = 0; // sube al olvidar: una respuesta vieja no pisa la sesión nueva
let oyendoApp = false;
let sesionAbierta = false; // hay una sesión de administración abierta

function publicar(nuevo) {
  estado = nuevo;
  oyentes.forEach((fn) => {
    try { fn(estado); } catch { /* no callar a los demás */ }
  });
}

export async function cargarMisPermisos() {
  clearTimeout(reloj);
  if (!haySupabase()) {
    publicar({ yo: { rol: "dueno", rolNombre: null, permisos: [], demo: true }, cargando: false, fallo: null });
    return;
  }
  sesionAbierta = true;
  oirVueltaALaApp();
  const mia = vuelta;
  publicar({ ...estado, cargando: true });
  const r = await accionAdmin("mis-permisos");
  if (mia !== vuelta) return;
  if (r?.ok) {
    intento = 0;
    publicar({ yo: { rol: r.rol, rolNombre: r.rolNombre || null, permisos: Array.isArray(r.permisos) ? r.permisos : [] }, cargando: false, fallo: null });
    return;
  }
  // Todo fallo se reintenta solo (2, 4, 8… hasta 60 s), salvo el segundo
  // paso: la pantalla del código ya está encima. Antes solo la falta de señal,
  // y un 500 dejaba al dueño sin secciones hasta reiniciar (revisión 9-oct).
  const { fallo, reintentar } = falloDePermisos(r);
  publicar({ ...estado, cargando: false, fallo: { ...fallo, reintentar } });
  if (reintentar) {
    intento += 1;
    reloj = setTimeout(cargarMisPermisos, Math.min(60000, 2000 * 2 ** (intento - 1)));
  }
}

// Al volver a la app con la sesión abierta y sin permisos leídos, se piden otra vez.
function oirVueltaALaApp() {
  if (oyendoApp) return;
  oyendoApp = true;
  AppState.addEventListener("change", (e) => {
    if (e === "active" && sesionAbierta && !estado.yo && !estado.cargando) cargarMisPermisos();
  });
}

/** Al salir: la siguiente sesión empieza sin permisos. */
export function olvidarMisPermisos() {
  clearTimeout(reloj);
  sesionAbierta = false;
  intento = 0;
  vuelta += 1;
  publicar({ yo: null, cargando: false, fallo: null });
}

export function useMisPermisos() {
  const [e, setE] = useState(estado);
  useEffect(() => {
    oyentes.add(setE);
    setE(estado);
    return () => { oyentes.delete(setE); };
  }, []);
  return e;
}
