/**
 * El ID del cliente OAuth de Morcast en Google Cloud (proyecto `morcast`).
 *
 * ⚠️ NO es un secreto, y por eso va escrito aquí y no en una variable de
 * entorno. Viaja en la URL de cada petición a Google, a la vista de cualquiera
 * que abra las herramientas del navegador; Google lo diseñó así. El que SÍ es
 * secreto es el "client secret", que vive únicamente en el panel de Supabase y
 * no aparece en este repositorio (que además es público).
 *
 * Escribirlo aquí en vez de en `NEXT_PUBLIC_...` evita el fallo clásico: que
 * funcione en la laptop y el botón no aparezca en producción porque a nadie se
 * le ocurrió darla de alta en Vercel.
 */
export const GOOGLE_CLIENT_ID =
  "731912259235-0nvfuu978biemhq3snquafrl2fssur60.apps.googleusercontent.com";

/** El guion de Google Identity Services. */
export const GIS_SRC = "https://accounts.google.com/gsi/client";
