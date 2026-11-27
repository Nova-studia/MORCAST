import { createClient } from "@supabase/supabase-js";
import { supabaseServidor, haySupabase } from "./supabase";

/**
 * ENTRAR CON GAFETE — lo que lee y escribe el servidor (db/033).
 *
 * Las reglas viven en lib/gafete-acceso.mjs; aquí solo las consultas, con la
 * llave de servicio. Aquí NO se revisa quién llama: lo hacen las rutas de
 * `app/api/app/gafete/*` y las acciones del panel (`exigirSeccion`).
 *
 * Cada función recibe `sb` (las rutas ya traen uno); si no, crea el suyo.
 */

const sbDe = (sb) => sb || supabaseServidor();
const ahora = () => new Date().toISOString();

function revisar({ data, error }, que) {
  if (error) throw new Error(`[gafete] ${que}: ${error.message}`);
  return data;
}

/**
 * El gafete del código, su empleado, la cuenta ligada y el vínculo vigente
 * con ese teléfono. En DOS tandas en paralelo (antes eran tres seguidas): la
 * entrada con gafete tardaba ~1.7 s en la prueba del 27-nov. La cuenta sale
 * del vínculo (`par.perfil_id`); `decidirEntrada` exige que sea la misma del
 * empleado, así que da igual de cuál se lea.
 */
export async function leerParaEntrar(sb, codigo, dispositivoId) {
  const db = sbDe(sb);
  const [gafete, par] = await Promise.all([
    db.from("gafetes").select("id, empleado_id, estado, chip_serie").eq("codigo", codigo).maybeSingle()
      .then((r) => revisar(r, "leer gafete")),
    db.from("gafete_telefonos")
      .select("id, perfil_id, exige_serie, con_pase, fallos, desvinculado_en, secreto_hash, gafetes!inner(codigo)")
      .eq("dispositivo_id", dispositivoId).eq("gafetes.codigo", codigo).is("desvinculado_en", null)
      .maybeSingle()
      .then((r) => revisar(r, "leer vínculo")),
  ]);
  if (!gafete) return { gafete: null, empleado: null, perfil: null, par: null };
  const [empleado, perfil] = await Promise.all([
    db.from("empleados").select("id, estado, perfil_id, nombre, apellido_paterno, apellido_materno, puesto").eq("id", gafete.empleado_id).maybeSingle()
      .then((r) => revisar(r, "leer empleado")),
    par
      ? db.from("perfiles").select("id, rol, activo, nombre").eq("id", par.perfil_id).maybeSingle()
          .then((r) => revisar(r, "leer perfil"))
      : null,
  ]);
  return { gafete, empleado, perfil, par };
}

/**
 * Canjea el enlace de un solo uso por la sesión, AQUÍ en el servidor (antes
 * lo hacía la app y después pedía el pase en otra llamada: dos viajes más).
 * Cliente aparte a propósito: si se usara el de la llave de servicio, tras el
 * canje sus consultas irían con la sesión del usuario.
 */
export async function abrirSesion(tokenHash) {
  const auth = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await auth.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
  if (error || !data?.session) throw new Error(`[gafete] abrir sesión: ${error?.message || "sin sesión"}`);
  return data.session;
}

/**
 * Un fallo más para ESE teléfono (en todos sus vínculos vigentes: el freno
 * es del aparato, no del gafete). Leer y escribir no es atómico; dos fallos
 * simultáneos pueden contar como uno, y eso solo retrasa el tope un intento.
 */
export async function contarFallo(sb, dispositivoId) {
  const db = sbDe(sb);
  const filas = revisar(
    await db.from("gafete_telefonos").select("id, fallos").eq("dispositivo_id", dispositivoId).is("desvinculado_en", null),
    "leer fallos",
  ) || [];
  await Promise.all(filas.map((f) =>
    db.from("gafete_telefonos").update({ fallos: f.fallos + 1 }).eq("id", f.id).then((r) => revisar(r, "contar fallo"))));
}

/** Alguien entró con correo en ese teléfono: vuelve a aceptar el gafete. */
export async function reiniciarFallos(sb, dispositivoId) {
  revisar(
    await sbDe(sb).from("gafete_telefonos").update({ fallos: 0 }).eq("dispositivo_id", dispositivoId).is("desvinculado_en", null),
    "reiniciar fallos",
  );
}

/** Entró con el gafete: último uso y la cuenta de fallos en cero. */
export async function anotarUso(sb, parId) {
  revisar(await sbDe(sb).from("gafete_telefonos").update({ ultimo_uso: ahora(), fallos: 0 }).eq("id", parId), "anotar uso");
}

/**
 * Vincula el gafete a este teléfono. Un vínculo vigente previo del mismo
 * par se cierra antes (la app manda un secreto nuevo en cada vínculo). La serie se
 * guarda solo si el gafete todavía no tenía.
 */
