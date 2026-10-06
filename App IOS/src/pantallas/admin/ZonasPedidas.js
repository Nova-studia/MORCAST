import { useState } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl, Linking, StyleSheet } from "react-native";
import { T } from "../../tema";
import { Tarjeta, Badge } from "../../ui";
import { abrirWhatsApp } from "../../whatsapp";
import { listarZonasPedidas, cambiarEstadoZona, ESTADOS_ZONA, estadoDe, claseBadge, telefonoWhatsApp } from "../../datos-cuentas";
import { useLista, atenderSegundoPaso, Chip, Chips, Aviso, ErrorCarga, estilosCuentas as e } from "./piezas-cuentas";

/**
 * ZONAS PEDIDAS (6-oct-2026, paridad con /admin/zonas-pedidas): gente que
 * quedó fuera de cobertura y dejó su contacto. Es la lista de por dónde
 * conviene abrir la siguiente ruta. En el teléfono va sin el mapa: la lista,
 * el contacto y el estado (nueva → en evaluación → aprobada / descartada).
 */
export default function ZonasPedidas({ navigation }) {
  const { lista, setLista, cargando, refrescando, errorCarga, recargar } = useLista(listarZonasPedidas);
  const [filtro, setFiltro] = useState("todas");
  const [guardando, setGuardando] = useState("");
  const [errores, setErrores] = useState({}); // { [id]: motivo }

  const filas = filtro === "todas" ? lista : lista.filter((z) => z.estado === filtro);
  const conteo = (id) => lista.filter((z) => z.estado === id).length;

  // Se guarda primero: la pantalla no debe decir que se aprobó algo que la
  // base no registró.
  const cambiar = async (z, estado) => {
    if (z.estado === estado) return;
    setGuardando(z.id);
    setErrores((x) => ({ ...x, [z.id]: "" }));
    const r = await cambiarEstadoZona(z.id, estado);
    setGuardando("");
    if (atenderSegundoPaso(r, navigation)) return;
    if (!r.ok) { setErrores((x) => ({ ...x, [z.id]: r.motivo || "No se pudo guardar." })); return; }
    setLista((l) => l.map((x) => (x.id === z.id ? { ...x, estado } : x)));
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: T.fondo }}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => recargar({ jalando: true })} tintColor={T.gris} />}
    >
      <Text style={e.h1}>Zonas pedidas</Text>
      <Text style={e.sub}>Dónde están pidiendo servicio y todavía no pasa ninguna ruta. Donde se junten varias, conviene evaluar una ruta nueva.</Text>

      <Chips>
        <Chip on={filtro === "todas"} onPress={() => setFiltro("todas")}>Todas ({lista.length})</Chip>
        {ESTADOS_ZONA.map((s) => (
          <Chip key={s.id} on={filtro === s.id} onPress={() => setFiltro(s.id)}>{s.texto} ({conteo(s.id)})</Chip>
        ))}
      </Chips>

      {cargando && <Text style={e.vacio}>Leyendo las zonas…</Text>}
      {!cargando && errorCarga && <ErrorCarga que="las zonas pedidas" onReintentar={() => recargar()} />}
      {!cargando && !errorCarga && filas.length === 0 && <Text style={e.vacio}>No hay solicitudes fuera de cobertura en este filtro.</Text>}

      {filas.map((z) => {
        const est = estadoDe(ESTADOS_ZONA, z.estado);
        return (
          <Tarjeta key={z.id} style={{ padding: 14 }}>
            <View style={e.fila}>
              <View style={{ flex: 1 }}>
                <Text style={e.folio}>{[z.clave, z.fecha].filter(Boolean).join(" · ")}</Text>
                <Text style={e.titulo}>{z.empresa || z.nombreContacto || "Sin nombre"}</Text>
                <Text style={e.linea}>{[z.colonia, z.volumenEstimado].filter(Boolean).join(" · ")}</Text>
                <Text style={e.linea}>{[z.nombreContacto, z.telefono].filter(Boolean).join(" · ")}</Text>
              </View>
              <Badge clase={claseBadge(est.clase)}>{est.texto}</Badge>
            </View>

            <View style={st.acciones}>
              {!!z.telefono && (
                <Pressable style={st.contacto} onPress={() => abrirWhatsApp(telefonoWhatsApp(z.telefono), `Hola${z.nombreContacto ? " " + z.nombreContacto : ""}, le escribimos de Morcast del Norte sobre el servicio que pidió en ${z.colonia || "su zona"}.`)} accessibilityRole="button" accessibilityLabel={`WhatsApp a ${z.nombreContacto || z.empresa}`}>
                  <Text style={st.contactoTxt}>WhatsApp</Text>
                </Pressable>
              )}
              {!!z.telefono && (
                <Pressable style={st.contacto} onPress={() => Linking.openURL(`tel:${z.telefono}`).catch(() => {})} accessibilityRole="button" accessibilityLabel={`Llamar a ${z.nombreContacto || z.empresa}`}>
                  <Text style={st.contactoTxt}>Llamar</Text>
                </Pressable>
              )}
              {z.lat != null && z.lng != null && (
                <Pressable style={st.contacto} onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${z.lat},${z.lng}`).catch(() => {})} accessibilityRole="button" accessibilityLabel="Ver en el mapa">
                  <Text style={st.contactoTxt}>Mapa</Text>
                </Pressable>
              )}
            </View>

            <Text style={st.cambiar}>Cambiar estado</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7, opacity: guardando === z.id ? 0.5 : 1 }}>
              {ESTADOS_ZONA.map((s) => (
                <Chip key={s.id} on={z.estado === s.id} onPress={() => guardando !== z.id && cambiar(z, s.id)} etiqueta={`Marcar como ${s.texto}`}>
                  {s.texto}
                </Chip>
              ))}
            </View>
            {!!errores[z.id] && <Aviso tipo="error">{errores[z.id]}</Aviso>}
          </Tarjeta>
        );
      })}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  acciones: { flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" },
  contacto: { backgroundColor: T.panel2, borderWidth: 1, borderColor: T.linea, borderRadius: 9, paddingVertical: 9, paddingHorizontal: 13, minHeight: 40, justifyContent: "center" },
  contactoTxt: { color: T.tinta, fontSize: 12.5, fontWeight: "600" },
  cambiar: { color: T.gris, fontSize: 11, letterSpacing: 0.5, marginTop: 12, marginBottom: 6, textTransform: "uppercase", fontWeight: "700" },
});
