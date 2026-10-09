import { dentroDeMatamoros, filaDePunto, sectorDePunto } from "./sectores.mjs";

/**
 * LOS PUNTOS DE RECOLECCIÓN, DEL LADO DEL SERVIDOR (6-oct-2026).
 *
 * Dos cosas que la oficina hace sobre un punto y que ahora se hacen también
 * desde la app (pantalla Puntos): asignarle su RUTA y guardar su UBICACIÓN.
 * La web y `/api/app/puntos/*` llaman a este mismo código.
 *
 * Las dos van con un cliente de Supabase que actúa COMO EL USUARIO (la
 * sesión en la web, su token en la app), nunca con la llave de servicio: el
 * RLS (`suscripciones_personal`, `domicilios_personal`) sigue siendo el
 * guardia, y los disparadores de la bitácora (db/022) anotan a la persona
 * que pulsó y no a "sistema".
 */

/**
 * Revisa lo que llega para asignar ruta, sin tocar la base. Va primero en
 * las dos puertas: con un número malo no hay nada que preguntarle a nadie.
 */
export function revisarAsignacion({ rutaClave, serviciosPorMes, porLlamada } = {}) {
  const n = Number(serviciosPorMes);
  if (!Number.isInteger(n) || n < 1 || n > 200) {
    return { ok: false, motivo: "Las recolecciones al mes deben ser un número entero de 1 a 200." };
  }
  return {
    ok: true,
    resultado: { rutaClave: rutaClave || null, serviciosPorMes: n, porLlamada: Boolean(porLlamada) },
  };
}

/**
 * ASIGNAR UN PUNTO DE RECOLECCIÓN A UNA RUTA (6-oct-2026, Luis).
 *
 * Antes ninguna pantalla creaba `suscripciones`: solo el cargador del
 * cuaderno. Un cliente dado de alta desde la página se quedaba sin ruta para
 * siempre, y sin ruta el portal no le ofrece "Día de mi ruta" y la app no le
 * deja agendar. La suscripción es justo esa liga: cliente + punto + ruta.
 *
 * Hay a lo más UNA por punto (índice único cliente+domicilio, db/020): si ya
 * existe se actualiza, si no se crea. `rutaClave` vacío quita la ruta pero
 * conserva la fila (y su historia de precio, db/023).
 *
 * `sb` actúa como el usuario (ver arriba), cuenta las filas y queda en la
 * bitácora (`anotar`) con el antes y el después.
 */
export async function asignarRutaAPuntoCon(
  { sb, anotar },
  { domicilioId, rutaClave, serviciosPorMes, porLlamada } = {}
) {
  const revisado = revisarAsignacion({ rutaClave, serviciosPorMes, porLlamada });
  if (!revisado.ok) return revisado;
  const { resultado } = revisado;
  const n = resultado.serviciosPorMes;

  const { data: dom } = await sb
    .from("domicilios").select("id, cliente_id, alias, clientes ( estado )").eq("id", domicilioId).maybeSingle();
  if (!dom) return { ok: false, motivo: "No se encontró ese punto de recolección." };
  // Asignar ruta reactiva el servicio: a un cliente dado de baja, no
  // (Entrega 3). Primero se le reactiva desde su ficha.
  if (dom.clientes?.estado === "baja") {
    return { ok: false, motivo: "Ese cliente está dado de baja: reactívalo desde su ficha antes de asignarle ruta." };
  }

  let ruta = null;
  if (rutaClave) {
    const { data } = await sb
      .from("rutas").select("id, clave, nombre, activa").eq("clave", rutaClave).maybeSingle();
    if (!data) return { ok: false, motivo: "No se encontró esa ruta." };
    if (!data.activa) return { ok: false, motivo: `La ruta ${data.nombre} está desactivada.` };
    ruta = data;
  }

  const { data: previa } = await sb
    .from("suscripciones")
    .select("id, ruta_id, servicios_por_mes, por_llamada, estado")
    .eq("cliente_id", dom.cliente_id)
    .eq("domicilio_id", dom.id)
    .maybeSingle();

  const cambios = {
    ruta_id: ruta?.id ?? null,
    servicios_por_mes: n,
    por_llamada: Boolean(porLlamada),
    // Asignarle ruta es ponerla a trabajar: una pausada o cancelada vuelve.
    ...(ruta ? { estado: "activa" } : {}),
  };

  const { data, error } = previa
    ? await sb.from("suscripciones").update(cambios).eq("id", previa.id).select("id")
    : await sb
        .from("suscripciones")
        .insert({ cliente_id: dom.cliente_id, domicilio_id: dom.id, frecuencia: "mensual", estado: "activa", ...cambios })
        .select("id");

  if (error) return { ok: false, motivo: error.message };
  if (!data?.length) {
    return { ok: false, motivo: "No se guardó nada: el permiso de la base no te deja tocar ese punto." };
  }

  await anotar({
    accion: "asignar_ruta_punto",
    tabla: "suscripciones",
    registroId: data[0].id,
    detalle: {
      domicilio_id: dom.id,
      punto: dom.alias,
      cliente_id: dom.cliente_id,
      antes: previa
        ? { ruta_id: previa.ruta_id, servicios_por_mes: previa.servicios_por_mes, por_llamada: previa.por_llamada, estado: previa.estado }
        : null,
      despues: { ruta: ruta?.clave ?? null, ...cambios },
    },
  });

  return { ok: true, suscripcion: { ...resultado, rutaNombre: ruta?.nombre || "" } };
}

