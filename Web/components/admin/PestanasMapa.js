"use client";

import { useRouter } from "next/navigation";

/**
 * RUTAS, SECTORES Y PUNTOS (Luis, 6-oct-2026): eran dos renglones del menú
 * ("Rutas" y "Sectores y puntos") para lo que el dueño ve como una sola cosa,
 * el mapa de la operación. Quedó un solo renglón y estas tres pestañas arriba
 * de las dos pantallas.
 *
 * Rutas vive en /admin/rutas; Sectores y Puntos en /admin/sectores (comparten
 * datos, ver esa página). Si la pestaña es de la MISMA pantalla, `onCambiar`
 * la cambia sin recargar; si es de la otra, se navega. `?ver=puntos` abre
 * /admin/sectores directo en Puntos.
 */
const PESTANAS = [
  { id: "rutas", texto: "Rutas", href: "/admin/rutas" },
  { id: "sectores", texto: "Sectores", href: "/admin/sectores" },
  { id: "puntos", texto: "Puntos", href: "/admin/sectores?ver=puntos" },
];

export default function PestanasMapa({ actual, onCambiar, locales = [], etiquetas = {} }) {
  const router = useRouter();

  const ir = (p) => {
    if (p.id === actual) return;
    if (onCambiar && locales.includes(p.id)) onCambiar(p.id);
    else router.push(p.href);
  };

  return (
    <div className="pt-segmento" role="tablist" aria-label="Sección" style={{ marginBottom: "1.1rem" }}>
      {PESTANAS.map((p) => (
        <button
          key={p.id}
          type="button"
          role="tab"
          aria-selected={actual === p.id}
          className={actual === p.id ? "activo" : ""}
          onClick={() => ir(p)}
        >
          {etiquetas[p.id] || p.texto}
        </button>
      ))}
    </div>
  );
}
