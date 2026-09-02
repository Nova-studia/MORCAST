"use server";

import { supabaseServidor, haySupabase } from "@/lib/supabase";
import { correoAvisoEmpleo, correoAcuseEmpleo } from "@/lib/correo";
import { AVISO_PRIVACIDAD } from "@/lib/datos";
import { VACANTES_SEED } from "@/lib/empleo-datos";
import { validarSolicitud, validarArchivo, folioEmpleo } from "@/lib/empleo.mjs";

/**
 * LAS VACANTES DE LA PÁGINA PÚBLICA.
 *
 * Se leen desde el SERVIDOR, no desde el navegador con la llave anónima: así
 * la tabla no queda abierta a nadie. Es la misma vía que ya usa
 * `zonasDeCobertura()` para el mapa de la página pública.
 *
 * Devuelve SOLO lo que la pantalla enseña. Quién la creó y cuándo no tienen
 * por qué salir al público.
 */
export async function vacantesAbiertas() {
  if (!haySupabase()) {
    return VACANTES_SEED.filter((v) => v.estado === "abierta");
  }

  const { data, error } = await supabaseServidor()
    .from("vacantes")
    .select("id, puesto, area, tipo, descripcion, requisitos")
    .eq("estado", "abierta")
    .order("creado", { ascending: false });

  if (error) {
    // Que no haya vacantes y que la base falle se dibujan igual —el formulario
    // sigue abajo—, pero en el registro tienen que distinguirse.
    console.error("[empleo] no se pudieron leer las vacantes:", error.message);
    return [];
  }
  return data || [];
}

/**
 * Devuelve el intento del freno cuando la solicitud NO se llegó a guardar por
 * culpa nuestra (Storage caído, insert que falla), no de la persona. Nunca
 * lanza: si esto falla, lo que importa devolverle a quien aplicó es el error
 * original, no éste.
 */
async function devolverIntento(sb, telefono) {
  const { error } = await sb.rpc("devolver_intento_empleo", { p_telefono: telefono });
  if (error) console.error("[empleo] no se pudo devolver el intento:", error.message);
}

/**
 * RECIBE UNA SOLICITUD.
 *
 * Llega como FormData porque trae un archivo. El orden importa y no es
 * casual:
 *   1. se valida (servidor, no navegador),
 *   2. se pregunta el freno,
 *   3. se SUBE el archivo,
 *   4. se ESCRIBE el registro — y si esto falla, se borra el archivo,
 *   5. y hasta el final se manda el correo.
 *
 * El correo va al final y su fallo NO tumba la solicitud: en agosto de 2026
 * el formulario de contacto estuvo un mes diciendo "Gracias" sin mandar nada.
 * Aquí, si el correo falla, la solicitud ya está guardada y no se pierde.
 */
export async function enviarSolicitudEmpleo(formData) {
  const entrada = {
    nombre: formData.get("nombre"),
    telefono: formData.get("telefono"),
    correo: formData.get("correo"),
    puesto: formData.get("puesto"),
    experiencia: formData.get("experiencia"),
    aviso: formData.get("aviso") === "si",
  };
  const vacanteId = formData.get("vacanteId") || null;
  const archivo = formData.get("curriculum");
  const traeArchivo = archivo && typeof archivo === "object" && archivo.size > 0;

  const v = validarSolicitud(entrada);
  if (!v.ok) return { ok: false, motivo: v.motivo };

  const a = validarArchivo(traeArchivo ? archivo : null);
  if (!a.ok) return { ok: false, motivo: a.motivo };

  const folio = folioEmpleo();
  const { nombre, telefono, correo, puesto, experiencia } = v.limpia;

  if (!haySupabase()) return { ok: true, demo: true, folio };

  const sb = supabaseServidor();

  // 2) El freno. Se cobra por adelantado a propósito —si se cobrara al final,
  //    quien quiera abusar sube archivos de 5 MB sin tope—, pero eso significa
  //    que un fallo NUESTRO de aquí en adelante (Storage, el insert) ya le
  //    quemó un intento a alguien que no mandó nada. Por eso los dos pasos que
  //    siguen devuelven el intento con `devolverIntento` si fallan.
  const { data: cabe, error: errFreno } = await sb.rpc("puede_solicitar_empleo", {
    p_telefono: telefono,
  });
  if (errFreno) {
    console.error("[empleo] fallo el freno:", errFreno.message);
    return { ok: false, motivo: "No se pudo enviar. Inténtalo de nuevo." };
  }
  if (!cabe) {
    return {
      ok: false,
      motivo: "Ya recibimos tu solicitud. Morcast la tiene y te contactará; no hace falta mandarla otra vez.",
    };
  }

  // 3) El archivo primero. Si el registro falla después, se borra: currículums
  //    huérfanos en la cubeta son archivos de una persona que nadie sabe de
  //    quién son.
  let cvRuta = null;
  if (traeArchivo) {
    const extension = (archivo.name.split(".").pop() || "pdf").toLowerCase();
    cvRuta = `${folio}/${Date.now()}.${extension}`;
    const { error: errSubida } = await sb.storage
      .from("curriculums")
      .upload(cvRuta, archivo, { contentType: archivo.type, upsert: false });
    if (errSubida) {
      console.error("[empleo] no se pudo subir el curriculum:", errSubida.message);
      await devolverIntento(sb, telefono);
      return { ok: false, motivo: "No se pudo subir tu currículum. Inténtalo de nuevo." };
    }
  }

  // 4) El registro.
  // La vacante se pudo cerrar mientras esta persona llenaba el formulario. La
  // solicitud entra IGUAL, como solicitud general: no se tira su trabajo por
  // una carrera que no es suya. Se le avisa al final.
  let vacanteValida = null;
  let vacanteSeCerro = false;
  if (vacanteId) {
    const { data: vac } = await sb
      .from("vacantes").select("id, estado").eq("id", vacanteId).maybeSingle();
    if (vac?.estado === "abierta") vacanteValida = vac.id;
    else vacanteSeCerro = true;
  }

  const { error: errFila } = await sb.from("solicitudes_empleo").insert({
    folio, nombre, telefono,
    correo: correo || null,
    puesto,
    vacante_id: vacanteValida,
    experiencia,
    cv_ruta: cvRuta,
    aviso_version: AVISO_PRIVACIDAD.version,
  });

  if (errFila) {
    if (cvRuta) await sb.storage.from("curriculums").remove([cvRuta]);
    console.error("[empleo] no se pudo guardar:", errFila.message);
    await devolverIntento(sb, telefono);
    return { ok: false, motivo: "No se pudo guardar tu solicitud. Inténtalo de nuevo." };
  }

  // 5) Los correos, hasta el final y sin poder tumbar nada.
  try {
    await correoAvisoEmpleo({ folio, nombre, telefono, correo, puesto, experiencia, traeCurriculum: Boolean(cvRuta) });
    await correoAcuseEmpleo({ correo, nombre, folio, puesto });
  } catch (e) {
    console.error("[empleo] la solicitud SI se guardo, pero el correo fallo:", e?.message);
  }

  return {
    ok: true,
    folio,
    aviso: vacanteSeCerro
      ? "Ese puesto acaba de cerrarse, pero tu solicitud quedó registrada y la tomamos en cuenta para las próximas vacantes."
      : null,
  };
}
