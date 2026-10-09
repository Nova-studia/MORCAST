import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { accionAdmin } from "./accion";
import { supabase, haySupabase } from "./supabase";
import { leerPermisos } from "./web/permisos.mjs";

/**
 * QUÉ SECCIONES VE ESTE ADMIN (apps al 100%, 9-oct-2026).
 *
 * Se pide UNA vez al pasar el segundo paso (`accionAdmin('mis-permisos')`) y
 * se guarda aquí, a nivel de módulo, como los precios (precios-servidor.js):
 * las pestañas, el menú "Más" y cada pantalla leen lo mismo sin volver a
 * preguntar. `puedeVer(yo, pantalla)` (permisos-app.mjs) decide con esto.
 *
 * Sin señal se reintenta solo (y al volver la app al frente); mientras tanto
 * `yo` es null y solo se enseña lo que no pide sección (Panel, Mi cuenta).
 *
 * Si la web todavía no conoce la acción (se despliega primero, pero por si
 * acaso), se leen los permisos directo con la sesión (`leerPermisos`, RLS):
 * es la misma consulta que usa el servidor.
 */
let yo = null;
let estado = "sin-cargar"; // sin-cargar | cargando | listo | sinRed
let reloj = null;
let espera = 4000;
const oyentes = new Set();
const avisar = () => oyentes.forEach((f) => f({ yo, estado }));

const DEMO = { rol: "dueno", rolNombre: null, permisos: [] };

async function directo() {
  try {
    const { data: { user } = {} } = await supabase.auth.getUser();
    if (!user) return null;
    const p = await leerPermisos(supabase, user.id);
    // Sin la migración de roles la consulta no trae nada: el rol del token
    // basta para que el dueño vea todo (un admin, solo el Panel).
    return { rol: p.rol || user.app_metadata?.rol || null, rolNombre: p.rolNombre, permisos: p.permisos || [] };
  } catch {
    return null;
  }
}

export async function cargarMisPermisos() {
  clearTimeout(reloj);
  if (!haySupabase()) {
    yo = DEMO;
    estado = "listo";
    avisar();
    return yo;
  }
  estado = "cargando";
  avisar();
  const r = await accionAdmin("mis-permisos");
  if (r?.ok) {
    yo = { rol: r.rol, rolNombre: r.rolNombre || null, permisos: Array.isArray(r.permisos) ? r.permisos : [] };
    estado = "listo";
    espera = 4000;
  } else if (r?.sinRed) {
    estado = "sinRed";
    // Reintento con espera creciente (4 s, 8 s… hasta 1 min).
    reloj = setTimeout(() => { cargarMisPermisos(); }, espera);
    espera = Math.min(espera * 2, 60000);
  } else if (r?.segundoPaso) {
    // El código se vuelve a pedir encima del panel; al pasarlo, App.js
    // vuelve a llamar aquí.
    estado = "sin-cargar";
  } else {
    const d = await directo();
    yo = d;
    estado = d ? "listo" : "sinRed";
    if (!d) reloj = setTimeout(() => { cargarMisPermisos(); }, espera);
  }
  avisar();
  return yo;
}

/** Al salir: la siguiente cuenta en este teléfono no hereda las secciones. */
export function olvidarMisPermisos() {
  clearTimeout(reloj);
  yo = null;
  estado = "sin-cargar";
  espera = 4000;
  avisar();
}

export const misPermisosActuales = () => yo;

/** Hook: `{ yo, estado, reintentar }`; se repinta cuando llegan. */
export function useMisPermisos() {
  const [v, setV] = useState({ yo, estado });
  useEffect(() => {
    oyentes.add(setV);
    setV({ yo, estado });
    // Al volver al frente sin permisos todavía, se intenta de una vez.
    const sub = AppState.addEventListener("change", (nuevo) => {
      if (nuevo === "active" && estado === "sinRed") cargarMisPermisos();
    });
    return () => {
      oyentes.delete(setV);
      sub.remove();
    };
  }, []);
  return { ...v, reintentar: cargarMisPermisos };
}