export async function vincular(sb, { gafeteId, perfilId, dispositivoId, secretoHash, aparato, exigeSerie, guardarSerie, serie, conPase = false }) {
  const db = sbDe(sb);
  if (guardarSerie && serie) {
    revisar(await db.from("gafetes").update({ chip_serie: serie }).eq("id", gafeteId).is("chip_serie", null), "guardar serie");
  }
  revisar(
    await db.from("gafete_telefonos").update({ desvinculado_en: ahora(), desvinculado_por: perfilId })
      .eq("gafete_id", gafeteId).eq("dispositivo_id", dispositivoId).is("desvinculado_en", null),
    "cerrar vínculo previo",
  );
  return revisar(
    await db.from("gafete_telefonos").insert({
      gafete_id: gafeteId,
      perfil_id: perfilId,
      dispositivo_id: dispositivoId,
      secreto_hash: secretoHash,
      aparato: String(aparato || "").slice(0, 60),
      exige_serie: Boolean(exigeSerie),
      con_pase: Boolean(conPase),
    }).select("id").single(),
    "vincular",
  );
}

/**
 * Desvincula. Por `parId` (el panel) o por `dispositivoId` + `perfilId`
 * (la persona desde su teléfono: solo sus vínculos). Devuelve cuántos cerró.
 */
export async function desvincular(sb, { parId = null, dispositivoId = null, perfilId = null, por = null }) {
  if (!parId && !(dispositivoId && perfilId)) return 0;
  let q = sbDe(sb).from("gafete_telefonos").update({ desvinculado_en: ahora(), desvinculado_por: por }).is("desvinculado_en", null);
  q = parId ? q.eq("id", parId) : q.eq("dispositivo_id", dispositivoId).eq("perfil_id", perfilId);
  return (revisar(await q.select("id"), "desvincular") || []).length;
}

/** Los teléfonos vinculados al gafete VIGENTE de un empleado (para su ficha del panel). */
export async function telefonosDe(sb, empleadoId) {
  if (!sb && !haySupabase()) return [];
  const db = sbDe(sb);
  const gafete = revisar(
    await db.from("gafetes").select("id").eq("empleado_id", empleadoId).eq("estado", "vigente").maybeSingle(),
    "leer gafete vigente",
  );
  if (!gafete) return [];
  return revisar(
    await db.from("gafete_telefonos").select("id, aparato, creado, ultimo_uso, fallos")
      .eq("gafete_id", gafete.id).is("desvinculado_en", null).order("creado", { ascending: false }),
    "leer teléfonos",
  ) || [];
}

/**
 * Para la ficha del panel: a qué cuenta está ligado el empleado, las cuentas
 * del personal que se le pueden ligar (con a quién está ligada cada una) y
 * los teléfonos vinculados a su gafete vigente.
 */
export async function accesoDe(sb, empleadoId) {
  if (!sb && !haySupabase()) return { perfilId: null, cuentas: [], telefonos: [] };
  const db = sbDe(sb);
  const [empleado, perfiles, ligados, telefonos] = await Promise.all([
    db.from("empleados").select("perfil_id").eq("id", empleadoId).maybeSingle().then((r) => revisar(r, "leer empleado")),
    db.from("perfiles").select("id, nombre, rol, activo").in("rol", ["dueno", "admin", "operador"]).order("nombre")
      .then((r) => revisar(r, "leer cuentas")),
    db.from("empleados").select("id, perfil_id").eq("estado", "activo").not("perfil_id", "is", null)
      .then((r) => revisar(r, "leer ligados")),
    telefonosDe(db, empleadoId),
  ]);
  const ligadoA = new Map((ligados || []).map((e) => [e.perfil_id, e.id]));
  return {
    perfilId: empleado?.perfil_id || null,
    cuentas: (perfiles || []).map((p) => ({ ...p, ligadoA: ligadoA.get(p.id) || null })),
    telefonos,
  };
}

/** Liga (o desliga, con `perfilId` null) la cuenta de la app de un empleado. */
export async function ligarCuenta(sb, { empleadoId, perfilId }) {
  revisar(await sbDe(sb).from("empleados").update({ perfil_id: perfilId }).eq("id", empleadoId), "ligar cuenta");
}

/**
 * Al cambiar la cuenta ligada de un empleado: cierra los vínculos de su
 * gafete vigente que sean de OTRA cuenta. Si no, al volver a ligar la cuenta
 * anterior sus teléfonos revivirían solos (revisión final, 27-nov).
 */
export async function cerrarVinculosAjenos(sb, { empleadoId, perfilId, por = null }) {
  const db = sbDe(sb);
  const gafete = revisar(
    await db.from("gafetes").select("id").eq("empleado_id", empleadoId).eq("estado", "vigente").maybeSingle(),
    "leer gafete vigente",
  );
  if (!gafete) return 0;
  let q = db.from("gafete_telefonos").update({ desvinculado_en: ahora(), desvinculado_por: por })
    .eq("gafete_id", gafete.id).is("desvinculado_en", null);
  if (perfilId) q = q.neq("perfil_id", perfilId);
  return (revisar(await q.select("id"), "cerrar vínculos ajenos") || []).length;
}
