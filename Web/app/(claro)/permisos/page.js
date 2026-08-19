import { Encabezado, Permisos, BandaCTA } from "@/components/Secciones";

export const metadata = {
  title: "Permisos y cumplimiento normativo",
  description:
    "Permisos vigentes de Morcast del Norte: autorización municipal para Residuos Sólidos Urbanos, registro estatal SEDUMA para Residuos de Manejo Especial y convenio con tercero autorizado para Residuos Peligrosos.",
  alternates: { canonical: "/permisos" },
};

export default function PaginaPermisos() {
  return (
    <>
      <Encabezado
        miga="Permisos"
        titulo="Permisos y cumplimiento normativo"
        descripcion="Operamos con todos los permisos y autorizaciones vigentes para la disposición de residuos, y entregamos el Manifiesto del Protocolo de Disposición que respalda legalmente a tu empresa."
      />

      <Permisos />

      <BandaCTA
        titulo="¿Tu proveedor actual te entrega manifiesto?"
        texto="Con Morcast tu empresa cumple los requisitos legales y ambientales, evita multas y ahorra mediante un manejo adecuado de residuos."
      />
    </>
  );
}
