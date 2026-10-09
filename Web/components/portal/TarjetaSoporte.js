import { WhatsappLogo, Phone, EnvelopeSimple, Headset } from "@phosphor-icons/react/dist/ssr";
import { EMPRESA, enlaceWhatsApp } from "@/lib/datos";

/**
 * SOPORTE A LA MANO (Entrega 4, 9-oct-2026): el portal no tenía cómo
 * contactar a Morcast desde adentro. WhatsApp con un mensaje ya escrito,
 * teléfono y correo, en Inicio y en Mi cuenta. `compacta` para meterla en
 * una fila (p. ej. junto a una recolección vencida).
 */
export default function TarjetaSoporte({ empresa, folio, mensaje, compacta = false }) {
  const telefono = EMPRESA.telefonos[0];
  const texto = mensaje || `Hola, soy de ${empresa || "mi empresa"}${folio ? ` (cliente ${folio})` : ""} y necesito ayuda con mi servicio.`;
  const enlaces = (
    <>
      <a className="pt-btn pt-btn-verde" href={enlaceWhatsApp(texto)} target="_blank" rel="noopener noreferrer">
        <WhatsappLogo /> {compacta ? "Contáctanos" : "WhatsApp"}
      </a>
      {!compacta && (
        <>
          <a className="pt-btn" href={`tel:+52${telefono.replace(/\D/g, "")}`}>
            <Phone /> {telefono}
          </a>
          <a className="pt-btn" href={`mailto:${EMPRESA.correoPrivacidad}`}>
            <EnvelopeSimple /> {EMPRESA.correoPrivacidad}
          </a>
        </>
      )}
    </>
  );
  if (compacta) return enlaces;
  return (
    <div className="pt-card">
      <div className="pt-card-head"><h2><Headset aria-hidden="true" style={{ verticalAlign: "-3px", marginRight: 6 }} />¿Necesitas ayuda?</h2></div>
      <p style={{ color: "var(--mc-gris)", fontSize: "0.88rem", marginTop: 0 }}>
        Escríbenos o llámanos. {EMPRESA.horario}
      </p>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>{enlaces}</div>
    </div>
  );
}
