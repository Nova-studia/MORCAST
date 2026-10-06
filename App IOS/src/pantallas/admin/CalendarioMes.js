import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "../../tema";
import { semanasDelMes, MESES_LARGOS } from "../../oficina.mjs";

/**
 * Un calendario de un mes para elegir el día de una recolección
 * (6-oct-2026). Hecho a mano y no con el selector nativo a propósito: la app
 * de Android lleva su carpeta `android/` en el repositorio y una dependencia
 * nativa nueva obligaría a recompilarla. Este no necesita nada.
 *
 * Los días antes de `minimo` (hoy) no se pueden tocar: reagendar para un día
 * que ya pasó la dejaría vencida otra vez. Casillas de 44 px de alto como
 * mínimo, para el dedo.
 */
const CABECERA = ["L", "M", "M", "J", "V", "S", "D"];
const NOMBRES_DIA = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

export default function CalendarioMes({ valor, minimo, onElegir }) {
  const base = /^\d{4}-\d{2}/.test(valor || "") ? valor : minimo;
  const [mes, setMes] = useState(() => ({ a: Number(base.slice(0, 4)), m: Number(base.slice(5, 7)) - 1 }));
  const semanas = semanasDelMes(mes.a, mes.m);
  const mover = (n) =>
    setMes(({ a, m }) => {
      const f = new Date(a, m + n, 1);
      return { a: f.getFullYear(), m: f.getMonth() };
    });
  // No se va a meses que ya pasaron enteros.
  const puedeAtras = `${mes.a}-${String(mes.m + 1).padStart(2, "0")}` > String(minimo).slice(0, 7);

  return (
    <View style={s.caja}>
      <View style={s.cab}>
        <Pressable
          onPress={() => puedeAtras && mover(-1)}
          disabled={!puedeAtras}
          hitSlop={10}
          style={s.flecha}
          accessibilityRole="button"
          accessibilityLabel="Mes anterior"
        >
          <Feather name="chevron-left" size={20} color={puedeAtras ? T.tinta : T.grisClaro} />
        </Pressable>
        <Text style={s.mes}>{MESES_LARGOS[mes.m]} {mes.a}</Text>
        <Pressable onPress={() => mover(1)} hitSlop={10} style={s.flecha} accessibilityRole="button" accessibilityLabel="Mes siguiente">
          <Feather name="chevron-right" size={20} color={T.tinta} />
        </Pressable>
      </View>
      <View style={s.fila}>
        {CABECERA.map((c, i) => (
          <Text key={i} style={s.diaSem}>{c}</Text>
        ))}
      </View>
      {semanas.map((semana, i) => (
        <View key={i} style={s.fila}>
          {semana.map((iso, j) => {
            if (!iso) return <View key={j} style={s.celda} />;
            const pasado = iso < minimo;
            const elegido = iso === valor;
            const esHoy = iso === minimo;
            return (
              <Pressable
                key={j}
                onPress={() => !pasado && onElegir(iso)}
                disabled={pasado}
                style={[s.celda, s.dia, elegido && s.diaOn, esHoy && !elegido && s.diaHoy]}
                accessibilityRole="button"
                accessibilityState={{ selected: elegido, disabled: pasado }}
                accessibilityLabel={`${NOMBRES_DIA[j]} ${Number(iso.slice(8))} de ${MESES_LARGOS[mes.m]}`}
              >
                <Text style={[s.diaTxt, pasado && { color: T.grisClaro }, elegido && { color: "#fff", fontWeight: "800" }]}>
                  {Number(iso.slice(8))}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  caja: { backgroundColor: T.panel2, borderWidth: 1, borderColor: T.linea, borderRadius: 12, padding: 8, marginTop: 10 },
  cab: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  flecha: { width: 44, height: 40, alignItems: "center", justifyContent: "center" },
  mes: { color: T.tinta, fontSize: 14.5, fontWeight: "700", textTransform: "capitalize" },
  fila: { flexDirection: "row" },
  diaSem: { flex: 1, textAlign: "center", color: T.gris, fontSize: 11.5, paddingVertical: 4 },
  celda: { flex: 1, minHeight: 44, margin: 1.5 },
  dia: { alignItems: "center", justifyContent: "center", borderRadius: 9 },
  diaOn: { backgroundColor: T.accion },
  diaHoy: { borderWidth: 1, borderColor: T.accionTxt },
  diaTxt: { color: T.tinta, fontSize: 14 },
});
