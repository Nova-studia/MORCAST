import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, FlatList, RefreshControl, Modal, ScrollView, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "../../tema";
import { Tarjeta } from "../../ui";
import CalendarioDia from "../../CalendarioDia";
import { bitacoraDelDia } from "../../datos-comunicacion";
import { diaEnMatamoros, moverDia, nombreDelDia, textoDeAccion, resumenBitacora, OPCIONES_ACCION } from "../../bitacora-vista.js";

/** La hora del movimiento, en la de Matamoros (el día ya va arriba). */
function hora(iso) {
  const d = new Date(iso);
  try {
    return d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", timeZone: "America/Matamoros" });
  } catch {
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
}

/**
 * BITÁCORA (solo lectura), como morcast.mx/admin/bitacora: quién hizo qué y
 * cuándo. Nadie la puede editar desde aquí ni desde la web.
 *
 * POR DÍA (pedido de Luis, 6-oct-2026): al abrir se ve solo HOY (el día de
 * Matamoros), con ‹ ›, "Hoy", "Ayer" y un calendario para ir a otro. El
 * filtro de acción trabaja dentro del día. La consulta pide ese día a la
 * base (`bitacoraDelDia`), no se baja todo para filtrar aquí.
 */
export default function BitacoraAdmin() {
  const hoy = diaEnMatamoros();
  const [dia, setDia] = useState(hoy);
  const [accion, setAccion] = useState("");
  const [res, setRes] = useState({ cargando: true, ok: true, filas: [], total: 0 });
  const [refrescando, setRefrescando] = useState(false);
  const [calendario, setCalendario] = useState(false);
  const [eligeAccion, setEligeAccion] = useState(false);

  const cargar = useCallback(async () => {
    const r = await bitacoraDelDia({ dia, accion });
    setRes({ cargando: false, ...r, filas: r.filas || [], total: r.total || 0 });
  }, [dia, accion]);

  useEffect(() => {
    let vivo = true;
    setRes((x) => ({ ...x, cargando: true }));
    bitacoraDelDia({ dia, accion }).then((r) => {
      if (vivo) setRes({ cargando: false, ...r, filas: r.filas || [], total: r.total || 0 });
    });
    return () => { vivo = false; };
  }, [dia, accion]);

  const refrescar = async () => {
    setRefrescando(true);
    try { await cargar(); } finally { setRefrescando(false); }
  };

  const ayer = moverDia(hoy, -1);
  const nombre = nombreDelDia(dia, hoy);
  const fechaEscrita = nombreDelDia(dia, "");
  const textoAccion = accion ? textoDeAccion({ accion }) : "Todas las acciones";

  const encabezado = (
    <View>
      <Text style={s.h1}>Bitácora</Text>
      <Text style={s.sub}>Quién hizo qué y cuándo. Se guarda sola y no se puede editar: es la respuesta cuando algo no cuadra.</Text>

      <Tarjeta style={{ padding: 12 }}>
        <View style={s.filaDia}>
          <Pressable onPress={() => setDia(moverDia(dia, -1))} style={s.flecha} accessibilityRole="button" accessibilityLabel="Día anterior">
            <Feather name="chevron-left" size={22} color={T.tinta} />
          </Pressable>
          <Pressable onPress={() => setCalendario(true)} style={s.diaBoton} accessibilityRole="button" accessibilityLabel={`Día: ${fechaEscrita}. Toca para elegir otro`}>
            <Feather name="calendar" size={15} color={T.accionTxt} />
            <View style={{ alignItems: "center" }}>
              <Text style={s.diaNombre}>{nombre}</Text>
              {nombre !== fechaEscrita && <Text style={s.diaFecha}>{fechaEscrita}</Text>}
            </View>
          </Pressable>
          <Pressable
            onPress={() => setDia(moverDia(dia, 1))}
            disabled={dia >= hoy}
            style={[s.flecha, dia >= hoy && { opacity: 0.3 }]}
            accessibilityRole="button"
            accessibilityLabel="Día siguiente"
            accessibilityState={{ disabled: dia >= hoy }}
          >
            <Feather name="chevron-right" size={22} color={T.tinta} />
          </Pressable>
        </View>

        <View style={s.atajos}>
          {[{ id: hoy, t: "Hoy" }, { id: ayer, t: "Ayer" }].map((x) => (
            <Pressable
              key={x.t}
              onPress={() => setDia(x.id)}
              style={[s.chip, dia === x.id && s.chipOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: dia === x.id }}
            >
              <Text style={[s.chipTxt, dia === x.id && { color: "#fff" }]}>{x.t}</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => setEligeAccion(true)} style={[s.chip, { flex: 1 }, !!accion && s.chipOn]} accessibilityRole="button" accessibilityLabel={`Filtrar por acción: ${textoAccion}`}>
            <Feather name="filter" size={13} color={accion ? "#fff" : T.gris} />
            <Text style={[s.chipTxt, accion && { color: "#fff" }]} numberOfLines={1}>{textoAccion}</Text>
          </Pressable>
        </View>
      </Tarjeta>

      <Text style={s.cuenta}>
        {res.cargando ? "Leyendo…" : `${res.total} ${res.total === 1 ? "movimiento" : "movimientos"}`}
        {!res.cargando && res.total > res.filas.length ? ` · se enseñan los ${res.filas.length} más recientes` : ""}
      </Text>
    </View>
  );

  return (
    <>
      <FlatList
        style={{ flex: 1, backgroundColor: T.fondo }}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        data={res.cargando ? [] : res.filas}
        keyExtractor={(f) => String(f.id)}
        ListHeaderComponent={encabezado}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={T.gris} />}
        ListEmptyComponent={
          res.cargando ? (
            <ActivityIndicator color={T.gris} style={{ marginTop: 24 }} />
          ) : !res.ok ? (
            <Text style={s.vacio}>No se pudo leer la bitácora. Revisa tu señal y jala hacia abajo para reintentar.</Text>
          ) : (
            <View style={s.vacioCaja}>
              <Feather name="inbox" size={26} color={T.grisClaro} />
              <Text style={s.vacio}>Sin movimientos este día{accion ? " con esa acción" : ""}.</Text>
            </View>
          )
        }
        renderItem={({ item: f }) => (
          <View style={s.mov} accessible accessibilityLabel={`${hora(f.creado)}. ${f.actor_correo || "Sin usuario"}. ${textoDeAccion(f)}. ${resumenBitacora(f)}`}>
            <Text style={s.movHora}>{hora(f.creado)}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.movQue}>{textoDeAccion(f)}</Text>
              <Text style={s.movQuien} numberOfLines={1}>{f.actor_correo || "—"}</Text>
              <Text style={s.movDet}>{resumenBitacora(f)}</Text>
            </View>
          </View>
        )}
      />

      <CalendarioDia
        visible={calendario}
        valor={dia}
        max={hoy}
        titulo="Ver la bitácora del día…"
        onCerrar={() => setCalendario(false)}
        onElegir={(f) => { setCalendario(false); setDia(f); }}
      />

      <Modal visible={eligeAccion} animationType="slide" transparent onRequestClose={() => setEligeAccion(false)}>
        <View style={s.hojaFondo}>
          <View style={s.hoja}>
            <View style={s.hojaCab}>
              <Text style={s.hojaTit}>Filtrar por acción</Text>
              <Pressable onPress={() => setEligeAccion(false)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cerrar">
                <Feather name="x" size={22} color={T.gris} />
              </Pressable>
            </View>
            <ScrollView>
              {[{ id: "", texto: "Todas las acciones" }, ...OPCIONES_ACCION].map((o) => (
                <Pressable
                  key={o.id || "todas"}
                  onPress={() => { setAccion(o.id); setEligeAccion(false); }}
                  style={s.opcion}
                  accessibilityRole="button"
                  accessibilityState={{ selected: accion === o.id }}
                >
                  <Text style={[s.opcionTxt, accion === o.id && { color: T.accionTxt, fontWeight: "700" }]}>{o.texto}</Text>
                  {accion === o.id && <Feather name="check" size={18} color={T.accionTxt} />}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  h1: { color: T.tinta, fontSize: 22, fontWeight: "800" },
  sub: { color: T.gris, fontSize: 13.5, marginTop: 3, marginBottom: 14, lineHeight: 19 },
  filaDia: { flexDirection: "row", alignItems: "center" },
  flecha: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  diaBoton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 48 },
  diaNombre: { color: T.tinta, fontSize: 16.5, fontWeight: "800" },
  diaFecha: { color: T.gris, fontSize: 12, marginTop: 1 },
  atajos: { flexDirection: "row", gap: 8, marginTop: 8 },
  chip: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: T.linea },
  chipOn: { backgroundColor: T.accion, borderColor: T.accion },
  chipTxt: { color: T.gris, fontSize: 13, fontWeight: "600", flexShrink: 1 },
  cuenta: { color: T.gris, fontSize: 12.5, marginBottom: 8, marginTop: 2 },
  vacioCaja: { alignItems: "center", paddingVertical: 28, gap: 8 },
  vacio: { color: T.gris, fontSize: 13.5, textAlign: "center", lineHeight: 19 },
  mov: { flexDirection: "row", gap: 12, backgroundColor: T.panel, borderWidth: 1, borderColor: T.linea, borderRadius: 12, padding: 12, marginBottom: 8 },
  movHora: { color: T.accionTxt, fontSize: 13, fontWeight: "700", width: 54 },
  movQue: { color: T.tinta, fontSize: 14, fontWeight: "700" },
  movQuien: { color: T.gris, fontSize: 12, marginTop: 2 },
  movDet: { color: T.grisClaro, fontSize: 12.5, marginTop: 4, lineHeight: 17 },
  hojaFondo: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  hoja: { backgroundColor: T.fondo, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: "80%", borderWidth: 1, borderColor: T.linea, paddingBottom: 24 },
  hojaCab: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 18, borderBottomWidth: 1, borderBottomColor: T.linea },
  hojaTit: { color: T.tinta, fontSize: 16, fontWeight: "800" },
  opcion: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: T.linea, minHeight: 48 },
  opcionTxt: { color: T.tinta, fontSize: 14.5, flex: 1 },
});
