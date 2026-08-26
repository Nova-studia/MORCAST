/**
 * ¿Se pasó la fecha de una recolección, y de quién fue la falla?
 *
 * DE DÓNDE SALE ESTO
 * Un cliente pidió una recolección para el 25 de agosto. Nadie la atendió.
 * Al día siguiente seguía en el panel viéndose EXACTAMENTE IGUAL que una
 * pedida para dentro de tres semanas, y hundida al fondo de la lista porque
 * el orden era de la más nueva a la más vieja. El cliente tampoco se enteró:
 * su portal decía "Solicitada", como si todo siguiera su curso.
 *
 * Nada estaba roto. Simplemente no había ninguna señal, y una recolección que
 * no se hizo no se distingue de una que todavía no toca.
 *
 * LOS TRES CASOS, QUE NO PESAN IGUAL
 *
 *   sin-atender   Sigue en "Solicitada" y su día ya pasó. NADIE LA VIO. Es la
 *                 falla del panel: el cliente pidió y no obtuvo respuesta.
 *
 *   incumplida    Estaba "Confirmada" y el día acordado ya pasó. Es la más
 *                 grave: aquí Morcast ya se comprometió y el camión no llegó
 *                 (o llegó y nadie lo registró, que para el cliente es lo
 *                 mismo, porque no tiene comprobante).
 *
 *   sin-cerrar    Quedó "En ruta" y el día ya pasó. El chofer la empezó y no
 *                 la terminó. Suele ser papeleo, no servicio: casi siempre el
 *                 camión sí fue.
 *
 * `completada` y `rechazada` son finales: nunca vencen.
 */

