import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, RefreshControl } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "../../tema";
import { Tarjeta, Badge } from "../../ui";
import { listarRutasConChofer, listarChoferes, cambiarChoferRuta } from "../../datos-equipo";
import { filasRutas } from "../../apps-admin.mjs";
import { Fallo, Listo } from "../../piezas-100";
import { Hoja } from "./piezas-cuentas";

/**
 * RUTAS Y SU CHOFER (9-oct-2026, apps al 100%).
 *
 * Hasta la Entrega 3 el chofer de una ruta era un nombre escrito a mano y
 * `rutas.chofer_id` nunca se llenaba. De ese id dependen las paradas que ve
 * cada chofer y sus avisos: una recolección "con el de la ruta" en una ruta
 * sin chofer no le aparecía a NADIE. Aquí se escoge de la lista de choferes.
 * Lo demás de la ruta (zonas, sectores, pines) se edita en la web: Más → En
 * la web → Zonas y sectores.
 */
export default function RutasAdmin() {
  const [rutas, setRutas] = useState(null);
  const [choferes, setChoferes] = useState([]);
  const [fallo, setFallo] = useState(null);
  const [refrescando, setRefrescando] = useState(false);
  const [sel, setSel] = useState(null);
  const [guardando, setGuardando] = useState("");
  const [falloHoja, setFalloHoja] = useState(null);
  const [hecho, setHecho] = useState("");

  const cargar = useCallback(async () => {
    const [r, c] = await Promise.all([listarRutasConChofer(), listarChoferes()]);
    if (r === null) setFallo({ sinRed: true, motivo: "No se pudieron leer las rutas." });
    else { setFallo(null); setRutas(filasRutas(r)); }
    if (c) setChoferes(c);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const refrescar = async () => {
    setRefrescando(true);
    try { await cargar(); } finally { setRefrescando(false); }
  };

  const elegir = async (choferId) => {
    if (!sel || guardando) return;
    setGuardando(choferId || "ninguno");
    setFalloHoja(null);
    const r = await cambiarChoferRuta(sel.id, choferId, choferes);
    setGuardando("");
    if (!r.ok) { setFalloHoja({ sinRed: r.sinRed, motivo: r.motivo }); return; }
    const nombre = choferes.find((c) => c.id === choferId)?.nombre;
    setHecho(nombre ? `${sel.nombre}: ahora la maneja ${nombre}. Sus paradas le aparecen a él.` : `${sel.nombre} quedó sin chofer asignado.`);
    setSel(null);
    cargar();
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: T.fondo }}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={T.gris} />}
    >
      <Text style={s.h1}>Rutas</Text>
      <Text style={s.sub}>Quién maneja cada ruta. Las paradas confirmadas "con el de la ruta" le llegan a ese chofer.</Text>

      <Listo onCerrar={() => setHecho("")}>{hecho}</Listo>
      <Fallo fallo={fallo} onReintentar={cargar} style={{ marginTop: 0, marginBottom: 12 }} />
      {rutas === null && !fallo ? <Text style={s.nota}>Leyendo las rutas…</Text> : null}
      {rutas && rutas.length === 0 ? <Text style={s.nota}>Todavía no hay rutas.</Text> : null}

      {(rutas || []).map((r) => (
        <Pressable key={r.id} onPress={() => { setSel(r); setFalloHoja(null); }} accessibilityRole="button" accessibilityLabel={`${r.nombre}, ${r.textoChofer}. Cambiar chofer`}>
          <Tarjeta style={{ padding: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.clave}>{r.clave}</Text>
                <Text style={s.nombre}>{r.nombre}</Text>
                <Text style={s.nota}>{r.dias}</Text>
                <View style={s.choferFila}>
                  <Feather name="user" size={14} color={r.choferId ? T.ok : T.alerta} />
                  <Text style={[s.chofer, !r.choferId && { color: T.alerta }]}>{r.textoChofer}</Text>
                </View>
                {r.aMano ? <Text style={s.aMano}>Decía «{r.aMano}» escrito a mano: escoge al chofer de la lista para que vea sus paradas.</Text> : null}
              </View>
              <View style={{ alignItems: "flex-end", gap: 6 }}>
                {!r.activa ? <Badge clase="none">Inactiva</Badge> : null}
                <Feather name="chevron-right" size={20} color={T.gris} />
              </View>
            </View>
          </Tarjeta>
        </Pressable>
      ))}

      <Hoja visible={!!sel} onClose={() => setSel(null)} titulo={sel ? `${sel.clave} · ${sel.nombre}` : ""}>
        {sel ? (
          <>
            <Text style={s.hojaTit}>¿Quién maneja {sel.nombre}?</Text>
            <Text style={[s.nota, { marginBottom: 12 }]}>Al cambiarlo, las paradas de esta ruta le aparecen al chofer nuevo.</Text>
            <FilaChofer on={!sel.choferId} ocupado={guardando === "ninguno"} onPress={() => elegir("")} texto="Sin chofer asignado" />
            {choferes.map((c) => (
              <FilaChofer key={c.id} on={sel.choferId === c.id} ocupado={guardando === c.id} onPress={() => elegir(c.id)} texto={c.nombre} />
            ))}
            {!choferes.length ? <Text style={s.nota}>No hay choferes activos. Invítalos en Usuarios y roles.</Text> : null}
            <Fallo fallo={falloHoja} onReintentar={() => setFalloHoja(null)} />
          </>
        ) : null}
      </Hoja>
    </ScrollView>
  );
}

function FilaChofer({ on, onPress, texto, ocupado }) {
  return (
    <Pressable onPress={onPress} disabled={ocupado} style={[s.fila, on && s.filaOn]} accessibilityRole="radio" accessibilityState={{ checked: !!on }}>
      <Feather name={on ? "check-circle" : "circle"} size={18} color={on ? T.accionTxt : T.grisClaro} />
      <Text style={[s.filaTxt, on && { fontWeight: "700" }]}>{ocupado ? "Guardando…" : texto}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  h1: { color: T.tinta, fontSize: 22, fontWeight: "800" },
  sub: { color: T.gris, fontSize: 13.5, marginTop: 3, marginBottom: 14, lineHeight: 19 },
  nota: { color: T.gris, fontSize: 12.5, lineHeight: 18 },
  clave: { color: T.gris, fontSize: 11.5 },
  nombre: { color: T.tinta, fontSize: 15, fontWeight: "700", marginTop: 2 },
  choferFila: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  chofer: { color: T.tinta, fontSize: 13, fontWeight: "600" },
  aMano: { color: T.alerta, fontSize: 12, marginTop: 6, lineHeight: 17 },
  hojaTit: { color: T.tinta, fontSize: 18, fontWeight: "800" },
  fila: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, minHeight: 50, borderWidth: 1, borderColor: T.linea, borderRadius: 10, marginBottom: 6 },
  filaOn: { backgroundColor: T.accionTinte, borderColor: T.accion },
  filaTxt: { color: T.tinta, fontSize: 14.5, flex: 1 },
});
