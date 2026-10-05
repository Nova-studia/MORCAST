"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { supabaseNavegador, haySupabaseNavegador } from "@/lib/supabase-navegador";
import { registrarConGoogle } from "@/app/acciones-registro";
import AltaConFirma from "@/components/portal/AltaConFirma";

/**
 * EL ALTA DE QUIEN ENTRÓ CON GOOGLE.
 *
 * Hasta el 5-oct-2026 aquí sólo se pedían empresa y teléfono, y todo lo
 * demás se levantaba al contactarlo. El socio pidió que las dos puertas de
 * alta terminen IGUAL —alta amplia, firma electrónica, PDF y "¡Alta
 * exitosa!"—, así que esta pantalla monta el mismo `AltaConFirma` que
 * `/portal/alta`. Lo único distinto: el nombre y el correo vienen de Google,
 * y el correo ya viene verificado (no se manda enlace de confirmación).
 *
 * Va FUERA del shell protegido: quien llega aquí tiene sesión pero no tiene
 * sello, y el shell exige el sello.
 */
export default function RegistroPortal() {
  const router = useRouter();
  const [quien, setQuien] = useState(null);

  useEffect(() => {
    let vivo = true;
    if (!haySupabaseNavegador()) {
      setQuien({ nombre: "", correo: "demo@morcast.mx" });
      return;
    }
    supabaseNavegador().auth.getUser().then(({ data: { user } }) => {
      if (!vivo) return;
      if (!user) {
        router.replace("/portal/login");
        return;
      }
      setQuien({
        nombre: user.user_metadata?.full_name || user.user_metadata?.name || "",
        correo: user.email || "",
      });
    });
    return () => {
      vivo = false;
    };
  }, [router]);

  const irALaSalaDeEspera = () => {
    // refresh() antes de navegar: obliga al servidor a releer la sesión.
    router.refresh();
    router.replace("/portal/pendiente");
  };

  const enviar = async (fd) => {
    const r = await registrarConGoogle(fd);
    // Ya se había registrado antes (recargó, o le dio dos veces): no hay PDF
    // nuevo que enseñar, se va directo a la sala de espera.
    if (r?.ok && r.repetido) irALaSalaDeEspera();
    return r;
  };

  if (!quien) {
    return (
      <div className="pt-login">
        <div className="pt-cargando">Cargando…</div>
      </div>
    );
  }

  return (
    <div className="pt-alta">
      <header className="pt-alta-cab">
        <div>
          <Link href="/" aria-label="Ir a la página de Morcast del Norte">
            <Image
              /* El BLANCO: las pantallas sueltas del portal van sobre el fondo
                 casi negro, y con `logo-h.png` el renglón "DEL NORTE / MANEJO
                 DE RESIDUOS" queda verde oscuro sobre negro, ilegible. */
              src="/img/logo-h-blanco.png"
              alt="Morcast del Norte"
              width={688}
              height={200}
              style={{ height: 52, width: "auto" }}
              priority
            />
          </Link>
          <h1>Un paso más: tu alta</h1>
          <p>
            Ya te identificamos como <strong>{quien.correo}</strong>. Completa los datos de tu empresa y firma
            tu solicitud. Registrarte no te da acceso todavía: Morcast revisa tu alta y activa tu cuenta.
          </p>
        </div>
      </header>

      <AltaConFirma
        modo="google"
        quien={quien}
        enviarAlta={enviar}
        accionesFinales={() => (
          <button type="button" className="pt-btn" onClick={irALaSalaDeEspera}>
            Continuar <ArrowRight aria-hidden="true" />
          </button>
        )}
      />
    </div>
  );
}
