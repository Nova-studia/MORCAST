import Image from "next/image";
import Link from "next/link";
import { estadoConfirmacion } from "@/lib/alta-servidor";
import ConfirmarAlta from "@/components/portal/ConfirmarAlta";

/**
 * A DONDE LLEVA EL ENLACE "Confirmar mi solicitud" DEL CORREO.
 *
 * Abrir esta página NO confirma nada: sólo revisa (leyendo, sin gastarlo)
 * si el enlace sirve, y enseña el botón. Confirmar es un clic, que va por
 * una acción de servidor (POST). Así, el antivirus o el filtro del correo de
 * una empresa —que abren cada enlace para revisarlo— no confirman en nombre
 * de nadie.
 *
 * Es pública (va en `ABIERTAS` de proxy.js por colgar de /portal/alta) y va
 * sin el shell del portal (`SIN_SHELL` del layout): quien confirma todavía no
 * tiene cuenta.
 */

export const metadata = {
  title: "Confirmar solicitud de alta",
  // El enlace lleva un token: que ningún buscador guarde la página.
  robots: { index: false, follow: false },
};

export default async function PaginaConfirmar({ searchParams }) {
  const { t } = await searchParams;
  const token = typeof t === "string" ? t : "";
  const info = await estadoConfirmacion(token);

  return (
    <div className="pt-alta pt-alta-angosta">
      <header className="pt-alta-cab">
        <div>
          <Link href="/" aria-label="Ir a la página de Morcast del Norte">
            <Image
              src="/img/logo-h-blanco.png"
              alt="Morcast del Norte"
              width={688}
              height={200}
              style={{ height: 52, width: "auto" }}
              priority
            />
          </Link>
          <h1>Confirma tu solicitud</h1>
          <p>Un clic para confirmar que este correo es tuyo y terminar tu alta.</p>
        </div>
      </header>
      <ConfirmarAlta token={token} estado={info.estado} folio={info.folio} empresa={info.empresa} demo={Boolean(info.demo)} />
    </div>
  );
}
