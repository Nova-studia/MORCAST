"use server";

import { usuarioActual } from "@/lib/supabase-sesion";
import { haySupabase, supabaseServidor } from "@/lib/supabase";
import { pasarFreno } from "@/lib/freno";
import { avisarOficinaDeSolicitud } from "@/lib/avisar-solicitud";
import { esFolioRecoleccion } from "@/lib/solicitud-aviso.mjs";
import { headers } from "next/headers";
import { registrar } from "@/lib/bitacora";
import { origenPermitido } from "@/lib/origen.mjs";
import { hayResend, correoCambioSolicitudCliente } from "@/lib/correo";
import { enviarPush, tokensDeUsuarios, usuariosOficina } from "@/lib/push.mjs";
import { mensajePushParada } from "@/lib/oficina-recolecciones.mjs";
import { hoyMatamoros } from "@/lib/avisos.mjs";
import { cambiarSolicitudClienteCon } from "@/lib/solicitud-cliente-servidor.mjs";

/**
 * El portal pidió una recolección: que se entere la oficina (6-oct-2026).
 *
 * La solicitud ya la guardó el navegador con la sesión del cliente, bajo el
 * RLS (lib/datos-solicitudes.js → pedirRecoleccion). Esto solo AVISA: el
 * correo (la llave de Resend no puede vivir en el navegador) y las
 * notificaciones a la oficina (el cliente no puede leer sus tokens). Las
 * apps hacen lo mismo con /api/app/solicitud-avisada; las dos llaman a
 * lib/avisar-solicitud.js.
 *
 * La empresa sale del PERFIL de la sesión, nunca de lo que mande el
 * navegador: solo se avisa de solicitudes propias, recientes y sin atender.
 */
export async function avisarSolicitudNueva(folio) {
  if (!haySupabase()) return { ok: true, demo: true };
  if (!esFolioRecoleccion(folio)) return { ok: false, motivo: "Falta la solicitud." };

  const quien = await usuarioActual();
  if (!quien || quien.rol !== "cliente" || !quien.cliente_id) {
    return { ok: false, motivo: "Tu sesión se venció. Vuelve a entrar." };
  }

  // Cada llamada puede mandar un correo y varias notificaciones.
  const pasa = await pasarFreno(`solicitud-avisada:${quien.id}`, { maximo: 30, minutos: 60, porIp: false });
  if (!pasa) return { ok: false, motivo: "Demasiados avisos seguidos." };

  const r = await avisarOficinaDeSolicitud({
    sb: supabaseServidor(),
    actor: { id: quien.id, correo: quien.correo },
    clienteId: quien.cliente_id,
    folio: folio.trim(),
  });
  return r.ok ? { ok: true } : { ok: false, motivo: r.motivo };
}

/**
 * El cliente CANCELA o le CAMBIA LA FECHA a su solicitud (Entrega 4). El
 * trabajo y las reglas viven en lib/solicitud-cliente-servidor.mjs; aquí la
 * puerta (solo clientes, freno por usuario) y los avisos reales.
 */
export async function cambiarMiSolicitudAccion(datos = {}) {
  if (!haySupabase()) return { ok: true, demo: true };
  const quien = await usuarioActual();
  if (!quien) return { ok: false, motivo: "Tu sesión se venció. Vuelve a entrar." };
  if (quien.rol !== "cliente" || !quien.cliente_id) return { ok: false, motivo: "Esto es solo para clientes." };
  if (!(await pasarFreno(`cambiar-solicitud:${quien.id}`, { maximo: 20, minutos: 60, porIp: false }))) {
    return { ok: false, motivo: "Demasiados cambios seguidos. Espera un poco." };
  }
  const sb = supabaseServidor();
  const origen = origenPermitido(await headers());
  // El estado de la EMPRESA: suspendida o de baja no cambia nada (db/028).
  const { data: empresa } = await sb.from("clientes").select("estado").eq("id", quien.cliente_id).maybeSingle();
  return cambiarSolicitudClienteCon(
    {
      sb,
      quien: { ...quien, estadoCliente: empresa?.estado || "baja" },
      anotar: registrar,
      avisarOficina: async (e) => {
        // ?folio= enseña esa solicitud con cualquier estado (?cambiar= filtra
        // las confirmadas y una cancelada o reagendada no salía).
        const enlace = `${origen}/admin/recolecciones?folio=${encodeURIComponent(e.folio)}`;
        const tareas = [];
        if (hayResend()) tareas.push(correoCambioSolicitudCliente({ ...e, enlace }));
        tareas.push((async () => {
          const tokens = await tokensDeUsuarios(sb, await usuariosOficina(sb));
          if (!tokens.length) return;
          await enviarPush(tokens, {
            titulo: e.accion === "cancelar" ? "Recolección cancelada por el cliente" : "Un cliente cambió la fecha",
            cuerpo: `${e.empresa || "Un cliente"} · ${e.folio}${e.accion === "reagendar" ? ` → ${e.despues}` : ""}`,
            datos: { tipo: "solicitud", id: e.id, folio: e.folio },
          }, { sb });
        })());
        await Promise.allSettled(tareas);
      },
      avisarChofer: async ({ uid, parada }) => {
        const tokens = await tokensDeUsuarios(sb, [uid]);
        if (tokens.length) await enviarPush(tokens, mensajePushParada("quitada", parada), { sb });
      },
    },
    { ...datos, hoy: hoyMatamoros() }
  );
}
