/**
 * GET /g/<código>/foto — la foto del gafete, para la página pública.
 *
 * La cubeta `personal` es privada y no tiene políticas (db/032): la foto
 * solo sale por aquí, y solo mientras ESE gafete esté vigente. Con un código
 * dado de baja, repuesto o inventado contesta 404, igual que si no hubiera
 * foto. No se guarda en caché: en cuanto se da de baja deja de servirse.
 */
import { normalizarCodigo } from "@/lib/gafetes.mjs";
import { estadoPublico } from "@/lib/personal.mjs";
import { almacenPersonal } from "@/lib/personal-almacen";

const NO_HAY = () => new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });

export async function GET(_peticion, ctx) {
  const { codigo } = await ctx.params;
  const c = normalizarCodigo(codigo);
  if (!c) return NO_HAY();
  try {
    const almacen = almacenPersonal();
    const encontrado = await almacen.gafetePorCodigo(c);
    if (estadoPublico(encontrado) !== "vigente" || !encontrado.empleado.foto_ruta) return NO_HAY();
    const foto = await almacen.bajarFoto(encontrado.empleado.foto_ruta);
    if (!foto) return NO_HAY();
    return new Response(foto.bytes, {
      headers: { "Content-Type": foto.tipo, "Cache-Control": "no-store", "X-Robots-Tag": "noindex, noimageindex" },
    });
  } catch {
    return NO_HAY();
  }
}
