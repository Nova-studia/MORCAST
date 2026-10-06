import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, Modal, ScrollView, TextInput, StyleSheet, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "../../tema";
import { Boton } from "../../ui";

/**
 * PIEZAS de las pantallas de cuentas y catálogo de la administración
 * (Altas, Clientes, Usuarios, Puntos, Zonas pedidas, Unidades — 6-oct-2026).
 *
 * El mismo molde para las seis: lista con filtros arriba, jalar para
 * recargar, y el detalle en una hoja que sube desde abajo (como la ficha de
 * Solicitudes). Viven aquí para que las seis se vean y se comporten igual, y
 * este archivo es IDÉNTICO en las dos apps.
 */

/**
 * La lista de una pantalla: carga, error y "jalar para recargar".
 * `cargar` devuelve la lista, o `null` si la base no contestó (así "no hay
 * ninguna" y "no hubo señal" no se ven igual).
 */
export function useLista(cargar) {
  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [errorCarga, setErrorCarga] = useState(false);
  const vivo = useRef(true);
  useEffect(() => () => { vivo.current = false; }, []);

  const recargar = useCallback(async ({ jalando = false } = {}) => {
    if (jalando) setRefrescando(true);
    try {
      const l = await cargar();
      if (!vivo.current) return;
      if (l === null) setErrorCarga(true);
      else { setLista(l); setErrorCarga(false); }
    } catch {
      if (vivo.current) setErrorCarga(true);
    } finally {
      if (vivo.current) { setCargando(false); setRefrescando(false); }
    }
    // `cargar` la pasa cada pantalla como función fija.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { recargar(); }, [recargar]);

  return { lista, setLista, cargando, refrescando, errorCarga, recargar };
}

/**
 * Si el servidor pidió el SEGUNDO PASO otra vez (el pase venció o se cerró
 * la sesión en otro lado), se manda a escribir el código y se dice por qué.
 * Devuelve true si lo atendió: la pantalla no debe enseñar otro error.
 */
export function atenderSegundoPaso(r, navigation) { // eslint-disable-line no-unused-vars
  // Al juntar los equipos (6-oct-2026) quedó UN solo aviso: `postAdmin` ya
  // olvidó el pase y candado-admin.js puso la pantalla del código ENCIMA del
  // panel (App.js). Aquí solo se dice a la pantalla que no siga; abrir otra
  // pantalla de código haría que saliera dos veces.
  return Boolean(r?.segundoPaso);
}

export function Chip({ on, onPress, children, etiqueta }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(on) }}
      accessibilityLabel={etiqueta}
      hitSlop={4}
      style={[p.chip, on && p.chipOn]}
    >
      <Text style={[p.chipTxt, on && p.chipTxtOn]}>{children}</Text>
    </Pressable>
  );
}

/** Fila de chips que se desliza de lado (filtros). */
export function Chips({ children }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12, flexGrow: 0 }} contentContainerStyle={{ gap: 8 }}>
      {children}
    </ScrollView>
  );
}

/** La hoja de detalle que sube desde abajo. */
export function Hoja({ visible, onClose, titulo, children }) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={p.fondo}>
        <View style={p.hoja}>
          <View style={p.cab}>
            <Text style={p.cabTxt} numberOfLines={1}>{titulo}</Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cerrar">
              <Feather name="x" size={22} color={T.gris} />
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={{ padding: 18, paddingTop: 4, paddingBottom: 36 }}
            automaticallyAdjustKeyboardInsets
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/** Caja de aviso: error (rojo), ok (verde) o info (azul). */
export function Aviso({ tipo = "error", children, style }) {
  const c = COLORES[tipo] || COLORES.error;
  return (
    <View
      style={[p.aviso, { backgroundColor: c.bg, borderColor: c.borde }, style]}
      accessibilityRole={tipo === "error" ? "alert" : "text"}
      accessibilityLiveRegion="polite"
    >
      <Feather name={c.icono} size={15} color={c.fg} style={{ marginTop: 1 }} />
      <Text style={[p.avisoTxt, { color: tipo === "info" ? T.tinta : c.fg }]}>{children}</Text>
    </View>
  );
}

const COLORES = {
  error: { bg: "rgba(217,119,107,0.10)", borde: "rgba(217,119,107,0.35)", fg: T.error, icono: "alert-circle" },
  ok: { bg: "rgba(111,168,103,0.10)", borde: "rgba(111,168,103,0.35)", fg: T.ok, icono: "check-circle" },
  info: { bg: T.accionTinte, borde: "rgba(42,106,153,0.45)", fg: T.accionTxt, icono: "info" },
  alerta: { bg: "rgba(214,164,74,0.12)", borde: "rgba(214,164,74,0.38)", fg: T.alerta, icono: "alert-triangle" },
};

