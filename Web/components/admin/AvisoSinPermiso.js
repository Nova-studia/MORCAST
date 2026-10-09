"use client";

import { useSearchParams } from "next/navigation";
import { SECCIONES } from "@/lib/permisos.mjs";

/**
 * "Tu rol no incluye X": proxy.js rebota al Panel con ?sin_permiso=<sección>
 * a quien abre una sección que su rol no tiene (db/029). Va con la búsqueda y
 * no con la ruta, porque el rebote suele caer en la MISMA ruta (un clic desde
 * el Panel que vuelve al Panel). Aparte y dentro de <Suspense>, porque
 * `useSearchParams` lo pide así para no tumbar el prerender del marco.
 */
export default function AvisoSinPermiso() {
  const p = useSearchParams()?.get("sin_permiso");
  const texto = SECCIONES.find((x) => x.id === p)?.texto;
  if (!texto) return null;
  return (
    <div className="pt-login-error" role="alert" style={{ marginBottom: "1rem" }}>
      Tu rol no incluye <strong>{texto}</strong>. Si lo necesitas, pídeselo al dueño.
    </div>
  );
}
