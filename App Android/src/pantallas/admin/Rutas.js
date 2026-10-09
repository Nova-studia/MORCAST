import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, RefreshControl } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "../../tema";
import { Tarjeta, Badge } from "../../ui";
import AvisoResultado from "../../AvisoResultado";
import { listarOperadores } from "../../datos-remoto";
import { listarRutasAdmin, asignarChoferRuta } from "../../datos-rutas-admin";
import { textoDiasRuta } from "../../rutas-admin.mjs";
import { Aviso, Hoja, estilosCuentas as e } from "./piezas-cuentas";

/**
 * RUTAS Y SU CHOFER (apps al 100%, fase C).
 *
 * Hasta el 9-oct el chofer de una ruta era un nombre escrito a mano
 * (`rutas.chofer`) y `rutas.chofer_id` nunca se llenaba. De ese id dependen
 * las paradas que ve cada chofer en su app y sus avisos: una recolección
 * confirmada con "El de la ruta" en una ruta sin chofer no le aparecía a
 * NADIE. Aquí se escoge de la lista de choferes y se guardan los dos (el id y
 * el nombre) con `elegirChoferRuta`, igual que la web.
 *
 * Las zonas y los sectores (el dibujo en el mapa) siguen en la web: "Abrir en
 * la web" desde Más.
 */
export default function Rutas() {
  const [rutas, setRutas] = useState(null);
  const [choferes, setChoferes] = useState([]);
  const [fallo, setFallo] = useState(false);
  const [refrescando, setRefrescando] = useState(false);
  const [sel, setSel] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [res, setRes] = useState(null);
  const [aviso, setAviso] = useState("");

  const cargar = useCallback(async () => {
    const [r, c] = await Promise.all([listarRutasAdmin(), listarOperadores().catch(() => [])]);
    setFallo(r === null);
    if (r) setRutas(r);
    setChoferes(c || []);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const refrescar = async () => {
    setRefrescando(true);
    try { await cargar(); } finally { setRefrescando(false); }
  };

  const elegir = async (choferId) => {
    if (guardando || !sel) return;
    setGuardando(true);
    setRes(null);
    const r = await asignarChoferRuta(sel.id, choferId, choferes);
    setGuardando(false);
    if (!r.ok) { setRes(r); return; }
    setRutas((l) => (l || []).map((x) => (x.id === sel.id ? { ...x, choferId: r.cambios.chofer_id, chofer: r.cambios.chofer } : x)));
    setAviso(r.cambios.chofer_id ? `${sel.nombre}: ahora la maneja ${r.cambios.chofer}.` : `${sel.nombre} quedó sin chofer asignado.`);
    setSel(null);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: T.fondo }}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={T.gris} />}
    >
      <Text style={e.h1}>Rutas</Text>
      <Text style={e.sub}>Quién maneja cada ruta. Ese chofer ve en su app las paradas de "El de la ruta".</Text>

      {!!aviso && <Aviso tipo="ok" style={{ marginTop: 0, marginBottom: 12 }}>{aviso}</Aviso>}
      {fallo && <AvisoResultado r={{ ok: false, sinRed: true }} onReintentar={cargar} style={{ marginTop: 0, marginBottom: 12 }} />}
      {rutas === null && !fallo && <Text style={e.vacio}>Leyendo las rutas…</Text>}
      {rutas && rutas.length === 0 && <Text style={e.vacio}>Todavía no hay rutas.</Text>}

      {(rutas || []).map((r) => (
        <Pressable key={r.id} onPress={() => { setSel(r); setRes(null); setAviso(""); }} accessibilityRole="button" accessibilityLabel={`${r.nombre}, ${r.chofer || "sin chofer"}`}>
          <Tarjeta style={{ padding: 14 }}>
            <View style={e.fila}>
              <View style={{ flex: 1 }}>
                <Text style={e.folio}>{r.clave}</Text>
                <Text style={e.titulo}>{r.nombre}</Text>
                <Text style={e.linea}>Pasa: {textoDiasRuta(r.dias)}</Text>
                <Text style={[e.linea, !r.choferId && { color: T.alerta }]}>
                  {r.choferId ? `Chofer: ${r.chofer || "sin nombre"}` : r.chofer ? `Decía «${r.chofer}» a mano: escoge al chofer de la lista` : "Sin chofer asignado"}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 6 }}>
                {!r.activa && <Badge clase="none">Inactiva</Badge>}
                <Feather name="chevron-right" size={18} color={T.gris} />
              </View>
            </View>
          </Tarjeta>
        </Pressable>
      ))}

      <Hoja visible={!!sel} onClose={() => setSel(null)} titulo={sel ? `Chofer de ${sel.nombre}` : ""}>
        {sel && (
          <>
            <Text style={s.nota}>Escoge quién maneja esta ruta. Al guardar, sus paradas de "El de la ruta" le aparecen en su app.</Text>
            <View style={s.lista}>
              <Fila on={!sel.choferId} onPress={() => elegir("")} texto="Sin chofer asignado" disabled={guardando} />
              {choferes.map((c) => (
                <Fila key={c.id} on={sel.choferId === c.id} onPress={() => elegir(c.id)} texto={c.nombre} disabled={guardando} />
              ))}
            </View>
            {choferes.length === 0 && <Text style={s.nota}>No hay choferes activos. Invítalos desde Usuarios y roles.</Text>}
            {guardando && <Text style={s.nota}>Guardando…</Text>}
            <AvisoResultado r={res} />
          </>
        )}
      </Hoja>
    </ScrollView>
  );
}

function Fila({ on, onPress, texto, disabled }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[s.fila, on && s.filaOn]} accessibilityRole="radio" accessibilityState={{ checked: !!on }}>
      <Feather name={on ? "check-circle" : "circle"} size={18} color={on ? T.accionTxt : T.grisClaro} />
      <Text style={[s.filaTxt, on && { fontWeight: "700" }]}>{texto}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  nota: { color: T.gris, fontSize: 12.5, lineHeight: 18, marginTop: 6 },
  lista: { marginTop: 12, backgroundColor: T.panel, borderWidth: 1, borderColor: T.linea, borderRadius: 12, overflow: "hidden" },
  fila: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, minHeight: 48, borderBottomWidth: 1, borderBottomColor: T.linea },
  filaOn: { backgroundColor: T.accionTinte },
  filaTxt: { color: T.tinta, fontSize: 14, flex: 1 },
});