/**
 * Revisa lo que llega para guardar un punto: un pin `[lat, lng]` dentro de
 * Matamoros (la MISMA caja que exige la base, db/023) y/o las referencias.
 * Devuelve `{ ok, cambios }` con sólo lo que vino, o `{ ok:false, motivo }`.
 */
export function revisarCambiosPunto({ pin, referencias } = {}) {
  const cambios = {};
  if (pin !== undefined && pin !== null) {
    const par = Array.isArray(pin) && pin.length === 2 ? pin.map(Number) : null;
    if (!par || !par.every(Number.isFinite)) return { ok: false, motivo: "La ubicación no es válida." };
    if (!dentroDeMatamoros(par[0], par[1])) {
      return { ok: false, motivo: "Esa ubicación queda fuera de Matamoros. Revisa el pin antes de guardar." };
    }
    // Seis decimales (unos 10 cm), igual que el mapa de la web.
    cambios.pin = [Number(par[0].toFixed(6)), Number(par[1].toFixed(6))];
  }
  if (referencias !== undefined && referencias !== null) {
    if (typeof referencias !== "string") return { ok: false, motivo: "Las referencias no son válidas." };
    if (referencias.length > 500) return { ok: false, motivo: "Las referencias son muy largas (máximo 500 letras)." };
    cambios.referencias = referencias;
  }
  if (!Object.keys(cambios).length) return { ok: false, motivo: "No hay nada que guardar." };
  return { ok: true, cambios };
}

/**
 * GUARDA LA UBICACIÓN Y/O LAS REFERENCIAS DE UN PUNTO, como "Guardar" y
 * "Confirmar ubicación" de la pestaña Puntos de la web.
 *
 * Con pin: el origen pasa a 'panel' (la oficina) y el sector se recalcula
 * con los límites que haya hoy — el mismo `sectorDePunto` que usa la web
 * antes de guardar. Confirmar el pin que puso el cliente es mandar ESE mismo
 * pin: con eso deja de estar "por revisar".
 *
 * La bitácora la pone la base sola (disparador de `domicilios`, db/022), a
 * nombre de quien trae la sesión: por eso `sb` actúa como el usuario.
 */
export async function guardarPuntoCon(sb, { puntoId, pin, referencias } = {}) {
  const revisado = revisarCambiosPunto({ pin, referencias });
  if (!revisado.ok) return revisado;
  const { cambios } = revisado;

  let sector = null;
  if (cambios.pin) {
    const { data: sectores, error: errSect } = await sb
      .from("sectores").select("id, clave, nombre, color, zona, activo").order("clave");
    if (errSect) return { ok: false, motivo: "No se pudieron leer los sectores. Inténtalo otra vez." };
    sector = sectorDePunto({ lat: cambios.pin[0], lng: cambios.pin[1] }, sectores || []);
  }

  const fila = filaDePunto({
    pin: cambios.pin,
    referencias: cambios.referencias,
    sectorId: cambios.pin ? sector?.id ?? null : undefined,
  });

  const { data, error } = await sb
    .from("domicilios")
    .update(fila)
    .eq("id", puntoId)
    .select("id, lat, lng, referencias, sector_id, ubicacion_origen, ubicacion_fecha");

  if (error) return { ok: false, motivo: error.message };
  // Un UPDATE que el RLS bloquea NO da error: cambia cero filas y responde 200.
  if (!data?.length) {
    return { ok: false, motivo: "No se guardó nada: el permiso de la base no te deja editar ese punto." };
  }
  return {
    ok: true,
    punto: data[0],
    sector: sector ? { id: sector.id, clave: sector.clave, nombre: sector.nombre, color: sector.color } : null,
  };
}
