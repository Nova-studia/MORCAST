import { usuarioActual, supabaseSesion } from "./supabase-sesion";
import { leerPermisos, puede, SECCIONES, PERMISOS_SUELTOS } from "./permisos.mjs";

/**
 * LA PUERTA DE LAS ACCIONES DEL PANEL (Entrega 2, 9-oct-2026).
 *
 * Antes cada `acciones-*.js` traía su `exigirPersonal()`: dueño o admin, y
 * listo. Ahora un admin solo puede lo que diga su rol. Las acciones que usan
 * la llave de servicio SALTAN las políticas de la base, así que este candado
 * es el único que las para: cada acción pide SU sección.
 *
 * `usuarioActual()` ya exige el segundo paso al personal.
 */

const nombreDe = (p) =>
  SECCIONES.find((s) => s.id === p)?.texto || PERMISOS_SUELTOS.find((s) => s.id === p)?.texto || p;

/**
 * `{ quien }` (con `quien.permisos`) o `{ error }`. Sin sección: cualquiera
 * del personal. Con una lista: basta con una de ellas.
 */
export async function exigirSeccion(seccion) {
  const quien = await usuarioActual();
  if (!quien) return { error: "Tu sesión se venció. Vuelve a entrar." };
  if (quien.rol !== "dueno" && quien.rol !== "admin") return { error: "No tienes permiso para esto." };
  const { permisos } = await leerPermisos(await supabaseSesion(), quien.id);
  const lista = Array.isArray(seccion) ? seccion : [seccion];
  if (!lista.some((s) => puede({ rol: quien.rol, permisos }, s))) {
    return { error: `Tu rol no incluye "${lista.map(nombreDe).join('" ni "')}". Pídeselo al dueño.` };
  }
  return { quien: { ...quien, permisos } };
}
