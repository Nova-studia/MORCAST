import { useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "./tema";
import { MESES, DIAS_CORTOS, semanasDelMes, deISO, fechaConDia } from "./calendario.js";

/**
 * Calendario de un mes para elegir un día entre `min` y `max` (ISO).
 *
 * Para la "Recolección extra" (6-oct-2026): la web usa el selector de fecha
 * del navegador; en el teléfono no hay uno sin agregar un módulo nativo a la
 * compilación, y para esto basta una cuadrícula. Los días fuera del rango
 * se ven pero no se tocan.
 *
 * ⚠️ ESTE ARCHIVO ESTÁ DUPLICADO en las dos apps; solo cambia la extensión
 * del import de `calendario` (`.mjs` en iOS, `.js` en Android).
 */
export default function CalendarioFecha({ valor, onCambiar, min, max, hoy }) {
  const inicio = deISO(valor) || deISO(min) || new Date();
  const [vista, setVista] = useState({ año: inicio.getFullYear(), mes: inicio.getMonth() });
  const semanas = useMemo(() => semanasDelMes(vista.año, vista.mes), [vista]);

  const clave = (a, m) => a * 12 + m;
  const fMin = deISO(min);
  const fMax = deISO(max);
  const puedeAtras = !fMin || clave(vista.año, vista.mes) > clave(fMin.getFullYear(), fMin.getMonth());
  const puedeAdelante = !fMax || clave(vista.año, vista.mes) < clave(fMax.getFullYear(), fMax.getMonth());
  const mover = (n) =>
    setVista(({ año, mes }) => {
      const m = mes + n;
      return { año: año + Math.floor(m / 12), mes: ((m % 12) + 12) % 12 };
    });

  return (
    <View style={s.caja}>
      <View style={s.cab}>
        <Pressable
          onPress={() => mover(-1)}
          disabled={!puedeAtras}
          style={[s.flecha, !puedeAtras && { opacity: 0.3 }]}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Mes anterior"
        >
          <Feather name="chevron-left" size={20} color={T.tinta} />
        </Pressable>
        <Text style={s.mes} accessibilityRole="header">
          {MESES[vista.mes].charAt(0).toUpperCase() + MESES[vista.mes].slice(1)} {vista.año}
        </Text>
        <Pressable
          onPress={() => mover(1)}
          disabled={!puedeAdelante}
          style={[s.flecha, !puedeAdelante && { opacity: 0.3 }]}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Mes siguiente"
        >
          <Feather name="chevron-right" size={20} color={T.tinta} />
        </Pressable>
      </View>

      <View style={s.semana}>
        {DIAS_CORTOS.map((d, i) => (
          <Text key={i} style={s.diaNombre}>{d}</Text>
        ))}
      </View>

      {semanas.map((sem, i) => (
        <View key={i} style={s.semana}>
          {sem.map((f, j) => {
            if (!f) return <View key={j} style={s.celda} />;
            const fuera = (min && f < min) || (max && f > max);
            const elegido = f === valor;
            const esHoy = f === hoy;
            return (
              <Pressable
                key={j}
                onPress={() => onCambiar(f)}
                disabled={!!fuera}
                style={[s.celda, s.dia, esHoy && s.hoy, elegido && s.elegido]}
                accessibilityRole="button"
                accessibilityState={{ selected: elegido, disabled: !!fuera }}
                accessibilityLabel={`${fechaConDia(f)}${esHoy ? ", hoy" : ""}`}
              >
                <Text style={[s.num, fuera && s.numFuera, elegido && s.numElegido]}>{Number(f.slice(8))}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  caja: { backgroundColor: T.panel2, borderWidth: 1, borderColor: T.linea, borderRadius: 12, padding: 10, marginBottom: 12 },
  cab: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  flecha: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  mes: { flex: 1, textAlign: "center", color: T.tinta, fontSize: 14.5, fontWeight: "700" },
  semana: { flexDirection: "row" },
  diaNombre: { flex: 1, textAlign: "center", color: T.gris, fontSize: 11.5, fontWeight: "700", paddingVertical: 4 },
  celda: { flex: 1, height: 42, margin: 1.5 },
  dia: { alignItems: "center", justifyContent: "center", borderRadius: 9 },
  hoy: { borderWidth: 1, borderColor: T.gris },
  elegido: { backgroundColor: T.verde, borderColor: T.verde },
  num: { color: T.tinta, fontSize: 14, fontWeight: "600" },
  numFuera: { color: T.grisClaro, opacity: 0.45 },
  numElegido: { color: "#fff", fontWeight: "800" },
});
