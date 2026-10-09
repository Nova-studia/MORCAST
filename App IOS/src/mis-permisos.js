import { useEffect, useState } from "react";
import { haySupabase } from "./supabase";
import { accionAdmin } from "./accion";

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
 *  · Si falla por RED se reintenta solo (2, 4, 8… hasta 30 s) y la pantalla
 *    también ofrece "Reintentar".
 *  · Sin base (demostración) se es dueño: se ve todo, como antes.
 */
let estado = { yo: null, cargando: false, fallo: null };
const oyentes = new Set();
let reloj = null;
let intento = 0;
let vuelta = 0; // sube al olvidar: una respuesta vieja no pisa la sesión nueva

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
  const mia = vuelta;
  publicar({ ...estado, cargando: true });
  const r = await accionAdmin("mis-permisos");
  if (mia !== vuelta) return;
  if (r?.ok) {
    intento = 0;
    publicar({ yo: { rol: r.rol, rolNombre: r.rolNombre || null, permisos: Array.isArray(r.permisos) ? r.permisos : [] }, cargando: false, fallo: null });
    return;
  }
  const sinRed = Boolean(r?.sinRed || r?.red);
  publicar({ ...estado, cargando: false, fallo: { sinRed, motivo: sinRed ? "Sin conexión: no se pudieron leer tus permisos." : r?.motivo || "No se pudieron leer tus permisos." } });
  // Solo la falta de señal se reintenta sola. Un "no" del servidor (403,
  // segundo paso) se queda dicho: reintentarlo no lo cambia.
  if (sinRed) {
    intento += 1;
    reloj = setTimeout(cargarMisPermisos, Math.min(30000, 2000 * 2 ** (intento - 1)));
  }
}

/** Al salir: la siguiente sesión empieza sin permisos. */
export function olvidarMisPermisos() {
  clearTimeout(reloj);
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
