import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "../tema";
import { fechaLarga } from "../datos";
import { textoMotivo, fechaLocal } from "../avisos.js";
import { avisosDelCliente, marcarAvisoEnterado } from "../datos-remoto";

/**
 * AVISOS DE MORCAST arriba de Inicio (retraso, reagenda, aviso general).
 *
 * Los manda la oficina desde /admin/avisos; cuáles le tocan a este cliente lo
 * decide la base. Se enseñan los vigentes (últimos 30 días o hasta su fecha)
 * y cada uno tiene "Enterado", que lo quita y queda guardado en la base
 * (`avisos_lecturas`), así no vuelve a salir en este ni en otro teléfono.
 *
 * Si guardar el "Enterado" falla (sin señal, o la tabla todavía no está en
 * la base) el aviso se quita SOLO por esta vez y regresa la próxima: un
 * aviso que se pierde con un toque por error es peor que uno que se repite.
 *
 * `recarga` cambia cuando hay que volver a leer (al volver a la pestaña o al
 * tocar una notificación de aviso).
 */

/**
 * El color sigue al MOTIVO (DESIGN.md: los estados informan, no decoran).
 * Retraso en ámbar (alerta); reagenda en el azul de "programado"; el general,
 * neutro. Nunca naranja: en el portal el naranja es "en ruta".
 */
const TONO = {
  retraso: { icono: "clock", color: T.alerta, tinte: "rgba(214,164,74,0.14)" },
  reagenda: { icono: "calendar", color: T.accionTxt, tinte: T.accionTinte },
  general: { icono: "volume-2", color: T.gris, tinte: "rgba(255,255,255,0.06)" },
};

export function TarjetaAviso({ aviso, alEnterado, guardando }) {
  const tono = TONO[aviso.motivo] || TONO.general;
  const dia = aviso.creado ? fechaLarga(fechaLocal(aviso.creado)) : "";
  return (
    <View style={[s.tarjeta, { borderLeftColor: tono.color }]} accessibilityRole="summary">
      <View style={[s.icono, { backgroundColor: tono.tinte }]}>
        <Feather name={tono.icono} size={17} color={tono.color} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={s.cab}>
          <Text style={[s.motivo, { color: tono.color }]}>{textoMotivo(aviso.motivo).toUpperCase()}</Text>
          {dia ? <Text style={s.dia}>{dia}</Text> : null}
        </View>
        <Text style={s.titulo}>{aviso.titulo}</Text>
        <Text style={s.mensaje}>{aviso.mensaje}</Text>
        {aviso.vigente_hasta ? <Text style={s.hasta}>Aplica hasta el {fechaLarga(aviso.vigente_hasta)}</Text> : null}
        <Pressable
          onPress={alEnterado}
          disabled={guardando}
          accessibilityRole="button"
          accessibilityLabel={`Enterado: quitar el aviso «${aviso.titulo}»`}
          style={({ pressed }) => [s.enterado, { opacity: guardando ? 0.6 : pressed ? 0.8 : 1 }]}
        >
          {guardando ? (
            <ActivityIndicator size="small" color={T.tinta} />
          ) : (
            <Feather name="check" size={15} color={T.tinta} />
          )}
          <Text style={s.enteradoTxt}>Enterado</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function AvisosCliente({ recarga = 0 }) {
  const [avisos, setAvisos] = useState([]);
  const [ocultos, setOcultos] = useState([]);
  const [guardando, setGuardando] = useState(null);

  useEffect(() => {
    let vivo = true;
    avisosDelCliente()
      .then((l) => { if (vivo) setAvisos(l || []); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [recarga]);

  const enterado = useCallback(async (id) => {
    setGuardando(id);
    const r = await marcarAvisoEnterado(id);
    if (!r.ok) console.warn("[avisos] No se guardó el Enterado:", r.motivo);
    // Se quita de la vista en cualquier caso; si no se guardó, regresa la
    // próxima vez que se lean los avisos (ver arriba).
    setOcultos((o) => [...o, id]);
    setGuardando(null);
  }, []);

  const visibles = avisos.filter((a) => !ocultos.includes(a.id));
  if (!visibles.length) return null;

  return (
    <View accessibilityLabel="Avisos de Morcast" style={{ gap: 10, marginBottom: 14 }}>
      {visibles.map((a) => (
        <TarjetaAviso key={a.id} aviso={a} guardando={guardando === a.id} alEnterado={() => enterado(a.id)} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  tarjeta: {
    flexDirection: "row", gap: 12, alignItems: "flex-start",
    backgroundColor: T.panel, borderWidth: 1, borderColor: T.linea, borderLeftWidth: 4,
    borderRadius: 12, padding: 13,
  },
  icono: { width: 34, height: 34, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  cab: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 9, rowGap: 2, marginBottom: 3 },
  motivo: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2 },
  dia: { color: T.gris, fontSize: 12 },
  titulo: { color: T.tinta, fontSize: 15, fontWeight: "700", lineHeight: 20 },
  mensaje: { color: T.gris, fontSize: 13.5, lineHeight: 20, marginTop: 4 },
  hasta: { color: T.gris, fontSize: 12, marginTop: 6 },
  enterado: {
    flexDirection: "row", alignItems: "center", gap: 7, alignSelf: "flex-start",
    marginTop: 11, minHeight: 40, paddingHorizontal: 14, borderRadius: 10,
    borderWidth: 1, borderColor: T.linea, backgroundColor: T.panel2,
  },
  enteradoTxt: { color: T.tinta, fontSize: 13.5, fontWeight: "700" },
});
