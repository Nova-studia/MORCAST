import { Info } from "@phosphor-icons/react/dist/ssr";

/**
 * AVISO DE QUE LOS PRECIOS PUEDEN CAMBIAR.
 *
 * Pedido de los dueños (4-oct-2026): en la web y en la app, junto a
 * CUALQUIER precio o cotización, un aviso importante y claramente visible de
 * que, a pesar de la cotización, el precio puede modificarse. Un solo
 * componente para que el texto sea siempre el mismo en todas partes; si los
 * dueños lo quieren cambiar, se cambia aquí.
 *
 * `compacto` es para espacios chicos (junto a una cifra); el normal es para
 * encabezar una página de precios.
 */
export const TEXTO_AVISO_PRECIOS =
  "A pesar de la cotización, los precios pueden tener modificaciones. El monto final depende del tipo de residuo, el volumen y las condiciones del servicio.";

export default function AvisoPrecios({ compacto = false, style }) {
  return (
    <div
      role="note"
      style={{
        display: "flex",
        gap: "0.6rem",
        alignItems: "flex-start",
        background: "#eef4fa",
        border: "1px solid #2a6a99",
        borderLeftWidth: "4px",
        borderRadius: "8px",
        padding: compacto ? "0.5rem 0.75rem" : "0.8rem 1rem",
        margin: compacto ? "0.5rem 0" : "0 0 1.2rem",
        color: "#163a55",
        fontSize: compacto ? "0.8rem" : "0.9rem",
        lineHeight: 1.45,
        ...style,
      }}
    >
      <Info size={compacto ? 16 : 20} weight="fill" style={{ flexShrink: 0, marginTop: "0.1rem", color: "#2a6a99" }} />
      <div>
        <strong>Importante:</strong> {TEXTO_AVISO_PRECIOS}
      </div>
    </div>
  );
}
