import { Suspense } from "react";
import PantallaAvisos from "./PantallaAvisos";

/**
 * AVISOS A CLIENTES (/admin/avisos).
 *
 * Esta página es de servidor solo por una razón: fijar `maxDuration`. Mandar
 * un aviso escribe un correo por empresa, a menos de dos por segundo para no
 * chocar con el límite de Resend (app/acciones-avisos.js): con los 43
 * clientes de hoy son unos 24 segundos, más que el tope por omisión de una
 * función en Vercel. La guía de Next 16 dice que el tiempo de las acciones
 * de servidor se fija en la PÁGINA que las usa, y una página "use client" no
 * puede exportarlo.
 */
export const maxDuration = 60;

export default function AvisosAdmin() {
  // useSearchParams() (el prellenado desde un incidente) necesita un
  // Suspense alrededor o la compilación falla — igual que en /admin/verificacion.
  return (
    <Suspense fallback={<div className="pt-cargando">Cargando…</div>}>
      <PantallaAvisos />
    </Suspense>
  );
}
