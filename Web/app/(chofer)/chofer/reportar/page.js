import ChoferReporte from "@/components/chofer/ChoferReporte";

/**
 * /chofer/reportar — avisar a la oficina de un accidente, un retraso, una
 * falla o un contenedor dañado, movido o que no está.
 *
 * Página de servidor solo para leer `?parada=` (cuando se abre desde una
 * parada) sin envolver el formulario en Suspense por `useSearchParams`. Todo
 * lo demás —sesión, datos, envío— lo hace el formulario en el teléfono.
 */
export default async function ReportarChofer({ searchParams }) {
  const { parada } = await searchParams;
  return <ChoferReporte paradaInicial={typeof parada === "string" ? parada : ""} />;
}