/** Hoy en AAAA-MM-DD, armado con la fecha LOCAL (no UTC, que corre el día). */
export function hoyISO(ahora = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${ahora.getFullYear()}-${p(ahora.getMonth() + 1)}-${p(ahora.getDate())}`;
}

/** Días de diferencia entre dos fechas de calendario (b − a). */
export function diasEntre(aISO, bISO) {
  const [a1, a2, a3] = String(aISO).split("-").map(Number);
  const [b1, b2, b3] = String(bISO).split("-").map(Number);
  if (!a1 || !b1) return 0;
  // Mediodía en las dos: así ningún cambio de horario de verano convierte
  // una diferencia de 1 día en 0.96 y la redondea mal.
  const a = new Date(a1, a2 - 1, a3, 12);
  const b = new Date(b1, b2 - 1, b3, 12);
  return Math.round((b - a) / 86400000);
}

const FINALES = new Set(["completada", "rechazada"]);

const POR_ESTADO = {
  solicitada: {
    tipo: "sin-atender",
    texto: "Sin atender",
    detalle: "Se pidió para este día y nadie la atendió.",
    detalleCliente: "Seguimos revisando tu solicitud. Te avisamos en cuanto la confirmemos.",
  },
  confirmada: {
    tipo: "incumplida",
    texto: "No se cumplió",
    detalle: "Ya estaba confirmada para este día y no se registró el servicio.",
    detalleCliente: "Tu recolección estaba confirmada para este día y todavía no se registra. Ya lo estamos revisando.",
  },
  "en-ruta": {
    tipo: "sin-cerrar",
    texto: "Sin cerrar",
    detalle: "El chofer la tomó y no la cerró. Revisa si el servicio se hizo.",
    detalleCliente: "Tu recolección quedó en proceso. Estamos completando el registro.",
  },
};

/**
 * La fecha que de verdad vale: la acordada si Morcast ya confirmó una, y si
 * no, la que pidió el cliente. Reagendar cambia `fechaConfirmada`, así que
 * una vencida deja de estarlo en cuanto se le pone día nuevo.
 */
export function fechaEfectiva(s) {
  return s?.fechaConfirmada || s?.fechaPedida || null;
}

/**
 * @returns {{vencida: boolean, tipo?: string, texto?: string, detalle?: string,
 *            detalleCliente?: string, dias?: number, fecha?: string}}
 */
export function estadoVencimiento(s, hoy = hoyISO()) {
  const fecha = fechaEfectiva(s);
  if (!fecha || FINALES.has(s?.estado)) return { vencida: false };

  const dias = diasEntre(fecha, hoy);
  if (dias <= 0) return { vencida: false, dias, fecha };

  const info = POR_ESTADO[s.estado];
  if (!info) return { vencida: false, dias, fecha };

  return { vencida: true, dias, fecha, ...info };
}

/** "1 día", "3 días" — para pegarlo después de la etiqueta. */
export function textoAtraso(dias) {
  return dias === 1 ? "1 día" : `${dias} días`;
}

/**
 * Orden por urgencia, que es lo contrario de lo que había.
 *
 * Estaba ordenado por fecha DESCENDENTE: lo más nuevo arriba. O sea que una
 * recolección atrasada se hundía más cada vez que entraba una nueva —
 * exactamente al revés de lo que hace falta.
 *
 *   1. Vencidas, la más atrasada primero.
 *   2. Pendientes por venir, la más próxima primero (mañana antes que en tres
 *      semanas: es lo siguiente que hay que resolver).
 *   3. Cerradas (completadas y rechazadas), lo más reciente primero.
 */
export function ordenarPorUrgencia(lista, hoy = hoyISO()) {
  const rango = (s) => {
    if (FINALES.has(s.estado)) return 2;
    return estadoVencimiento(s, hoy).vencida ? 0 : 1;
  };
  return [...lista].sort((a, b) => {
    const ra = rango(a);
    const rb = rango(b);
    if (ra !== rb) return ra - rb;

    const fa = fechaEfectiva(a) || "";
    const fb = fechaEfectiva(b) || "";
    // Vencidas y por venir: ascendente (lo más viejo / lo más próximo arriba).
    // Cerradas: descendente, que ahí lo útil es lo último que pasó.
    if (ra === 2) return fa < fb ? 1 : fa > fb ? -1 : 0;
    return fa < fb ? -1 : fa > fb ? 1 : 0;
  });
}

/**
 * Qué días se le pueden ofrecer al admin para reagendar.
 *
 * "Lo más pronto posible según la disponibilidad" tiene dos respuestas y las
 * dos son legítimas, por eso se ofrecen las dos en vez de decidir por él:
 *
 *   · HOY o MAÑANA — una recolección extra, fuera del calendario de la ruta.
 *     Es lo correcto cuando la falla fue de Morcast y hay que reponer ya.
 *   · EL PRÓXIMO DÍA DE SU RUTA — cuando el camión ya va a pasar por ahí de
 *     todos modos y no vale mandar una unidad sola.
 *
 * El sistema NO sabe cuántas paradas caben en un camión: eso no está en la
 * base. Por eso propone y no decide — la disponibilidad real la pone quien
 * conoce la operación, y para eso queda el selector de fecha libre.
 */
export function opcionesReagenda(diasDeRuta, hoy = hoyISO(), cuantas = 3) {
  const nombres = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
  const [a, m, d] = hoy.split("-").map(Number);
  const opciones = [];

  const manana = new Date(a, m - 1, d + 1, 12);
  const p = (n) => String(n).padStart(2, "0");
  const aISO = (f) => `${f.getFullYear()}-${p(f.getMonth() + 1)}-${p(f.getDate())}`;

  opciones.push({ id: "hoy", texto: "Hoy", fecha: hoy, extra: true });
  opciones.push({ id: "manana", texto: "Mañana", fecha: aISO(manana), extra: true });

  // El próximo día en que pasa su ruta, empezando por mañana.
  if (Array.isArray(diasDeRuta) && diasDeRuta.length) {
    for (let i = 1; i <= 21; i++) {
      const f = new Date(a, m - 1, d + i, 12);
      if (diasDeRuta.includes(nombres[f.getDay()])) {
        const iso = aISO(f);
        if (!opciones.some((o) => o.fecha === iso)) {
          opciones.push({ id: "ruta", texto: "Próximo día de su ruta", fecha: iso, extra: false });
        }
        break;
      }
    }
  }

  return opciones.slice(0, cuantas);
}
