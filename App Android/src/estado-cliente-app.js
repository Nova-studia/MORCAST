import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { supabase, haySupabase } from "./supabase";
import { permisosDeEstado } from "./web/estado-cliente.mjs";
import { decidirSesion, avisoDeSalida } from "./cliente-app.mjs";

/**
 * EL ESTADO DE LA EMPRESA DEL CLIENTE (apps al 100%, fase A).
 *
 * Desde la 028 la base ya respeta el estado: una cuenta SUSPENDIDA entra y
 * ve, pero solo puede reportar depósitos; una de BAJA no entra. La app no lo
 * leía: el cliente suspendido intentaba agendar y recibía "Esa fecha no se
 * puede". Aquí se lee `clientes.estado` de SU empresa (RLS) y se comparte con
 * todas sus pantallas (la banda roja, Agendar, Mi cuenta), como los precios.
 */
let actual = null; // { estado, empresa, folio, clienteId }
const oyentes = new Set();
const avisar = () => oyentes.forEach((f) => f(actual));
let enCurso = null;

/** Lee el estado de la base. `{ ok, estado, empresa, folio }` o `{ ok:false }`; nunca lanza. */
export async function leerEstadoCliente() {
  if (!haySupabase()) return { ok: true, estado: "activo", empresa: "", folio: "" };
  try {
    const { data: { session } = {} } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return { ok: false };
    const { data, error } = await supabase
      .from("perfiles")
      .select("cliente_id, clientes ( estado, empresa, folio )")
      .eq("id", uid)
      .maybeSingle();
    if (error || !data) return { ok: false };
    return {
      ok: true,
      estado: data.clientes?.estado || "activo",
      empresa: data.clientes?.empresa || "",
      folio: data.clientes?.folio || "",
      clienteId: data.cliente_id || null,
    };
  } catch {
    return { ok: false };
  }
}

/** Vuelve a leerlo (al abrir, al volver al frente, tras un rechazo). */
export function recargarEstadoCliente() {
  if (enCurso) return enCurso;
  enCurso = leerEstadoCliente()
    .then((r) => {
      if (r.ok) {
        actual = r;
        avisar();
      }
      return actual;
    })
    .finally(() => { enCurso = null; });
  return enCurso;
}

export const estadoClienteActual = () => actual?.estado || null;

export function olvidarEstadoCliente() {
  actual = null;
  avisar();
}

/**
 * Hook: `{ estado, empresa, folio, suspendido, puedeOperar }`. Mientras no
 * se sepa, se trata como activo (la base decide de todos modos).
 */
export function useEstadoCliente() {
  const [v, setV] = useState(actual);
  useEffect(() => {
    oyentes.add(setV);
    setV(actual);
    if (!actual) recargarEstadoCliente();
    const sub = AppState.addEventListener("change", (nuevo) => {
      if (nuevo === "active") recargarEstadoCliente();
    });
    return () => {
      oyentes.delete(setV);
      sub.remove();
    };
  }, []);
  const estado = v?.estado || null;
  return {
    estado,
    empresa: v?.empresa || "",
    folio: v?.folio || "",
    suspendido: estado === "suspendido",
    puedeOperar: permisosDeEstado(estado || "activo").puedeOperar,
  };
}

/**
 * ¿LA SESIÓN GUARDADA SIGUE VALIENDO? (fase A.3)
 *
 * El arranque usa `getSession()` a propósito (no espera a la red, ver
 * sesion.js). Esto va DESPUÉS, ya con la app abierta: pregunta al servidor
 * (`getUser()`). Si el servidor dice que no (cuenta borrada, bloqueada por
 * baja, token revocado), se sale y el login dice por qué. Si lo que falla es
 * la red, no se toca nada: sin señal la app tiene que seguir sirviendo.
 * A un cliente cuya empresa está de BAJA también se le saca.
 *
 * Devuelve `{ salir: boolean, aviso? }`; nunca lanza.
 */
export async function comprobarSesionConServidor(modo) {
  if (!haySupabase()) return { salir: false };
  let res;
  try {
    res = await supabase.auth.getUser();
  } catch {
    return { salir: false };
  }
  const d = decidirSesion({ user: res?.data?.user, error: res?.error });
  if (d === "salir") return { salir: true, aviso: avisoDeSalida(res?.error) };
  if (d === "seguir" && modo === "cliente") {
    const e = await recargarEstadoCliente();
    if (e && !permisosDeEstado(e.estado).entra) return { salir: true, aviso: avisoDeSalida(null, e.estado) };
  }
  return { salir: false };
}
