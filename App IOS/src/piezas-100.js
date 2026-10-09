import { View, Text, Pressable, StyleSheet, Linking, ActivityIndicator, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "./tema";
import { Tarjeta, TituloTarjeta } from "./ui";
import { EMPRESA_COTIZACION, HORARIOS } from "./cotizacion-datos";
import { abrirWhatsApp } from "./whatsapp";
import { mensajeSoporte, mensajeSuspendido, telefonoMarcable } from "./apps-cliente.mjs";
import { AVISO_SUSPENDIDO } from "./web/estado-cliente.mjs";
import { useEstadoCliente } from "./estado-cliente-app";
import { useMisPermisos, cargarMisPermisos } from "./mis-permisos";
import { puedeVer } from "./permisos-app.mjs";
import { textoFallo } from "./resultado";

/**
 * PIEZAS DE "APPS AL 100%" (9-oct-2026): lo que varias pantallas nuevas
 * comparten. El aviso rojo de cuenta suspendida, la tarjeta de soporte, el
 * "Sin conexión · Reintentar" y el guardia de pantallas por rol.
 */

const TELEFONO = EMPRESA_COTIZACION.telefonos[0];
// El buzón de contacto que la web ya enseña (Web/lib/datos.js, correoPrivacidad).
export const CORREO_CONTACTO = "contacto@morcast.mx";

const abrir = (url) => Linking.openURL(url).catch(() => {});

/* ------------------------------------------------------------------ */
/* Aviso rojo de cuenta suspendida                                     */
/* ------------------------------------------------------------------ */

/**
 * AVISO ROJO DE CUENTA SUSPENDIDA (como Web/components/portal/AvisoSuspendido.js):
 * arriba de todas las pantallas del cliente mientras su empresa esté
 * suspendida. Ve todo, pero solo puede agregar saldo (la causa típica es la
 * falta de pago); con WhatsApp y llamada a la mano para arreglarlo.
 * Si la empresa no está suspendida no ocupa nada.
 */
export function AvisoSuspendido() {
  const { estado, empresa, folio } = useEstadoCliente();
  if (estado !== "suspendido") return null;
  return (
    <View style={s.rojo} accessibilityRole="alert">
      <View style={s.rojoFila}>
        <Feather name="alert-octagon" size={20} color="#fff" />
        <Text style={s.rojoTxt}>{AVISO_SUSPENDIDO}</Text>
      </View>
      <View style={s.rojoBotones}>
        <Pressable
          onPress={() => abrirWhatsApp(TELEFONO, mensajeSuspendido({ empresa, folio }))}
          style={({ pressed }) => [s.rojoBtn, pressed && { opacity: 0.8 }]}
          accessibilityRole="button"
          accessibilityLabel="Escribir a Morcast por WhatsApp"
        >
          <Feather name="message-circle" size={15} color="#fff" />
          <Text style={s.rojoBtnTxt}>WhatsApp</Text>
        </Pressable>
        <Pressable
          onPress={() => abrir(telefonoMarcable(TELEFONO))}
          style={({ pressed }) => [s.rojoBtn, pressed && { opacity: 0.8 }]}
          accessibilityRole="button"
          accessibilityLabel={`Llamar a Morcast al ${TELEFONO}`}
        >
          <Feather name="phone" size={15} color="#fff" />
          <Text style={s.rojoBtnTxt}>{TELEFONO}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Una pantalla del cliente con el aviso rojo arriba (las de la pila). */
export function conAvisoSuspendido(Pantalla) {
  function ConAviso(props) {
    return (
      <View style={{ flex: 1, backgroundColor: T.fondo }}>
        <AvisoSuspendido />
        <Pantalla {...props} />
      </View>
    );
  }
  ConAviso.displayName = `ConAviso(${Pantalla.displayName || Pantalla.name || "Pantalla"})`;
  return ConAviso;
}

/* ------------------------------------------------------------------ */
/* Soporte                                                             */
/* ------------------------------------------------------------------ */

/**
 * "¿NECESITAS AYUDA?" (como TarjetaSoporte de la web): WhatsApp con el
 * mensaje ya escrito, teléfono y correo. `compacta`: solo el botón de
 * "Contáctanos", para ponerlo junto a una recolección vencida.
 */
export function TarjetaSoporte({ empresa, folio, mensaje, compacta = false }) {
  const texto = mensaje || mensajeSoporte({ empresa, folio });
  const whats = (
    <Pressable
      onPress={() => abrirWhatsApp(TELEFONO, texto)}
      style={({ pressed }) => [s.btn, s.btnAccion, pressed && { opacity: 0.85 }]}
      accessibilityRole="button"
    >
      <Feather name="message-circle" size={15} color="#fff" />
      <Text style={[s.btnTxt, { color: "#fff" }]}>{compacta ? "Contáctanos" : "WhatsApp"}</Text>
    </Pressable>
  );
  if (compacta) return <View style={{ flexDirection: "row", marginTop: 8 }}>{whats}</View>;
  return (
    <Tarjeta>
      <TituloTarjeta>¿Necesitas ayuda?</TituloTarjeta>
      <Text style={s.nota}>Escríbenos o llámanos. {HORARIOS.resumen}</Text>
      <View style={s.botones}>
        {whats}
        <Pressable onPress={() => abrir(telefonoMarcable(TELEFONO))} style={({ pressed }) => [s.btn, pressed && { opacity: 0.85 }]} accessibilityRole="button" accessibilityLabel={`Llamar al ${TELEFONO}`}>
          <Feather name="phone" size={15} color={T.tinta} />
          <Text style={s.btnTxt}>{TELEFONO}</Text>
        </Pressable>
        <Pressable onPress={() => abrir(`mailto:${CORREO_CONTACTO}`)} style={({ pressed }) => [s.btn, pressed && { opacity: 0.85 }]} accessibilityRole="button" accessibilityLabel={`Escribir a ${CORREO_CONTACTO}`}>
          <Feather name="mail" size={15} color={T.tinta} />
          <Text style={s.btnTxt}>{CORREO_CONTACTO}</Text>
        </Pressable>
      </View>
    </Tarjeta>
  );
}

/* ------------------------------------------------------------------ */
/* Sin conexión / motivo                                               */
/* ------------------------------------------------------------------ */

/**
 * Lo que salió mal en una acción: "Sin conexión" con Reintentar cuando no
 * hubo señal; si no, el motivo del servidor tal cual (ya viene escrito para
 * personas). `fallo` = `{ sinRed?, motivo }` o null.
 */
export function Fallo({ fallo, onReintentar, style }) {
  if (!fallo) return null;
  return (
    <View style={[s.fallo, style]} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Feather name={fallo.sinRed ? "wifi-off" : "alert-circle"} size={15} color={T.error} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        <Text style={s.falloTxt}>{textoFallo(fallo)}</Text>
        {(fallo.sinRed || fallo.reintentar) && onReintentar ? (
          <Pressable onPress={onReintentar} style={s.reintentar} accessibilityRole="button" hitSlop={6}>
            <Feather name="refresh-cw" size={14} color={T.tinta} />
            <Text style={s.reintentarTxt}>Reintentar</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** El `{ sinRed, motivo }` de una respuesta fallida (o null si salió bien). */
export const falloDe = (r) => (r && !r.ok ? { sinRed: Boolean(r.sinRed || r.red), motivo: r.motivo || "No se pudo." } : null);

/** Un aviso verde de "listo". */
export function Listo({ children, onCerrar }) {
  if (!children) return null;
  return (
    <View style={s.listo} accessibilityLiveRegion="polite">
      <Feather name="check-circle" size={16} color={T.ok} />
      <Text style={s.listoTxt}>{children}</Text>
      {onCerrar ? (
        <Pressable onPress={onCerrar} hitSlop={10} accessibilityLabel="Cerrar aviso"><Feather name="x" size={16} color={T.gris} /></Pressable>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Guardia de pantallas por rol                                        */
/* ------------------------------------------------------------------ */

/**
 * Una pantalla de administración que pide sección. Se puede llegar a ella
 * por una NOTIFICACIÓN aunque su rol no la incluya (las pestañas y el menú ya
 * no la enseñan): entonces dice "Tu rol no incluye esta sección" en vez de
 * abrir algo que el servidor iba a negar botón por botón.
 */
export function conSeccion(Pantalla, nombre) {
  function Guardada(props) {
    const { yo, cargando, fallo } = useMisPermisos();
    if (puedeVer(yo, nombre)) return <Pantalla {...props} />;
    if (!yo && (cargando || !fallo)) {
      return (
        <View style={s.centro}>
          <ActivityIndicator color={T.gris} />
          <Text style={[s.nota, { marginTop: 12 }]}>Leyendo tus permisos…</Text>
        </View>
      );
    }
    if (!yo && fallo) {
      return (
        <ScrollView contentContainerStyle={{ padding: 16 }} style={{ backgroundColor: T.fondo }}>
          <Fallo fallo={{ sinRed: fallo.sinRed, motivo: fallo.motivo }} onReintentar={cargarMisPermisos} />
          {!fallo.sinRed ? (
            <Pressable onPress={cargarMisPermisos} style={s.reintentar} accessibilityRole="button"><Text style={s.reintentarTxt}>Reintentar</Text></Pressable>
          ) : null}
        </ScrollView>
      );
    }
    return (
      <View style={s.centro}>
        <Feather name="lock" size={28} color={T.gris} />
        <Text style={s.sinPermisoTit}>Tu rol no incluye esta sección</Text>
        <Text style={[s.nota, { textAlign: "center" }]}>
          {yo?.rolNombre ? `Tu rol es «${yo.rolNombre}». ` : ""}Si la necesitas, pídele al dueño que la agregue a tu rol.
        </Text>
        {props.navigation?.canGoBack?.() ? (
          <Pressable onPress={() => props.navigation.goBack()} style={[s.btn, { marginTop: 16 }]} accessibilityRole="button">
            <Text style={s.btnTxt}>Regresar</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }
  Guardada.displayName = `ConSeccion(${nombre})`;
  return Guardada;
}

const s = StyleSheet.create({
  rojo: { backgroundColor: "#b3261e", paddingHorizontal: 14, paddingVertical: 10 },
  rojoFila: { flexDirection: "row", alignItems: "center", gap: 10 },
  rojoTxt: { color: "#fff", fontSize: 14, fontWeight: "800", flex: 1, lineHeight: 19 },
  rojoBotones: { flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap" },
  rojoBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 8, paddingHorizontal: 12, minHeight: 38 },
  rojoBtnTxt: { color: "#fff", fontSize: 13.5, fontWeight: "700" },
  nota: { color: T.gris, fontSize: 12.5, lineHeight: 18 },
  botones: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  btn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: T.linea, backgroundColor: T.panel2, borderRadius: 10, paddingHorizontal: 12, minHeight: 42 },
  btnAccion: { backgroundColor: T.accion, borderColor: T.accion },
  btnTxt: { color: T.tinta, fontSize: 13.5, fontWeight: "700" },
  fallo: { flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: "rgba(217,119,107,0.10)", borderWidth: 1, borderColor: "rgba(217,119,107,0.35)", borderRadius: 10, padding: 10, marginTop: 12 },
  falloTxt: { color: T.tinta, fontSize: 13, lineHeight: 18 },
  reintentar: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginTop: 8, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 9, borderWidth: 1, borderColor: T.linea, backgroundColor: T.panel, minHeight: 40 },
  reintentarTxt: { color: T.tinta, fontSize: 13, fontWeight: "700" },
  listo: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(111,168,103,0.12)", borderWidth: 1, borderColor: "rgba(111,168,103,0.4)", borderRadius: 10, padding: 11, marginBottom: 12 },
  listoTxt: { color: T.tinta, fontSize: 13, flex: 1, lineHeight: 18 },
  centro: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: T.fondo },
  sinPermisoTit: { color: T.tinta, fontSize: 17, fontWeight: "800", marginTop: 12, marginBottom: 6, textAlign: "center" },
});
