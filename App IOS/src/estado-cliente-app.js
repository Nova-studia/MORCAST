import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { leerEstadoCliente } from "./datos-cuenta";
import { permisosDeEstado } from "./web/estado-cliente.mjs";

/**
 * EL ESTADO DE LA EMPRESA DEL CLIENTE, COMPARTIDO POR TODAS SUS PANTALLAS
 * (9-oct-2026, apps al 100%).
 *
 * Desde la 028 el estado tiene efecto real: suspendida = entra y ve, pero
 * SOLO agrega saldo (aviso rojo arriba de todo); baja = no entra. El aviso,
 * Agendar y Mi cuenta preguntan lo mismo, así que se lee UNA vez y se
 * comparte (módulo + suscriptores, como candado-admin.js), y se vuelve a
 * leer al volver la app al frente: la oficina pudo reactivarla mientras.
 *
 * `{ cargando, estado, empresa, folio, motivoEstado, puedeOperar }`. Sin red
 * se queda lo último que se supo (o "activo" si nunca se supo: el candado de
 * verdad es la base, esto solo explica).
 */
let actual = { cargando: true, estado: null, empresa: "", folio: "", motivoEstado: "" };
const oyentes = new Set();
let pidiendo = null;
// Quien escucha la BAJA (App.js): se saca al cliente con su mensaje.
let alDarseDeBaja = null;

function publicar(nuevo) {
  actual = nuevo;
  oyentes.forEach((fn) => {
    try { fn(actual); } catch { /* un oyente que falla no calla a los demás */ }
  });
}

export function refrescarEstadoCliente() {
  if (pidiendo) return pidiendo;
  pidiendo = leerEstadoCliente()
    .then((r) => {
      if (r.ok) {
        publicar({ cargando: false, estado: r.estado, empresa: r.empresa, folio: r.folio, motivoEstado: r.motivoEstado || "" });
        if (r.estado === "baja") alDarseDeBaja?.();
      } else {
        publicar({ ...actual, cargando: false });
      }
    })
    .catch(() => publicar({ ...actual, cargando: false }))
    .finally(() => { pidiendo = null; });
  return pidiendo;
}

/** Al salir: lo de este cliente no se le queda al siguiente. */
export function olvidarEstadoCliente() {
  publicar({ cargando: true, estado: null, empresa: "", folio: "", motivoEstado: "" });
}

/** App.js: qué hacer si la empresa resulta dada de baja. Devuelve la baja. */
export function alBajaCliente(fn) {
  alDarseDeBaja = fn;
  return () => { if (alDarseDeBaja === fn) alDarseDeBaja = null; };
}

export function useEstadoCliente() {
  const [e, setE] = useState(actual);
  useEffect(() => {
    oyentes.add(setE);
    setE(actual);
    if (actual.estado === null && !pidiendo) refrescarEstadoCliente();
    return () => { oyentes.delete(setE); };
  }, []);
  return { ...e, ...permisosDeEstado(e.estado || "activo") };
}

/** App.js lo monta una vez con la sesión de cliente: relee al volver al frente. */
export function useVigilarEstadoCliente() {
  useEffect(() => {
    refrescarEstadoCliente();
    let antes = AppState.currentState;
    const sub = AppState.addEventListener("change", (ahora) => {
      if (antes !== "active" && ahora === "active") refrescarEstadoCliente();
      antes = ahora;
    });
    return () => sub.remove();
  }, []);
}
