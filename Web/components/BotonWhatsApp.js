import { FaWhatsapp } from "react-icons/fa";
import { enlaceWhatsApp } from "@/lib/datos";

export default function BotonWhatsApp() {
  return (
    <a
      href={enlaceWhatsApp()}
      target="_blank"
      rel="noopener noreferrer"
      className="mc-wa"
      aria-label="Escríbenos por WhatsApp"
      title="Escríbenos por WhatsApp"
    >
      <FaWhatsapp aria-hidden="true" />
    </a>
  );
}
