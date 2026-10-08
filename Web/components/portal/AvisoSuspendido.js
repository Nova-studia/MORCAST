import { WhatsappLogo, Phone, WarningOctagon } from "@phosphor-icons/react/dist/ssr";
import { AVISO_SUSPENDIDO } from "@/lib/estado-cliente.mjs";
import { enlaceWhatsApp } from "@/lib/datos";
import { EMPRESA_COTIZACION } from "@/lib/cotizacion-datos";

/**
 * AVISO ROJO DE CUENTA SUSPENDIDA (Luis, 8-oct-2026): fijo hasta arriba de
 * todo el portal. El cliente suspendido entra y ve todo, pero solo puede
 * Agregar saldo (la causa típica es la falta de pago); la base ya le cierra
 * lo demás (db/028).
 */
export default function AvisoSuspendido({ folio, empresa }) {
  const telefono = EMPRESA_COTIZACION.telefonos[0];
  const mensaje = `Hola, mi cuenta de Morcast${empresa ? ` (${empresa}${folio ? `, ${folio}` : ""})` : ""} está suspendida y quiero restablecerla.`;
  return (
    <div
      role="alert"
      style={{
        // Va arriba de la barra del portal y NO es pegajoso: con `sticky` tapaba
        // la barra (y el botón del menú en el teléfono) al hacer scroll.
        background: "#b3261e", color: "#fff",
        padding: "0.7rem 1rem", display: "flex", alignItems: "center", gap: "0.8rem", flexWrap: "wrap",
        boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
      }}
    >
      <WarningOctagon size={24} weight="fill" aria-hidden="true" />
      <strong style={{ flex: "1 1 240px", fontSize: "0.98rem" }}>{AVISO_SUSPENDIDO}</strong>
      <a href={enlaceWhatsApp(mensaje)} target="_blank" rel="noopener noreferrer"
        style={{ color: "#fff", background: "rgba(255,255,255,0.18)", borderRadius: 8, padding: "0.4rem 0.75rem", fontWeight: 700, display: "inline-flex", gap: 6, alignItems: "center", textDecoration: "none" }}>
        <WhatsappLogo size={18} /> WhatsApp
      </a>
      <a href={`tel:+52${telefono.replace(/\D/g, "")}`}
        style={{ color: "#fff", background: "rgba(255,255,255,0.18)", borderRadius: 8, padding: "0.4rem 0.75rem", fontWeight: 700, display: "inline-flex", gap: 6, alignItems: "center", textDecoration: "none" }}>
        <Phone size={18} /> {telefono}
      </a>
    </div>
  );
}
