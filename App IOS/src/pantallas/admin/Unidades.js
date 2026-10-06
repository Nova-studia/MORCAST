import { useState } from "react";
import { View, Text, ScrollView, RefreshControl, Alert, StyleSheet } from "react-native";
import { T } from "../../tema";
import { Tarjeta, Badge } from "../../ui";
import { listarUnidades, cambiarEstadoUnidad, ESTADOS_UNIDAD, estadoDe, claseBadge, nombreTipoUnidad } from "../../datos-cuentas";
import { useLista, atenderSegundoPaso, Chip, Chips, Aviso, ErrorCarga, estilosCuentas as e } from "./piezas-cuentas";

const FILTROS = [
  // Por omisión, las que pueden salir a la calle (como la web).
  { id: "operacion", texto: "En operación", pasa: (u) => u.estado !== "baja" },
  { id: "taller", texto: "En taller", pasa: (u) => u.estado === "taller" },
  { id: "baja", texto: "De baja", pasa: (u) => u.estado === "baja" },
  { id: "todas", texto: "Todas", pasa: () => true },
];

const fecha = (iso) => {
  if (!iso) return "Sin fecha";
  const [a, m, d] = String(iso).split("-").map(Number);
  return new Date(a, (m || 1) - 1, d || 1).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
};

/**
 * UNIDADES (6-oct-2026, paridad con /admin/unidades): la flota con sus
 * rutas y su estado — activa, en taller o de baja. En el teléfono se cambia
 * el ESTADO (lo que pasa en la calle: "se fue al taller"); dar de alta una
 * unidad o editar sus fechas se hace en la página, donde está el formulario
 * completo con sus validaciones.
 */
export default function Unidades({ navigation }) {
  const { lista, setLista, cargando, refrescando, errorCarga, recargar } = useLista(listarUnidades);
  const [filtro, setFiltro] = useState("operacion");
  const [guardando, setGuardando] = useState("");
  const [errores, setErrores] = useState({});

  const pasa = FILTROS.find((f) => f.id === filtro).pasa;
  const filas = lista.filter(pasa);
  const activas = lista.filter((u) => u.estado === "activa").length;
  const enTaller = lista.filter((u) => u.estado === "taller").length;

  const cambiar = (u, estado) => {
    if (u.estado === estado) return;
    const hacer = async () => {
      setGuardando(u.id);
      setErrores((x) => ({ ...x, [u.id]: "" }));
      const r = await cambiarEstadoUnidad(u.id, estado);
      setGuardando("");
      if (atenderSegundoPaso(r, navigation)) return;
      if (!r.ok) { setErrores((x) => ({ ...x, [u.id]: r.motivo || "No se pudo guardar." })); return; }
      setLista((l) => l.map((x) => (x.id === u.id ? { ...x, estado } : x)));
    };
    if (estado !== "baja") { hacer(); return; }
    // De baja deja de salir al asignar rutas: se confirma.
    Alert.alert(
      "Dar de baja",
      `La unidad ${u.numero_economico} deja de aparecer al asignar rutas. Su historia no se borra. ¿Darla de baja?`,
      [{ text: "Cancelar", style: "cancel" }, { text: "Dar de baja", style: "destructive", onPress: hacer }]
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: T.fondo }}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => recargar({ jalando: true })} tintColor={T.gris} />}
    >
      <Text style={e.h1}>Unidades</Text>
      <Text style={e.sub}>
        {lista.length} unidades · {activas} activas{enTaller > 0 ? ` · ${enTaller} en taller` : ""}. El alta y las fechas de
        seguro y verificación se editan en la página.
      </Text>

      <Chips>
        {FILTROS.map((f) => (
          <Chip key={f.id} on={filtro === f.id} onPress={() => setFiltro(f.id)}>{f.texto} ({lista.filter(f.pasa).length})</Chip>
        ))}
      </Chips>

      {cargando && <Text style={e.vacio}>Leyendo las unidades…</Text>}
      {!cargando && errorCarga && <ErrorCarga que="las unidades" onReintentar={() => recargar()} />}
      {!cargando && !errorCarga && filas.length === 0 && <Text style={e.vacio}>No hay unidades en este filtro.</Text>}

      {filas.map((u) => {
        const est = estadoDe(ESTADOS_UNIDAD, u.estado);
        return (
          <Tarjeta key={u.id} style={{ padding: 14 }}>
            <View style={e.fila}>
              <View style={{ flex: 1 }}>
                <Text style={e.folio}>{[u.placas, nombreTipoUnidad(u.tipo)].filter(Boolean).join(" · ")}</Text>
                <Text style={e.titulo}>{u.numero_economico}{u.marca_modelo ? ` · ${u.marca_modelo}` : ""}</Text>
                <Text style={e.linea}>{u.rutas?.length ? `Rutas: ${u.rutas.join(", ")}` : "Sin ruta asignada"}</Text>
                <Text style={st.vence}>Seguro: {fecha(u.vence_seguro)} · Verificación: {fecha(u.vence_verificacion)}</Text>
              </View>
              <Badge clase={claseBadge(est.clase)}>{est.texto}</Badge>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 10, opacity: guardando === u.id ? 0.5 : 1 }}>
              {ESTADOS_UNIDAD.map((s) => (
                <Chip key={s.id} on={u.estado === s.id} onPress={() => guardando !== u.id && cambiar(u, s.id)} etiqueta={`Marcar como ${s.texto}`}>
                  {s.texto}
                </Chip>
              ))}
            </View>
            {!!errores[u.id] && <Aviso tipo="error">{errores[u.id]}</Aviso>}
          </Tarjeta>
        );
      })}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  vence: { color: T.grisClaro, fontSize: 12, marginTop: 4 },
});
