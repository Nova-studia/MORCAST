/**
 * Datos de DEMOSTRACIÓN del modo Chofer / Operador.
 * El chofer ve su ruta del día, escanea el QR del contenedor y registra la
 * recolección con foto antes/después. En producción esto viene de Supabase y
 * alimenta el comprobante que ven el administrador y el cliente.
 */

import { SOLICITUDES_SEED, RUTAS_SEED } from "./rutas-datos";
export const CHOFER_DEMO = { correo: "chofer@demo.com", password: "chofer" };

export const CHOFER_PERFIL = {
  nombre: "José Medina",
  unidad: "Roll off 04",
  correo: "chofer@demo.com",
  telefono: "868 771 4520",
};

// Ruta asignada para hoy. estatus: pendiente | completado
export const RUTA_HOY = [
  { folio: "SRV-2026-0731", cliente: "Industrias del Golfo", direccion: "Parque Industrial del Norte, Nave 14", tipo: "Residuos Sólidos Urbanos", contenedor: "Contenedor 6 m³", qr: "MOR-C-0421", hora: "08:00", estatus: "pendiente" },
  { folio: "SRV-2026-0732", cliente: "Centro Comercial Puerta Norte", direccion: "Av. del Niño #2200, Local A", tipo: "Renta tolva 15 m³", contenedor: "Tolva 15 m³", qr: "MOR-C-0455", hora: "09:30", estatus: "pendiente" },
  { folio: "SRV-2026-0733", cliente: "Vidriera Matamoros", direccion: "Carr. Matamoros-Reynosa Km 8", tipo: "Residuos Sólidos Urbanos", contenedor: "Contenedor 6 m³", qr: "MOR-C-0473", hora: "11:00", estatus: "pendiente" },
  { folio: "SRV-2026-0730", cliente: "Maquilas TechNorte", direccion: "Parque Industrial FINSA, Nave 22", tipo: "Manejo Especial", contenedor: "Caja 20 m³", qr: "MOR-C-0388", hora: "07:15", estatus: "completado",
    evidencia: { peso: "3.9 ton", horaAntes: "07:18", horaDespues: "07:52", antes: null, despues: null } },
];

/** Genera una hora demo "HH:MM" a partir de un desplazamiento (sin Date real). */
export function horaDemo(base = "08", min = "14") {
  return `${base}:${min}`;
}

/* =========================================================================
   Conexión con las solicitudes de recolección (Task 9 del plan)
   ========================================================================= */

/**
 * Paradas del chofer para una fecha: las recolecciones CONFIRMADAS de las
 * rutas que trae asignadas.
 *
 * No sustituye a RUTA_HOY, que trae las paradas demo con su evidencia
 * fotográfica; es la vía por la que, cuando exista backend, las paradas
 * saldrán de lo que el admin confirmó en el panel.
 *
 * El flujo de 5 pasos del chofer (QR, foto antes, recolectar, foto después,
 * peso) NO se toca.
 */
export function rutaDelDia(chofer, fecha) {
  const misRutas = RUTAS_SEED.filter((r) => r.chofer === chofer && r.activa).map((r) => r.id);
  return SOLICITUDES_SEED.filter(
    (s) =>
      misRutas.includes(s.rutaId) &&
      ["confirmada", "en-ruta"].includes(s.estado) &&
      (s.fechaConfirmada || s.fechaPedida) === fecha
  ).map((s) => ({
    folio: s.folio,
    cliente: s.cliente,
    direccion: s.domicilio,
    // Confirmada y en-ruta son las dos "pendiente" para el chofer: todavía no
    // la recoge. Solo pasa a "completado" cuando él termina los 5 pasos.
    estatus: "pendiente",
  }));
}
