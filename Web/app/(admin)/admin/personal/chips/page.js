import { normalizarCodigo } from "@/lib/gafetes.mjs";
import { chipGrabado } from "../acciones";
import GrabarChip from "./GrabarChip";

export const metadata = { title: "Grabar chips de gafetes · Morcast" };

/**
 * GRABAR EL CHIP NFC DE UN GAFETE (ver lib/chip-nfc.mjs).
 *
 * La imprenta entrega las tarjetas con el QR impreso y el chip en blanco;
 * aquí Morcast le graba a cada chip el mismo enlace de su QR y lo sella. Se
 * abre en un Android con Chrome, que es donde existe Web NFC.
 *
 * Para grabar no consulta la base: lo único que necesita es el código de
 * la tarjeta, que se teclea, sale de una foto del QR o llega en la URL
 * (`?c=…`, desde la ficha de un empleado). Al terminar cada chip le avisa a
 * la acción `chipGrabado`, que lo anota en el gafete de ese código. Queda
 * detrás de la sección Personal por su ruta (lib/permisos.mjs).
 */
export default async function ChipsPage({ searchParams }) {
  const p = await searchParams;
  const codigo = normalizarCodigo(typeof p.c === "string" ? p.c : "") || "";
  return <GrabarChip codigoInicial={codigo} alGrabar={chipGrabado} />;
}
