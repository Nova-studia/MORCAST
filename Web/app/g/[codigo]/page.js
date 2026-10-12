import { normalizarCodigo } from "@/lib/gafetes.mjs";
import { fichaPublica } from "@/lib/personal.mjs";
import { almacenPersonal } from "@/lib/personal-almacen";
import { EMPRESA } from "@/lib/datos";
import VerGafete from "./VerGafete";

/**
 * LO QUE ABRE EL QR Y EL CHIP DE UN GAFETE: morcast.mx/g/<código>.
 *
 * Nivel 1, sin sesión y sin PIN: el sello VIGENTE o NO VÁLIDO y, si es
 * vigente, lo mismo que va impreso en la tarjeta (foto, nombre, puesto,
 * número, área). Los datos de emergencia NO viajan en esta página: se piden
 * aparte con el PIN (acciones.js). Diseño:
 * docs/superpowers/specs/2026-10-09-gafetes-personal-design.md.
 *
 * Se arma en cada visita, nunca prerenderizada ni en caché: una baja tiene
 * que verse al instante. Y fuera de los buscadores.
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Verificación de gafete",
  description: "Verificación de gafetes del personal de Morcast del Norte.",
  robots: { index: false, follow: false, nocache: true },
};

export default async function GafetePage({ params }) {
  const { codigo } = await params;
  const c = normalizarCodigo(codigo);

  // Un código que no existe y uno dado de baja dan la misma pantalla. Si la
  // base no contesta NO se dice "no válido": sería negarle la entrada a
  // alguien que sí trabaja aquí por una falla nuestra.
  let ficha = { estado: "no-valido" };
  if (c) {
    try {
      ficha = fichaPublica(await almacenPersonal().gafetePorCodigo(c));
    } catch {
      ficha = { estado: "sin-respuesta" };
    }
  }

  return (
    <VerGafete
      codigo={c || ""}
      ficha={ficha}
      ahora={Date.now()}
      telefono={EMPRESA.telefonos[0]}
    />
  );
}
