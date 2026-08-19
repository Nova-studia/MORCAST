"use client";

import { usePathname } from "next/navigation";

/**
 * Hace que el contenido entre con una transición al cambiar de página.
 *
 * El truco está en el `key`: al cambiar la ruta, React desmonta el div
 * anterior y monta uno nuevo, así que la animación de CSS vuelve a
 * dispararse. Sin el key sería el mismo nodo y la animación solo correría la
 * primera vez.
 *
 * ⚠️ POR QUÉ ESTO NO VA EN EL LAYOUT RAÍZ
 *
 * Cambiar el `key` desmonta TODO lo que esté adentro. Cuando esto envolvía a
 * `{children}` en `app/layout.js`, adentro caían también los layouts de cada
 * área y sus marcos (AdminShell, PortalShell, ChoferShell, NavBar). Resultado:
 * cada click del menú tiraba el marco entero, el sidebar desaparecía tras un
 * "Cargando panel…", se volvía a preguntar la sesión a Supabase y todas las
 * pantallas repetían sus consultas. Se veía igual que recargar la página.
 *
 * Además la animación usa `transform`, y un ancestro con `transform` se
 * vuelve el bloque contenedor de sus hijos `position: fixed`. El sidebar es
 * fijo, así que durante los 380 ms se despegaba de la ventana y se movía con
 * la página.
 *
 * Por eso ahora se coloca DENTRO de cada marco, envolviendo solo el área de
 * contenido. Los layouts persisten entre navegaciones —que es justamente para
 * lo que sirven en el App Router— y el sidebar se queda quieto.
 *
 * No se usa View Transitions del navegador a propósito: esa API es para
 * navegación entre documentos, y aquí Next cambia de página sin recargar, así
 * que no se activaría.
 */
export default function TransicionPagina({ children }) {
  const ruta = usePathname();
  return (
    <div key={ruta} className="mc-pagina">
      {children}
    </div>
  );
}
