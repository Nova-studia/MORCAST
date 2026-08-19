/**
 * Paleta y tokens de la app Morcast — mismo look que la web (tema oscuro).
 */
export const T = {
  fondo: "#0f1615",       // fondo de pantalla
  panel: "#16201f",       // tarjetas
  panel2: "#1b2624",      // superficies internas / inputs
  linea: "#28322f",       // bordes
  tinta: "#eef2f1",       // texto principal
  gris: "#939d99",        // texto secundario
  grisClaro: "#69736f",   // texto tenue
  verde: "#4eb34a",
  verdeClaro: "#6fce69",
  teal: "#144c4f",
  tealClaro: "#4fc0c5",
  naranja: "#db652d",
  naranjaClaro: "#f0895c",
  blanco: "#ffffff",
};

// Colores de estatus (badges), igual que la web
export const BADGE = {
  ok:   { bg: "rgba(78,179,74,0.16)",  fg: "#6fce69" },
  prog: { bg: "rgba(45,138,143,0.18)", fg: "#4fc0c5" },
  ruta: { bg: "rgba(219,101,45,0.18)", fg: "#f0895c" },
  // Rechazada / cancelada. La usan las solicitudes de recolección.
  mal:  { bg: "rgba(198,63,63,0.18)",  fg: "#ef8080" },
  none: { bg: "rgba(147,157,153,0.16)", fg: "#939d99" },
};

export const radio = 14;
export const espacio = 16;
