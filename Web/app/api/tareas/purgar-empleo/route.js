/**
 * BORRA LAS SOLICITUDES DE MÁS DE 12 MESES.
 *
 * La llama una tarea programada de Vercel una vez al día (`Web/vercel.json`).
 * Lo que el Aviso de Privacidad promete, lo cumple esto — por eso no se deja
 * a que alguien abra una pantalla: si nadie entra en tres meses, la promesa
 * es mentira.
 *
 * Borra TODAS las de más de 12 meses, sin importar su estado, también las ya
 * contactadas. Inventar excepciones sería prometer una cosa en el Aviso y
 * hacer otra.
 */
import { supabaseServidor, haySupabase } from "@/lib/supabase";
import { fechaDeCorte } from "@/lib/empleo.mjs";

export async function GET(peticion) {
  // `process.env.CRON_SECRET` sin definir es `undefined`, y una cabecera sin
  // mandar también llega como `null`, nunca como `undefined`: por eso NO basta
  // comparar sólo `autorizacion !== esperado` — hay que exigir además que el
  // secreto exista, o un despliegue sin la variable puesta dejaría la ruta
  // abierta para cualquiera (esta ruta borra datos, así que ese es el peor
  // error posible aquí).
  const autorizacion = peticion.headers.get("authorization");
  if (!process.env.CRON_SECRET || autorizacion !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ ok: false }, { status: 401 });
  }
  // Modo demostración: sin Supabase configurado no hay nada que purgar, y la
  // ruta responde igual que si hubiera corrido.
  if (!haySupabase()) return Response.json({ ok: true, demo: true });

  const sb = supabaseServidor();
  const corte = fechaDeCorte().toISOString();

  const { data: viejas, error } = await sb
    .from("solicitudes_empleo")
    .select("id, cv_ruta")
    .lt("creado", corte);

  if (error) {
    console.error("[purga] no se pudieron leer:", error.message);
    return Response.json({ ok: false }, { status: 500 });
  }
  if (!viejas?.length) return Response.json({ ok: true, borradas: 0 });

  // Primero los archivos de la cubeta. Al revés quedarían currículums
  // huérfanos —documentos personales de gente real— que ya nadie sabe de
  // quién son ni por qué están ahí.
  const rutas = viejas.map((s) => s.cv_ruta).filter(Boolean);
  if (rutas.length) {
    const { error: errArchivos } = await sb.storage.from("curriculums").remove(rutas);
    if (errArchivos) {
      // Si el archivo no se pudo borrar, el registro TAMPOCO se borra: es
      // mejor conservar de más un día que perder el rastro de qué archivo
      // quedó suelto en la cubeta.
      console.error("[purga] no se pudieron borrar los archivos:", errArchivos.message);
      return Response.json({ ok: false }, { status: 500 });
    }
  }

  const { error: errFilas } = await sb
    .from("solicitudes_empleo")
    .delete()
    .in("id", viejas.map((s) => s.id));

  if (errFilas) {
    console.error("[purga] no se pudieron borrar los registros:", errFilas.message);
    return Response.json({ ok: false }, { status: 500 });
  }

  return Response.json({ ok: true, borradas: viejas.length, archivos: rutas.length });
}
