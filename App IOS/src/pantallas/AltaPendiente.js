import { useEffect, useState } from "react";
import { View, Text, Image, ScrollView, Pressable, StyleSheet, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "../tema";
import { Boton } from "../ui";
import { sesionPendiente } from "../sesion";
import { miSolicitud, revisarAlta } from "../entrar-social";
import { textoPendiente } from "../entrada-social.mjs";
import { abrirEnNavegador, URL_PORTAL_LOGIN, URL_ALTA } from "../enlaces-web";
import { EMPRESA_COTIZACION } from "../cotizacion-datos";
import { abrirWhatsApp } from "../whatsapp";

/**
 * SALA DE ESPERA: la cuenta existe (entró con Google o Apple) pero Morcast
 * todavía no la activa. Espejo de `Web/app/(portal)/portal/pendiente/page.js`.
 *
 * El alta (mapa del domicilio y firma) se hace en morcast.mx con ESA MISMA
 * cuenta: la app no la copia, la abre. Cuando Morcast la activa, "Ya me
 * activaron — revisar" pide un token nuevo y entra.
 *
 * ⚠️ ESTE ARCHIVO ESTÁ DUPLICADO en las dos apps; sólo cambia la extensión
 * del import de `entrada-social` (`.mjs` en iOS, `.js` en Android).
 */
export default function AltaPendiente({ onActivo, onSalir }) {
  const [cuenta, setCuenta] = useState(null);
  const [solicitud, setSolicitud] = useState(null);
  const [revisando, setRevisando] = useState(false);
  const [aviso, setAviso] = useState("");

  /** Qué hacer con lo que contestó `revisarAlta()`. */
  const atender = (r, { callado = false } = {}) => {
    if (r.tipo === "activo") {
      onActivo?.(r.modo);
      return;
    }
    if (r.tipo === "sesion-cerrada") {
      // Al activar, el panel le pone contraseña a la cuenta y eso cierra sus
      // sesiones: no es que "todavía no", es que ya, y hay que volver a entrar.
      Alert.alert(
        "Vuelve a entrar",
        "Tu sesión se cerró. Si Morcast ya activó tu cuenta, entra otra vez con Google, con Apple o con tu correo y contraseña.",
        [{ text: "Entendido", onPress: () => onSalir?.() }]
      );
      return;
    }
    if (callado) return;
    setAviso(
      r.tipo === "sin-red"
        ? "No hay conexión. Revisa tu señal e inténtalo otra vez."
        : "Todavía no. En cuanto la empresa la active, este botón te deja entrar."
    );
  };

  useEffect(() => {
    let vivo = true;
    (async () => {
      const c = await sesionPendiente().catch(() => null);
      if (!vivo) return;
      setCuenta(c);
      if (c?.id) {
        const sol = await miSolicitud(c.id);
        if (vivo) setSolicitud(sol);
      }
      // Al abrir se revisa una vez, sin avisos: si ya la activaron mientras
      // la app estaba cerrada, entra directo sin que tenga que tocar nada.
      const r = await revisarAlta();
      if (vivo) atender(r, { callado: true });
    })();
    return () => { vivo = false; };
  }, []);

  const revisar = async () => {
    if (revisando) return;
    setRevisando(true);
    setAviso("");
    const r = await revisarAlta();
    setRevisando(false);
    atender(r);
  };

  const texto = textoPendiente(solicitud);
  const telefono = EMPRESA_COTIZACION.telefonos[0];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: T.fondo }} contentContainerStyle={s.scroll}>
      <View style={s.hero}>
        <Image source={require("../../assets/logo-morcast.png")} style={s.logo} resizeMode="contain" />
      </View>

      <View style={s.tarjeta}>
        <View style={s.titulo}>
          <Feather name="clock" size={22} color={T.accionTxt} />
          <Text style={s.h1}>{texto.titulo}</Text>
        </View>
        <Text style={s.p}>{texto.cuerpo}</Text>
        {texto.nota ? <Text style={s.nota}>{texto.nota}</Text> : null}
        {texto.folio ? (
          <Text style={s.nota}>
            Tu folio de registro es <Text style={{ fontWeight: "800", color: T.tinta }}>{texto.folio}</Text>. Tenlo a la mano si nos llamas.
          </Text>
        ) : null}
        {cuenta?.correo ? (
          <Text style={s.cuenta}>
            Entraste como <Text style={{ fontWeight: "700", color: T.tinta }}>{cuenta.correo}</Text>
          </Text>
        ) : null}

        {texto.pedirAlta ? (
          <Boton onPress={() => abrirEnNavegador(URL_PORTAL_LOGIN)} style={{ marginTop: 18 }}>
            Completar mi alta en morcast.mx
          </Boton>
        ) : null}
        {/* La puerta directa al formulario de alta (6-oct-2026), por si no
            quiere pasar por el login de la web. Solo cuando todavía falta el
            alta: si ya la mandó, otra solo duplicaría la solicitud. */}
        {texto.pedirAlta ? (
          <Pressable
            onPress={() => abrirEnNavegador(URL_ALTA)}
            style={({ pressed }) => [s.alta, pressed && { opacity: 0.8 }]}
            accessibilityRole="link"
            accessibilityLabel="¿Aún no eres cliente? Date de alta en morcast.mx"
          >
            <Text style={s.altaTxt}>¿Aún no eres cliente? <Text style={s.altaFuerte}>Date de alta</Text></Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={revisar}
          disabled={revisando}
          style={({ pressed }) => [s.revisar, (pressed || revisando) && { opacity: 0.8 }]}
          accessibilityRole="button"
        >
          <Feather name="refresh-cw" size={16} color={T.accionTxt} />
          <Text style={s.revisarTxt}>{revisando ? "Revisando…" : "Ya me activaron — revisar"}</Text>
        </Pressable>
        {aviso ? <Text style={s.aviso}>{aviso}</Text> : null}
      </View>

      <Text style={s.dudas}>¿Tienes dudas? Contáctanos:</Text>
      <Pressable
        onPress={() =>
          abrirWhatsApp(
            telefono,
            `Hola, me registré en la app de Morcast${cuenta?.correo ? ` con el correo ${cuenta.correo}` : ""}${texto.folio ? ` (folio ${texto.folio})` : ""} y quiero preguntar por la activación de mi cuenta.`
          )
        }
        style={({ pressed }) => [s.contacto, pressed && { opacity: 0.8 }]}
        accessibilityRole="button"
      >
        <Feather name="message-circle" size={16} color={T.gris} />
        <Text style={s.contactoTxt}>WhatsApp · {telefono}</Text>
      </Pressable>

      <Pressable onPress={onSalir} style={s.salir} accessibilityRole="button">
        <Feather name="log-out" size={15} color={T.gris} />
        <Text style={s.salirTxt}>Salir</Text>
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { padding: 24, paddingTop: 40, paddingBottom: 40, flexGrow: 1, justifyContent: "center" },
  hero: { alignItems: "center", marginBottom: 24 },
  logo: { width: 210, height: 88 },
  tarjeta: { backgroundColor: T.panel, borderWidth: 1, borderColor: T.linea, borderRadius: 14, padding: 18 },
  titulo: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  h1: { color: T.tinta, fontSize: 21, fontWeight: "800", letterSpacing: -0.3, flex: 1 },
  p: { color: T.tinta, fontSize: 14.5, lineHeight: 21 },
  nota: { color: T.gris, fontSize: 13.5, lineHeight: 19, marginTop: 10 },
  cuenta: { color: T.gris, fontSize: 13, marginTop: 12 },
  revisar: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    borderWidth: 1, borderColor: T.accion, backgroundColor: T.accionTinte,
    borderRadius: 11, paddingVertical: 13, marginTop: 10,
  },
  revisarTxt: { color: T.accionTxt, fontSize: 14.5, fontWeight: "700" },
  aviso: { color: T.gris, fontSize: 13, textAlign: "center", marginTop: 10 },
  alta: { alignItems: "center", paddingVertical: 12, marginTop: 4 },
  altaTxt: { color: T.gris, fontSize: 13.5 },
  altaFuerte: { color: T.accionTxt, fontWeight: "700", textDecorationLine: "underline" },
  dudas: { color: T.gris, fontSize: 13, textAlign: "center", marginTop: 22, marginBottom: 8 },
  contacto: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: T.linea, borderRadius: 10, paddingVertical: 11 },
  contactoTxt: { color: T.gris, fontSize: 13.5, fontWeight: "600" },
  salir: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 16, padding: 8 },
  salirTxt: { color: T.gris, fontSize: 13.5, textDecorationLine: "underline" },
});
