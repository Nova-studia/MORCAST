"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Clock, Phone, Envelope, WhatsappLogo, ArrowClockwise } from "@phosphor-icons/react/dist/ssr";
import { EMPRESA } from "@/lib/datos";
import { supabaseNavegador, haySupabaseNavegador } from "@/lib/supabase-navegador";
import { cerrarSesion } from "@/lib/portal-sesion";
import { miSolicitud } from "@/app/acciones-registro";

/**
 * SALA DE ESPERA: la cuenta existe pero la empresa todavía no la activa.
 *
 * Los teléfonos y correos salen de `EMPRESA` (lib/datos.js) y NO se escriben
 * aquí a mano: los correos de hoy son los personales del cliente, marcados
 * como temporales, y se cambian por los buzones @morcast.mx cuando se los
 * entreguen. Escritos aquí, esta pantalla se quedaría vieja sin que nadie lo
 * note.
 */
export default function PendientePortal() {
  const router = useRouter();
  const [folio, setFolio] = useState("");
  const [revisando, setRevisando] = useState(false);
  const [sinNovedad, setSinNovedad] = useState(false);

  useEffect(() => {
    let vivo = true;
    if (!haySupabaseNavegador()) return;
    supabaseNavegador().auth.getUser().then(async ({ data: { user } }) => {
      if (!vivo) return;
      if (!user) {
        router.replace("/portal/login");
        return;
      }
      // Si ya trae sello, aquí no pinta nada.
      if (user.app_metadata?.rol) {
        router.replace("/portal");
        return;
      }
      // Sin parametro: la accion saca el id de la sesion. Ver el comentario
      // de `miSolicitud` en acciones-registro.js.
      const solicitud = await miSolicitud();
      if (!vivo) return;
      // Llegó sin haber capturado nada: primero los datos.
      if (!solicitud) {
        router.replace("/portal/registro");
        return;
      }
      setFolio(solicitud.folio);
    });
    return () => {
      vivo = false;
    };
  }, [router]);

  /**
   * "Ya me activaron — revisar".
   *
   * ⚠️ Poner el sello en el panel NO cambia el token que esta persona ya
   * tiene en su navegador: seguiría viendo este aviso hasta que caduque, como
   * una hora. `refreshSession()` pide uno nuevo, y ese sí trae el sello.
   * Sin este botón, la entrega parece rota justo en el minuto en que Morcast
   * activa a alguien y se lo dice por teléfono.
   *
   * Guardia de modo demostración: sin Supabase no hay sesión real que
   * refrescar. `useEffect` sale temprano en ese caso, pero este botón lo
   * dispara el usuario, no el efecto, así que necesita su propia guardia o
   * `supabaseNavegador()` truena por faltar las variables de entorno.
   */
  const revisar = async () => {
    if (!haySupabaseNavegador()) return;
    setRevisando(true);
    setSinNovedad(false);
    const { data } = await supabaseNavegador().auth.refreshSession();
    if (data?.user?.app_metadata?.rol) {
      router.refresh();
      router.replace("/portal");
      return;
    }
    setRevisando(false);
    setSinNovedad(true);
  };

  const salir = async () => {
    await cerrarSesion();
    router.refresh();
    router.replace("/portal/login");
  };

  const soloDigitos = (t) => String(t || "").replace(/\D/g, "");

  return (
    <div className="pt-login">
      <div
        className="pt-login-form-lado"
        /* `.pt-login` es una rejilla de DOS columnas (portal.css:592).
           Esta pantalla monta un solo hijo, asi que sin esto la tarjeta
           se queda en la mitad izquierda con la derecha en blanco. No
           lleva `margin: 0 auto`: `.pt-login-form-lado` ya centra con
           flex, y en el telefono la rejilla colapsa a una columna, donde
           `1 / -1` sigue siendo correcto. */
        style={{ gridColumn: "1 / -1" }}
      >
        <div className="pt-login-card">
          <Link href="/" className="pt-login-marca" aria-label="Ir a la página de Morcast del Norte">
            <Image
              src="/img/logo-h.png"
              alt="Morcast del Norte"
              width={688}
              height={200}
              style={{ width: "auto", height: 48 }}
              priority
            />
          </Link>

          <h1 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Clock weight="duotone" /> Tu cuenta está en espera
          </h1>

          <p>
            Tu cuenta ya está <strong>registrada</strong>, pero todavía{" "}
            <strong>no está activada</strong>. Por favor espera mientras la empresa la
            revisa y la activa. Te avisamos por correo en cuanto quede lista.
          </p>

          {folio && (
            <p style={{ fontSize: "0.9rem", color: "var(--mc-gris)" }}>
              Tu folio de registro es <strong>{folio}</strong>. Tenlo a la mano si nos llamas.
            </p>
          )}

          <div style={{ margin: "1.4rem 0 0.6rem", fontWeight: 600 }}>
            ¿Tienes dudas? Contáctanos:
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {EMPRESA.telefonos.map((tel) => (
              <a key={tel} className="pt-btn" href={`tel:${soloDigitos(tel)}`}>
                <Phone /> {tel}
              </a>
            ))}
            <a
              className="pt-btn"
              target="_blank"
              rel="noreferrer"
              href={`https://wa.me/${EMPRESA.whatsapp}?text=${encodeURIComponent(
                `Hola, me registré en morcast.mx${folio ? ` con el folio ${folio}` : ""} y quiero preguntar por la activación de mi cuenta.`
              )}`}
            >
              <WhatsappLogo /> WhatsApp
            </a>
            {EMPRESA.correos.map((correo) => (
              <a key={correo} className="pt-btn" href={`mailto:${correo}?subject=${encodeURIComponent(`Activación de mi cuenta${folio ? ` (${folio})` : ""}`)}`}>
                <Envelope /> {correo}
              </a>
            ))}
          </div>

          <p style={{ fontSize: "0.85rem", color: "var(--mc-gris)", marginTop: "0.9rem" }}>
            {EMPRESA.horario}
          </p>

          <hr style={{ margin: "1.4rem 0", opacity: 0.15 }} />

          <button
            type="button"
            className="pt-btn pt-btn-verde"
            style={{ width: "100%", justifyContent: "center" }}
            onClick={revisar}
            disabled={revisando}
          >
            <ArrowClockwise /> {revisando ? "Revisando…" : "Ya me activaron — revisar"}
          </button>

          {sinNovedad && (
            <p style={{ fontSize: "0.86rem", color: "var(--mc-gris)", marginTop: "0.6rem", textAlign: "center" }}>
              Todavía no. En cuanto la empresa la active, este botón te deja entrar.
            </p>
          )}

          <p style={{ textAlign: "center", marginTop: "1rem" }}>
            <button
              type="button"
              onClick={salir}
              style={{ background: "none", border: "none", color: "var(--mc-gris)", cursor: "pointer", fontSize: "0.86rem", textDecoration: "underline" }}
            >
              Cerrar sesión
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
