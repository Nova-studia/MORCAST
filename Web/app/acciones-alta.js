"use server";

import { pasarFreno } from "@/lib/freno";
import { leerZonas, procesarAltaFirmada, confirmarCorreo } from "@/lib/alta-servidor";

/**
 * Alta de cliente desde la pantalla pública.
 *
 * Va por el servidor con la llave de servicio, no desde el navegador. La
 * tabla `solicitudes_alta` no tiene política de inserción a propósito: si se
 * abriera al público, cualquiera podría llenarla de basura desde fuera sin
 * pasar por la pantalla.
 *
 * No confía en nada de lo que manda el navegador: valida y recorta en el
 * servidor. Desde el 5-oct-2026 el alta se FIRMA (firma electrónica simple,
 * con PDF y confirmación del correo); toda esa faena vive en
 * `lib/alta-servidor.js`, que comparte con el registro con Google.
 */

/**
 * Las zonas de cobertura, para la pantalla PÚBLICA de alta.
 *
 * Va por el servidor porque la tabla `rutas` solo se le entrega a quien tiene
 * sesión, y quien se da de alta todavía no tiene. Antes esta pantalla usaba
 * unas zonas escritas a mano en el código: si Morcast redibujaba una zona en el
 * panel, el formulario público seguía contestando con las viejas — y de ahí
 * salía el "sí estás en cobertura" que se guarda y se manda por correo.
 *
 * Devuelve SOLO lo que la pantalla enseña. La zona no es un secreto (es lo que
 * se le presume al cliente), pero el chofer asignado y la unidad no tienen por
 * qué salir al público. Sin base devuelve null y la pantalla usa sus zonas de
 * respaldo.
 */
export async function zonasDeCobertura() {
  return leerZonas();
}

/**
 * Recibe el alta firmada. Llega como FormData porque trae dos archivos (la
 * firma dibujada y, si la suben, la Constancia de Situación Fiscal). Devuelve
 * el folio y los bytes del PDF en base64 para el botón "Descargar mi
 * solicitud".
 */
export async function registrarAlta(formData) {
  return procesarAltaFirmada({ formData, origen: "formulario" });
}

/**
 * "Confirmar mi solicitud", desde el enlace del correo.
 *
 * Es una acción (POST, con un botón) y no se confirma con sólo abrir el
 * enlace (GET), a propósito: los filtros de correo de muchas empresas abren
 * cada enlace para revisarlo, y eso gastaría el token de un solo uso sin que
 * la persona hiciera nada — la evidencia diría que confirmó quien no confirmó.
 *
 * El token trae 256 bits de azar y no se adivina; el freno está para que
 * nadie use esta acción para golpear la base a lo loco.
 */
export async function confirmarCorreoAlta(token) {
  if (!(await pasarFreno("confirmar-alta", { maximo: 20, minutos: 60 }))) {
    return { ok: false, motivo: "Demasiados intentos desde este equipo. Espera un rato y vuelve a abrir el enlace." };
  }
  return confirmarCorreo(String(token || ""));
}
