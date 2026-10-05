/**
 * PESO: el estimado del chofer contra el real de la báscula del relleno.
 *
 * DE DÓNDE SALE ESTO (pedido 11 de los dueños, 4-oct-2026)
 * El peso que anota el chofer en la app es un cálculo a ojo. El peso de
 * verdad lo da el relleno sanitario, y ahí no pesan contenedor por
 * contenedor: pesan el CAMIÓN entero, una vez por viaje. Por eso el peso real
 * se registra por viaje (`viajes_relleno`) y, por si acaso, también se puede
 * poner el de una recolección suelta (`recolecciones.peso_real_kg`).
 *
 * EL RIESGO QUE CUIDA ESTE ARCHIVO: CONTAR DOBLE
 * Un viaje de 6 t con cuatro recolecciones adentro pesa 6 t, no 6 t más lo
 * que el chofer estimó de cada una. Y si alguien además le puso peso real a
 * una de esas cuatro, ese peso ya viene DENTRO de las 6 t del ticket: sumarlo
 * aparte también es contar doble. La regla, en orden:
 *
 *   1. La recolección va en un viaje que tiene peso real → cuenta el VIAJE,
 *      una sola vez, con el peso del ticket. Sus recolecciones ya no suman
 *      nada por su cuenta (ni su estimado ni su peso real propio).
 *   2. Si no, la recolección tiene peso real propio → cuenta ése.
 *   3. Si no, el estimado del chofer.
 *
 * Un viaje SIN recolecciones asignadas no suma. Si sumara, las
 * recolecciones que iban en él (y que nadie amarró) contarían dos veces: con
 * su estimado y dentro del viaje. Mejor que la pantalla de viajes avise que
 * falta amarrarlas.
 *
 * Si quien pregunta no puede leer los viajes (el cliente en su portal: el
 * RLS solo se los enseña al personal), el viaje simplemente no aparece y sus
 * recolecciones caen al paso 2 o 3. Es lo correcto: el ticket es del camión
 * completo, con residuo de otras empresas, y no es del cliente.
 *
 * Aquí no hay red ni base: es lógica pura para poder probarla con `node --test`.
 */

