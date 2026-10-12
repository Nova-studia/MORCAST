/**
 * GET /admin/personal/foto/<id del empleado> — la foto, para el panel.
 *
 * La cubeta `personal` no tiene políticas (db/032): el navegador no puede
 * pedirle la foto a Storage. Sale por aquí, después de revisar la sección
 * Personal (y con ella el segundo paso). Va por una ruta propia y no por un
 * enlace firmado para que sirva igual en la lista, en la ficha y en la hoja
 * de impresión, y para que la política de contenido del sitio (`img-src
 * 'self'`) no tenga que abrirse a otro dominio.
 */
import { exigirSeccion } from "@/lib/permisos-servidor";
import { haySupabase } from "@/lib/supabase";
import { almacenPersonal } from "@/lib/personal-almacen";

const sinFoto = (estado) => new Response(null, { status: estado, headers: { "Cache-Control": "no-store" } });

export async function GET(_peticion, ctx) {
  if (haySupabase()) {
    const { error } = await exigirSeccion("personal");
    if (error) return sinFoto(403);
  }
  const { id } = await ctx.params;
  try {
    const almacen = almacenPersonal();
    const empleado = await almacen.empleado(String(id));
    const foto = empleado?.foto_ruta ? await almacen.bajarFoto(empleado.foto_ruta) : null;
    if (!foto) return sinFoto(404);
    // La dirección lleva `?v=<ruta de la foto>`: si la foto cambia, cambia la
    // dirección, así que esta se puede guardar un rato en ESE navegador.
    return new Response(foto.bytes, {
      headers: { "Content-Type": foto.tipo, "Cache-Control": "private, max-age=600", "X-Robots-Tag": "noindex" },
    });
  } catch {
    return sinFoto(404);
  }
}
