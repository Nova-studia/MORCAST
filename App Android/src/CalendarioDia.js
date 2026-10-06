import { useState } from "react";
import { View, Text, Pressable, StyleSheet, Modal } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "./tema";

/**
 * UN CALENDARIO PARA ELEGIR UN DÍA (6-oct-2026).
 *
 * La app no trae selector de fecha nativo, y meter uno (un módulo nativo
 * más) complica las compilaciones de las tiendas —en Android el `android/`
 * va en el repo y los plugins no se aplican solos—. Esto es una cuadrícula
 * de mes en JavaScript puro: basta para "ir a otro día" de la bitácora o
 * "vigente hasta" de un aviso.
 *
 * Las fechas son de CALENDARIO ("2026-10-06"), no instantes: se arma con
 * Date.UTC para que la zona del teléfono no corra el día.
 *
 * Props: `visible`, `valor`, `min`/`max` (opcionales, mismo formato),
 * `titulo`, `onElegir(fecha)`, `onCerrar()`.
 */

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DIAS = ["D", "L", "M", "M", "J", "V", "S"];
const DIAS_LARGOS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

const iso = (a, m, d) => new Date(Date.UTC(a, m, d)).toISOString().slice(0, 10);
const partes = (f) => {
  const [a, m, d] = String(f || "").split("-").map(Number);
  return { a, m: (m || 1) - 1, d: d || 1 };
};

export default function CalendarioDia({ visible, valor, min, max, titulo = "Elige un día", onElegir, onCerrar }) {
  const base = partes(valor || max || min || iso(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()));
  const [mes, setMes] = useState({ a: base.a, m: base.m });

  // Al abrir otra vez, vuelve al mes del valor elegido.
  const [ultimoValor, setUltimoValor] = useState(valor);
  if (valor !== ultimoValor) {
    setUltimoValor(valor);
    setMes({ a: base.a, m: base.m });
  }

  const primero = new Date(Date.UTC(mes.a, mes.m, 1)).getUTCDay();
  const diasMes = new Date(Date.UTC(mes.a, mes.m + 1, 0)).getUTCDate();
  const celdas = [];
  for (let i = 0; i < primero; i++) celdas.push(null);
  for (let d = 1; d <= diasMes; d++) celdas.push(iso(mes.a, mes.m, d));
  while (celdas.length % 7) celdas.push(null);

  const mover = (n) => setMes((x) => {
    const f = new Date(Date.UTC(x.a, x.m + n, 1));
    return { a: f.getUTCFullYear(), m: f.getUTCMonth() };
  });
  const finMesAnterior = iso(mes.a, mes.m, 0);
  const inicioMesSiguiente = iso(mes.a, mes.m + 1, 1);
  const puedeAtras = !min || finMesAnterior >= min;
  const puedeAdelante = !max || inicioMesSiguiente <= max;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCerrar}>
      <Pressable style={s.fondo} onPress={onCerrar} accessibilityLabel="Cerrar el calendario">
        <Pressable style={s.caja} onPress={() => {}}>
          <Text style={s.titulo}>{titulo}</Text>
          <View style={s.cab}>
            <Pressable onPress={() => mover(-1)} disabled={!puedeAtras} hitSlop={10} style={[s.flecha, !puedeAtras && { opacity: 0.3 }]} accessibilityRole="button" accessibilityLabel="Mes anterior">
              <Feather name="chevron-left" size={22} color={T.tinta} />
            </Pressable>
            <Text style={s.mes}>{MESES[mes.m]} {mes.a}</Text>
            <Pressable onPress={() => mover(1)} disabled={!puedeAdelante} hitSlop={10} style={[s.flecha, !puedeAdelante && { opacity: 0.3 }]} accessibilityRole="button" accessibilityLabel="Mes siguiente">
              <Feather name="chevron-right" size={22} color={T.tinta} />
            </Pressable>
          </View>
          <View style={s.fila}>
            {DIAS.map((d, i) => <Text key={i} style={s.diaSem}>{d}</Text>)}
          </View>
          <View style={s.cuadricula}>
            {celdas.map((f, i) => {
              if (!f) return <View key={`v${i}`} style={s.celda} />;
              const fuera = (min && f < min) || (max && f > max);
              const elegido = f === valor;
              const n = Number(f.slice(8));
              return (
                <Pressable
                  key={f}
                  disabled={fuera}
                  onPress={() => onElegir(f)}
                  style={[s.celda, elegido && s.elegido]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: elegido, disabled: fuera }}
                  accessibilityLabel={`${DIAS_LARGOS[new Date(Date.UTC(mes.a, mes.m, n)).getUTCDay()]} ${n} de ${MESES[mes.m].toLowerCase()}`}
                >
                  <Text style={[s.num, fuera && { color: T.grisClaro, opacity: 0.5 }, elegido && { color: "#fff", fontWeight: "800" }]}>{n}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable onPress={onCerrar} style={s.cerrar} accessibilityRole="button">
            <Text style={s.cerrarTxt}>Cancelar</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 18 },
  caja: { backgroundColor: T.panel, borderRadius: 18, borderWidth: 1, borderColor: T.linea, padding: 16 },
  titulo: { color: T.gris, fontSize: 12.5, marginBottom: 6 },
  cab: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  flecha: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  mes: { color: T.tinta, fontSize: 16, fontWeight: "800" },
  fila: { flexDirection: "row" },
  diaSem: { flex: 1, textAlign: "center", color: T.grisClaro, fontSize: 12, paddingVertical: 4 },
  cuadricula: { flexDirection: "row", flexWrap: "wrap" },
  celda: { width: `${100 / 7}%`, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22 },
  elegido: { backgroundColor: T.accion },
  num: { color: T.tinta, fontSize: 15 },
  cerrar: { alignSelf: "flex-end", paddingVertical: 10, paddingHorizontal: 14, marginTop: 6 },
  cerrarTxt: { color: T.accionTxt, fontWeight: "700", fontSize: 14.5 },
});
