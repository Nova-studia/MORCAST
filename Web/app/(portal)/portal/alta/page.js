"use client";

import Link from "next/link";
import Image from "next/image";
import { registrarAlta } from "@/app/acciones-alta";
import AltaConFirma from "@/components/portal/AltaConFirma";

/**
 * Alta de cliente. Pantalla PÚBLICA: la usa quien todavía no tiene sesión, por eso
 * está exenta del shell protegido en `app/(portal)/layout.js`.
 *
 * Desde el 5-oct-2026 el alta se FIRMA: datos → "Revisa y firma" → "¡Alta
 * exitosa!" con el PDF. Todo el formulario vive en `AltaConFirma`, que es el
 * mismo del registro con Google (`/portal/registro`): las dos puertas
 * terminan igual. `registrarAlta` la guarda en `solicitudes_alta` desde el
 * servidor, genera el PDF y manda dos correos (el PDF con el enlace de
 * confirmación al cliente y el aviso a Morcast). Morcast la trabaja en el
 * panel, en Altas de clientes.
 */
export default function AltaCliente() {
  return (
    <div className="pt-alta">
      <header className="pt-alta-cab">
        <div>
          <Image
            src="/img/logo-h-blanco.png"
            alt="Morcast del Norte"
            width={688}
            height={200}
            style={{ height: 52, width: "auto" }}
            priority
          />
          <h1>Cotización/Alta</h1>
          <p>
            Marca dónde recogemos y te decimos en el momento si ya pasamos por tu zona.
          </p>
        </div>
        <Link href="/portal/login" className="pt-btn">
          Ya soy cliente
        </Link>
      </header>

      <AltaConFirma modo="publico" enviarAlta={registrarAlta} />
    </div>
  );
}
