/**
 * Datos de EJEMPLO para el modo demostración (cuando no hay Supabase).
 *
 * 🔑 Gente y empresas INVENTADAS. Nunca se "mejoran" con datos reales para
 * que parezcan más creíbles: este archivo va a un repo público.
 */

export const VACANTES_SEED = [
  {
    id: "VAC-DEMO-1",
    puesto: "Chofer de roll off",
    area: "operacion",
    tipo: "tiempo-completo",
    descripcion: "Movimiento e intercambio de tolvas en el área de Matamoros.",
    requisitos: ["Licencia federal vigente", "Experiencia en roll off", "Disponibilidad de lunes a sábado"],
    estado: "abierta",
    creado: "2026-08-20T10:00:00Z",
  },
  {
    id: "VAC-DEMO-2",
    puesto: "Ayudante de recolección",
    area: "operacion",
    tipo: "tiempo-completo",
    descripcion: "Apoyo en ruta de recolección de residuos sólidos urbanos.",
    requisitos: ["Secundaria terminada", "Condición física para trabajo en ruta"],
    estado: "abierta",
    creado: "2026-08-25T10:00:00Z",
  },
  {
    id: "VAC-DEMO-3",
    puesto: "Auxiliar administrativo",
    area: "oficina",
    tipo: "medio-tiempo",
    descripcion: "Captura, archivo y seguimiento telefónico a clientes.",
    requisitos: ["Manejo de Excel", "Buena redacción"],
    estado: "cerrada",
    creado: "2026-07-10T10:00:00Z",
  },
];

export const SOLICITUDES_EMPLEO_SEED = [
  {
    id: "SOL-DEMO-1",
    folio: "EMP-2026-4KD2",
    nombre: "Ana Ruiz",
    telefono: "8681234567",
    correo: "ana.ruiz@ejemplo.mx",
    puesto: "Auxiliar administrativo",
    vacante_id: null,
    experiencia: "Cinco años en captura y atención a clientes en una distribuidora.",
    cv_ruta: null,
    estado: "nueva",
    notas: "",
    creado: "2026-08-28T16:30:00Z",
  },
  {
    id: "SOL-DEMO-2",
    folio: "EMP-2026-9QT7",
    nombre: "Ramiro Elizondo",
    telefono: "8687712204",
    correo: "",
    puesto: "Chofer de roll off",
    vacante_id: "VAC-DEMO-1",
    experiencia: "Tres años manejando volteo de 14 m³. Licencia federal vigente.",
    cv_ruta: null,
    estado: "revisada",
    notas: "Se le llamó, queda pendiente de pasar por la oficina.",
    creado: "2026-08-30T09:15:00Z",
  },
];
