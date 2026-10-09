import { View, Text, Pressable, Linking, StyleSheet, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "./tema";
import { Tarjeta, TituloTarjeta } from "./ui";
import { abrirWhatsApp } from "./whatsapp";
import { EMPRESA_COTIZACION, HORARIOS } from "./cotizacion-datos";
import { mensajeSoporte, mensajeSuspendido } from "./cliente-app.mjs";
import { AVISO_SUSPENDIDO } from "./web/estado-cliente.mjs";
import { useEstadoCliente } from "./estado-cliente-app";

/**
 * SOPORTE A LA MANO (apps al 100%, fase B; como `TarjetaSoporte` y
 * `AvisoSuspendido` de la web). La app no tenía cómo contactar a Morcast
 * desde adentro: el cliente con un problema tenía que buscar el número.
 */

export const TELEFONO_SOPORTE = EMPRESA_COTIZACION.telefonos[0];
// El buzón de contacto de la web (`EMPRESA.correoPrivacidad` en
// Web/lib/datos.js). Si cambia allá, cambiarlo aquí.
export const CORREO_SOPORTE = "contacto@morcast.mx";

const llamar = () =>
  Linking.openURL(`tel:+52${TELEFONO_SOPORTE.replace(/\D/g, "")}`).catch(() =>
    Alert.alert("No se pudo llamar", `Márcanos al ${TELEFONO_SOPORTE}.`)
  );
const escribirCorreo = () =>
  Linking.openURL(`mailto:${CORREO_SOPORTE}`).catch(() =>
    Alert.alert("No se pudo abrir el correo", `Escríbenos a ${CORREO_SOPORTE}.`)
  );

/** "¿Necesitas ayuda?": WhatsApp con el mensaje ya escrito, teléfono y correo. */
export default function TarjetaSoporte({ empresa, folio, mensaje }) {
  return (
    <Tarjeta>
      <TituloTarjeta>¿Necesitas ayuda?</TituloTarjeta>
      <Text style={s.nota}>Escríbenos o llámanos. {HORARIOS.resumen}</Text>
      <View style={s.fila}>
        <Boton icono="message-circle" onPress={() => abrirWhatsApp(TELEFONO_SOPORTE, mensaje || mensajeSoporte({ empresa, folio }))} principal>
          WhatsApp
        </Boton>
        <Boton icono="phone" onPress={llamar}>{TELEFONO_SOPORTE}</Boton>
        <Boton icono="mail" onPress={escribirCorreo}>{CORREO_SOPORTE}</Boton>
      </View>
    </Tarjeta>
  );
}

/** El botón chico de "Contáctanos" (junto a una recolección vencida). */
export function BotonContactanos({ mensaje }) {
  return (
    <Boton icono="message-circle" onPress={() => abrirWhatsApp(TELEFONO_SOPORTE, mensaje)} principal>
      Contáctanos
    </Boton>
  );
}

/**
 * LA BANDA ROJA DE CUENTA SUSPENDIDA: arriba de todo, en todas las pantallas
 * del cliente, mientras su empresa siga suspendida. Entra y ve, pero solo
 * puede agregar saldo (la causa típica es la falta de pago).
 */
export function AvisoSuspendido({ empresa, folio }) {
  return (
    <View style={s.banda} accessibilityRole="alert">
      <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
        <Feather name="alert-octagon" size={20} color="#fff" />
        <Text style={s.bandaTxt}>{AVISO_SUSPENDIDO}</Text>
      </View>
      <View style={[s.fila, { marginTop: 8 }]}>
        <Pressable onPress={() => abrirWhatsApp(TELEFONO_SOPORTE, mensajeSuspendido({ empresa, folio }))} style={s.bandaBtn} accessibilityRole="button">
          <Feather name="message-circle" size={15} color="#fff" />
          <Text style={s.bandaBtnTxt}>WhatsApp</Text>
        </Pressable>
        <Pressable onPress={llamar} style={s.bandaBtn} accessibilityRole="button" accessibilityLabel={`Llamar al ${TELEFONO_SOPORTE}`}>
          <Feather name="phone" size={15} color="#fff" />
          <Text style={s.bandaBtnTxt}>{TELEFONO_SOPORTE}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Boton({ icono, onPress, principal, children }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [s.btn, principal && s.btnPrincipal, { opacity: pressed ? 0.85 : 1 }]}
    >
      <Feather name={icono} size={15} color={principal ? "#fff" : T.tinta} />
      <Text style={[s.btnTxt, principal && { color: "#fff" }]} numberOfLines={1}>{children}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  nota: { color: T.gris, fontSize: 12.5, lineHeight: 18, marginTop: -4, marginBottom: 10 },
  fila: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  btn: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 42, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: T.linea, backgroundColor: T.panel2 },
  btnPrincipal: { backgroundColor: T.accion, borderColor: T.accion },
  btnTxt: { color: T.tinta, fontSize: 13, fontWeight: "700" },
  // El rojo de la web (#b3261e) con texto blanco: 6.6:1.
  banda: { backgroundColor: "#b3261e", borderRadius: 12, padding: 12, marginBottom: 14 },
  bandaTxt: { color: "#fff", fontSize: 14, fontWeight: "800", flex: 1, lineHeight: 19 },
  bandaBtn: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 40, paddingHorizontal: 12, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.18)" },
  bandaBtnTxt: { color: "#fff", fontSize: 13, fontWeight: "700" },
});

/**
 * La banda roja que se pone sola: lee el estado de la empresa (compartido,
 * estado-cliente-app.js) y solo se pinta si está suspendida. Va arriba de
 * TODAS las pantallas del cliente.
 */
export function BandaSuspendido() {
  const est = useEstadoCliente();
  if (!est.suspendido) return null;
  return <AvisoSuspendido empresa={est.empresa} folio={est.folio} />;
}
