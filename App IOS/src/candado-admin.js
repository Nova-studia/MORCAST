/**
 * "VUELVE A ESCRIBIR EL CÓDIGO" A MEDIA SESIÓN (6-oct-2026).
 *
 * El pase del segundo paso puede dejar de valer con el panel ya abierto
 * (venció, o se cerró la sesión en otro lado). Entonces una acción de
 * administración contesta `segundoPaso: true` (Web/lib/app-ruta.js:
 * entrarAppAdmin). `postAdmin` (api-admin.js) llama aquí y App.js, que está
 * escuchando, pone la pantalla del código ENCIMA del panel, sin desmontarlo:
 * lo que el admin tenía escrito (un aviso a medias) sigue ahí al volver, y
 * basta con tocar otra vez el botón.
 */

const oyentes = new Set();

/** App.js se suscribe; devuelve la función para darse de baja. */
export function alPedirSegundoPaso(fn) {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}

/** El servidor pidió el código otra vez. */
export function pedirSegundoPaso() {
  oyentes.forEach((fn) => {
    try {
      fn();
    } catch {
      /* un oyente que falla no debe callar a los demás */
    }
  });
}
