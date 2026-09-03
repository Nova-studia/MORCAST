import { Instrument_Sans, JetBrains_Mono } from "next/font/google";
import "bootstrap/dist/css/bootstrap.min.css";
import "./globals.css";

import { EMPRESA } from "@/lib/datos";
import LuzCursor from "@/components/LuzCursor";

// Ver DESIGN.md. Dos familias y dos oficios: una para leer, otra para medir.
// Instrument Sans lleva titulares (en MAYUSCULAS espaciadas) y cuerpo; el
// titular usa la misma familia a proposito, para que el sistema sea de dos
// tipografias y no de tres.
const cuerpo = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--fuente-cuerpo",
  display: "swap",
});

// JetBrains Mono SOLO para cifras, codigos de permiso, medidas y fechas.
// Nunca para una frase completa: ahi la pagina se ve "tecnologica" y se
// pierde lo formal.
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--fuente-mono",
  display: "swap",
});

export const metadata = {
  metadataBase: new URL(EMPRESA.sitio),
  title: {
    default:
      "Morcast del Norte | Recolección de residuos en Matamoros, Tamaulipas",
    template: "%s | Morcast del Norte",
  },
  description:
    "Servicio integral de recolección, transporte y disposición final de residuos sólidos, líquidos y de manejo especial en Matamoros, Tamaulipas. Contenedores de 1.5, 3 y 6 m³, tolvas de 15 y 30 m³, pipas certificadas y permisos vigentes.",
  keywords: [
    "recolección de basura Matamoros",
    "manejo de residuos Matamoros",
    "residuos sólidos urbanos Tamaulipas",
    "residuos de manejo especial",
    "renta de contenedores Matamoros",
    "aguas residuales Matamoros",
    "aguas oleosas",
    "reciclaje industrial Matamoros",
    "recolección industrial maquiladoras",
  ],
  authors: [{ name: EMPRESA.razonSocial }],
  openGraph: {
    type: "website",
    locale: "es_MX",
    url: EMPRESA.sitio,
    siteName: "Morcast del Norte",
    title: "Morcast del Norte | Manejo integral de residuos en Matamoros",
    description:
      "Recolección, transporte y disposición final de residuos sólidos, líquidos y de manejo especial. Permisos vigentes y flota propia en Matamoros, Tamaulipas.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport = {
  themeColor: "#144C4F",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="es-MX"
      data-scroll-behavior="smooth"
      className={`${cuerpo.variable} ${mono.variable}`}
    >
      {/* El navbar/footer los pone cada route group: (claro) o (oscuro) */}
      {/* La transición al cambiar de página también: va dentro de cada marco,
          envolviendo solo el contenido. Aquí arriba desmontaba los layouts
          enteros en cada click — ver components/TransicionPagina.js. */}
      <body style={{ fontFamily: "var(--fuente-cuerpo), system-ui, sans-serif" }}>
        <div className="mc-avance" aria-hidden="true" />
        <LuzCursor />
        {children}
      </body>
    </html>
  );
}