/** "No se pudo leer…" con su botón de reintentar. */
export function ErrorCarga({ que, onReintentar }) {
  return (
    <Aviso tipo="error" style={{ marginTop: 0 }}>
      No se pudieron leer {que}. Revisa tu señal e intenta otra vez.{"\n"}
      <Text style={{ fontWeight: "700", textDecorationLine: "underline" }} onPress={onReintentar} accessibilityRole="button">
        Reintentar
      </Text>
    </Aviso>
  );
}

export function Campo({ etiqueta, valor, onCambio, ayuda, style, ...props }) {
  return (
    <View style={{ marginTop: 12 }}>
      <Text style={p.label}>{etiqueta}</Text>
      <TextInput
        {...props}
        style={[p.input, style]}
        value={valor}
        onChangeText={onCambio}
        placeholderTextColor={T.grisClaro}
        accessibilityLabel={etiqueta}
      />
      {!!ayuda && <Text style={p.ayuda}>{ayuda}</Text>}
    </View>
  );
}

/** Un dato del detalle: etiqueta gris arriba, valor abajo. No pinta nada si no hay valor. */
export function Dato({ etiqueta, valor }) {
  if (!valor && valor !== 0) return null;
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={p.datoK}>{etiqueta}</Text>
      <Text style={p.datoV} selectable>{valor}</Text>
    </View>
  );
}

/** Título de sección dentro de una hoja. */
export function Seccion({ children }) {
  return <Text style={p.seccion}>{children}</Text>;
}

/** Botón de acción a lo ancho, con icono de Feather. */
export function Accion({ icono, children, onPress, variante = "verde", disabled, style }) {
  return (
    <Boton onPress={onPress} variante={variante} disabled={disabled} style={[{ marginTop: 10 }, style]}>
      {icono ? <Feather name={icono} size={15} color={variante === "linea" ? T.tinta : variante === "naranja" ? "#0d1211" : "#fff"} /> : null}
      {icono ? " " : ""}
      {children}
    </Boton>
  );
}

export const estilosCuentas = StyleSheet.create({
  h1: { color: T.tinta, fontSize: 22, fontWeight: "800" },
  sub: { color: T.gris, fontSize: 13.5, marginTop: 3, marginBottom: 14, lineHeight: 19 },
  vacio: { color: T.gris, fontSize: 13, lineHeight: 19, paddingVertical: 6 },
  folio: { color: T.gris, fontSize: 11.5 },
  titulo: { color: T.tinta, fontSize: 15, fontWeight: "700", marginTop: 3 },
  linea: { color: T.gris, fontSize: 12.5, marginTop: 2 },
  fila: { flexDirection: "row", alignItems: "center", gap: 10 },
  hojaTitulo: { color: T.tinta, fontSize: 19, fontWeight: "800" },
  hojaSub: { color: T.gris, fontSize: 13, marginTop: 2, marginBottom: 12 },
});

const p = StyleSheet.create({
  chip: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: T.linea, backgroundColor: T.panel, minHeight: 36, justifyContent: "center" },
  chipOn: { backgroundColor: T.accion, borderColor: T.accion },
  chipTxt: { color: T.gris, fontSize: 12.5, fontWeight: "600" },
  chipTxtOn: { color: "#fff" },
  fondo: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  hoja: { backgroundColor: T.fondo, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: "92%", borderWidth: 1, borderColor: T.linea },
  cab: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingTop: 16, paddingBottom: 8, gap: 12 },
  cabTxt: { color: T.gris, fontSize: 13, fontWeight: "700", flex: 1 },
  aviso: { flexDirection: "row", gap: 8, alignItems: "flex-start", borderWidth: 1, borderRadius: 10, padding: 10, marginTop: 12 },
  avisoTxt: { fontSize: 12.5, flex: 1, lineHeight: 18 },
  label: { color: T.tinta, fontSize: 12.5, fontWeight: "700", marginBottom: 6 },
  input: { backgroundColor: T.panel2, borderWidth: 1, borderColor: T.linea, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, color: T.tinta, fontSize: 14, minHeight: 46 },
  ayuda: { color: T.grisClaro, fontSize: 11.5, marginTop: 5, lineHeight: 16 },
  datoK: { color: T.gris, fontSize: 12 },
  datoV: { color: T.tinta, fontSize: 14, fontWeight: "600", marginTop: 2, lineHeight: 19 },
  seccion: { color: T.gris, fontSize: 11, letterSpacing: 0.5, marginTop: 18, marginBottom: 4, textTransform: "uppercase", fontWeight: "700" },
});