/** Un peso en kilos que de verdad es un número positivo, o null. */
export function kgValido(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Lo que se escribe en el campo "peso real (kg)". Acepta "1,250" y "1250.5".
 * Devuelve `{ kg }` o `{ error }` con un texto que entiende quien lo tecleó.
 *
 * El tope (60 t) no es del negocio sino de la cordura: el camión más grande
 * de la flota no carga eso, y un 125000 casi siempre es un 1250.00 al que se
 * le fue el punto.
 */
export const KG_MAXIMO = 60000;
export function leerKg(texto) {
  const limpio = String(texto ?? "").trim().replace(/,/g, "");
  if (!limpio) return { error: "Escribe el peso en kilos." };
  if (!/^\d+(\.\d{1,2})?$/.test(limpio)) return { error: "El peso va en kilos, solo números (por ejemplo 1250 o 1250.5)." };
  const kg = Number(limpio);
  if (!(kg > 0)) return { error: "El peso tiene que ser mayor que cero." };
  if (kg > KG_MAXIMO) return { error: `Más de ${KG_MAXIMO.toLocaleString("es-MX")} kg no cabe en un camión. Revisa el punto decimal.` };
  return { kg };
}

/**
 * De dónde sale el peso de UNA recolección, para enseñarlo en su renglón.
 *
 * @param {{estimadoKg?: number, realKg?: number, viajeId?: string}} rec
 * @param {Map<string, {pesoRealKg: number}>|Record<string, {pesoRealKg: number}>} viajes
 * @returns {{fuente: "viaje"|"real"|"estimado"|"sin-peso", kg: number|null}}
 *   En "viaje", `kg` es el peso del VIAJE completo, no el de la recolección.
 */
export function fuenteDePeso(rec, viajes = {}) {
  const viaje = rec?.viajeId ? obtener(viajes, rec.viajeId) : null;
  const kgViaje = kgValido(viaje?.pesoRealKg);
  if (kgViaje) return { fuente: "viaje", kg: kgViaje };
  const real = kgValido(rec?.realKg);
  if (real) return { fuente: "real", kg: real };
  const est = kgValido(rec?.estimadoKg);
  if (est) return { fuente: "estimado", kg: est };
  return { fuente: "sin-peso", kg: null };
}

function obtener(coleccion, id) {
  if (!coleccion) return null;
  if (coleccion instanceof Map) return coleccion.get(id) || null;
  return coleccion[id] || null;
}

/** El tipo que más se repite (empate: el primero que apareció). */
function masComun(lista) {
  const cuenta = new Map();
  for (const t of lista) cuenta.set(t, (cuenta.get(t) || 0) + 1);
  let mejor = null;
  let n = 0;
  for (const [t, c] of cuenta) if (c > n) { mejor = t; n = c; }
  return mejor;
}

/**
 * Convierte las recolecciones en APORTES al total con el mejor dato de cada
 * una, sin contar nada dos veces.
 *
 * @param {Array<{fecha: string, tipo?: string, estimadoKg?: number,
 *                realKg?: number, viajeId?: string}>} recolecciones
 *   Una por servicio completado.
 * @param {Array<{id: string, fecha: string, pesoRealKg: number}>} viajes
 *   Los viajes que la sesión puede ver. Los que no estén aquí no cuentan.
 * @returns {{
 *   aportes: Array<{fecha: string, tipo: string, kg: number,
 *                   fuente: "viaje"|"real"|"estimado"|"sin-peso", servicios: number}>,
 *   kgTotal: number, kgReal: number, kgEstimado: number,
 *   kgViajes: number, kgRealSuelto: number, servicios: number,
 *   serviciosConReal: number, serviciosSinPeso: number
 * }}
 */
export function aportesConMejorDato(recolecciones = [], viajes = []) {
  const viajesPorId = new Map();
  for (const v of viajes || []) {
    if (v?.id && kgValido(v.pesoRealKg)) viajesPorId.set(v.id, v);
  }

  const enViaje = new Map(); // viajeId → recolecciones
  const aportes = [];

  for (const r of recolecciones || []) {
    if (r?.viajeId && viajesPorId.has(r.viajeId)) {
      if (!enViaje.has(r.viajeId)) enViaje.set(r.viajeId, []);
      enViaje.get(r.viajeId).push(r);
      continue;
    }
    const f = fuenteDePeso({ estimadoKg: r?.estimadoKg, realKg: r?.realKg });
    aportes.push({
      fecha: r?.fecha,
      tipo: r?.tipo || "otro",
      kg: f.kg || 0,
      fuente: f.fuente,
      servicios: 1,
    });
  }

  // Cada viaje entra UNA vez, con el peso del ticket y la fecha del viaje.
  for (const [id, recs] of enViaje) {
    const v = viajesPorId.get(id);
    aportes.push({
      fecha: v.fecha || recs[0]?.fecha,
      tipo: masComun(recs.map((r) => r.tipo || "otro")) || "otro",
      kg: kgValido(v.pesoRealKg),
      fuente: "viaje",
      servicios: recs.length,
    });
  }

  const suma = (pred) => aportes.filter(pred).reduce((t, a) => t + a.kg, 0);
  const kgViajes = suma((a) => a.fuente === "viaje");
  const kgRealSuelto = suma((a) => a.fuente === "real");
  const kgEstimado = suma((a) => a.fuente === "estimado");
  const servicios = aportes.reduce((t, a) => t + a.servicios, 0);

  return {
    aportes,
    kgTotal: redondear(kgViajes + kgRealSuelto + kgEstimado),
    kgReal: redondear(kgViajes + kgRealSuelto),
    kgEstimado: redondear(kgEstimado),
    kgViajes: redondear(kgViajes),
    kgRealSuelto: redondear(kgRealSuelto),
    servicios,
    serviciosConReal: aportes
      .filter((a) => a.fuente === "viaje" || a.fuente === "real")
      .reduce((t, a) => t + a.servicios, 0),
    serviciosSinPeso: aportes.filter((a) => a.fuente === "sin-peso").length,
  };
}

/**
 * Cómo cuadra un viaje: el peso del ticket contra lo que el chofer estimó
 * de las recolecciones que iban en él.
 *
 * La diferencia es REAL − ESTIMADO: positiva quiere decir que el chofer se
 * quedó corto. Las recolecciones sin estimado se cuentan aparte, porque con
 * una sin peso la suma sale baja y la diferencia engaña; la pantalla lo avisa.
 *
 * @param {{pesoRealKg: number}} viaje
 * @param {Array<{estimadoKg?: number}>} recolecciones
 */
export function cuadreDeViaje(viaje, recolecciones = []) {
  const real = kgValido(viaje?.pesoRealKg) || 0;
  const conEstimado = recolecciones.filter((r) => kgValido(r?.estimadoKg));
  const estimadoKg = redondear(conEstimado.reduce((t, r) => t + kgValido(r.estimadoKg), 0));
  const diferenciaKg = conEstimado.length ? redondear(real - estimadoKg) : null;
  return {
    recolecciones: recolecciones.length,
    sinEstimado: recolecciones.length - conEstimado.length,
    estimadoKg,
    diferenciaKg,
    // En porcentaje del estimado: "el chofer se quedó 12 % corto".
    diferenciaPct: conEstimado.length && estimadoKg > 0
      ? Math.round(((real - estimadoKg) / estimadoKg) * 100)
      : null,
  };
}

/**
 * Las recolecciones que se pueden meter en un viaje.
 *
 * Solo las de ESA fecha (el camión va al relleno el mismo día que recoge) y,
 * si se eligió, del chofer, la ruta o la unidad. Las que ya van en OTRO viaje
 * se devuelven aparte: quitarle una recolección a otro viaje sin decirlo le
 * cambiaría el cuadre a un ticket que alguien ya revisó.
 *
 * @returns {{libres: Array, enOtroViaje: Array}}
 */
export function candidatasParaViaje(recolecciones = [], { fecha, choferId, rutaClave, unidadId, viajeId } = {}) {
  const pasan = (recolecciones || []).filter((r) =>
    (!fecha || r.fecha === fecha) &&
    (!choferId || r.operadorId === choferId) &&
    (!rutaClave || r.rutaClave === rutaClave) &&
    (!unidadId || r.unidadId === unidadId)
  );
  return {
    libres: pasan.filter((r) => !r.viajeId || r.viajeId === viajeId),
    enOtroViaje: pasan.filter((r) => r.viajeId && r.viajeId !== viajeId),
  };
}

/**
 * Qué cambia al guardar la lista de recolecciones de un viaje: cuáles se
 * amarran y cuáles se sueltan. Se calcula aquí para que el servidor toque
 * solo lo que cambió y la bitácora diga exactamente eso.
 */
export function cambiosDeRecolecciones(actuales = [], elegidas = []) {
  const antes = new Set(actuales);
  const despues = new Set(elegidas);
  return {
    agregar: [...despues].filter((id) => !antes.has(id)),
    quitar: [...antes].filter((id) => !despues.has(id)),
  };
}

function redondear(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

/** "1,250 kg". Sin decimales salvo que los haya. */
export function textoKg(kg) {
  const n = Number(kg);
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString("es-MX", { maximumFractionDigits: 2 })} kg`;
}

/**
 * "6.24 t" a partir de una tonelada; por debajo, en kilos. En el relleno se
 * habla en toneladas, pero "0.08 t" se lee peor que "80 kg".
 */
export function textoPeso(kg) {
  const n = Number(kg);
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1000) {
    return `${(n / 1000).toLocaleString("es-MX", { maximumFractionDigits: 2 })} t`;
  }
  return textoKg(n);
}

/** "+320 kg" / "−180 kg": la diferencia con su signo, que es lo que se lee. */
export function textoDiferencia(kg) {
  if (kg === null || kg === undefined || !Number.isFinite(Number(kg))) return "—";
  const n = Number(kg);
  if (n === 0) return "0 kg";
  return `${n > 0 ? "+" : "−"}${textoPeso(Math.abs(n))}`;
}
