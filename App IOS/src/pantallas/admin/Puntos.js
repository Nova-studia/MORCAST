import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, RefreshControl, Alert, Linking, TextInput, Switch } from "react-native";
import { T } from "../../tema";
import { Tarjeta, Badge } from "../../ui";
import { leerUbicacion, avisarSinPermiso } from "../../gps";
import {
  listarPuntos,
  listarSectores,
  listarRutasParaPuntos,
  guardarPunto,
  asignarRutaAPunto,
  estadoUbicacion,
  filtrarPuntos,
  FILTROS_PUNTO,
  revisarLecturaPin,
  revisarServiciosPorMes,
  diasDeRuta,
  direccionPunto,
  enlaceVerPunto,
} from "../../datos-cuentas";
import {
  useLista, atenderSegundoPaso, Chip, Chips, Hoja, Aviso, ErrorCarga, Campo, Dato, Seccion, Accion, estilosCuentas as e,
} from "./piezas-cuentas";

/**
 * PUNTOS DE RECOLECCIÓN (6-oct-2026, paridad con Rutas, sectores y puntos →
 * Puntos de la web, SIN el mapa para dibujar: en el teléfono se trabaja con
 * la lista).
 *
 * Lo que se hace aquí:
 *  · encontrar los que faltan: sin ubicación, por revisar (el pin lo puso el
 *    cliente en su alta) y sin ruta, y por sector;
 *  · "Confirmar ubicación" del pin que puso el cliente (pasa a la oficina);
 *  · "Usar mi ubicación actual aquí": parado en la puerta del cliente, el
 *    GPS del teléfono se vuelve el pin (dentro de Matamoros, como la web);
 *  · las referencias para llegar;
 *  · su RUTA: ruta activa con sus días y chofer, recolecciones al mes y "por
 *    llamada" — sin ruta el cliente no puede agendar en la app.
 *
 * Todo lo que escribe va por `/api/app/puntos/*`, el mismo código del panel.
 * `route.params.puntoId` abre ese punto (el "Revisar pin y asignarle su
 * ruta" de Altas).
 */

const cuando = (iso) =>
  iso ? new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Matamoros" }) : "";

export default function Puntos({ navigation, route }) {
  const { lista: puntos, setLista, cargando, refrescando, errorCarga, recargar } = useLista(listarPuntos);
  const [sectores, setSectores] = useState([]);
  const [rutas, setRutas] = useState([]);
  const [filtro, setFiltro] = useState("todos");
  const [sector, setSector] = useState("");
  const [texto, setTexto] = useState("");
  const [selId, setSelId] = useState(null);

  useEffect(() => {
    let vivo = true;
    Promise.all([listarSectores(), listarRutasParaPuntos()]).then(([s, r]) => {
      if (!vivo) return;
      setSectores(s);
      setRutas(r);
    });
    return () => { vivo = false; };
  }, []);

  // Abrir el punto que pidió Altas, en cuanto lleguen los puntos (una vez).
  const pedido = route?.params?.puntoId;
  const abierto = useRef(null);
  useEffect(() => {
    if (!pedido || abierto.current === pedido || !puntos.length) return;
    if (puntos.some((p) => p.id === pedido)) {
      abierto.current = pedido;
      setSelId(pedido);
    }
  }, [pedido, puntos]);

  const porSector = useMemo(() => new Map(sectores.map((x) => [x.id, x])), [sectores]);
  const filas = useMemo(() => filtrarPuntos(puntos, { filtro, sector, texto }), [puntos, filtro, sector, texto]);
  const cuenta = (id) => filtrarPuntos(puntos, { filtro: id, sector, texto }).length;
  const sel = puntos.find((p) => p.id === selId) || null;

  const reflejar = (id, cambios) => setLista((l) => l.map((p) => (p.id === id ? { ...p, ...cambios } : p)));

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: T.fondo }}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => recargar({ jalando: true })} tintColor={T.gris} />}
    >
      <Text style={e.h1}>Puntos de recolección</Text>
      <Text style={e.sub}>Ubicación exacta, referencias para llegar y la ruta de cada punto.</Text>

      <Chips>
        {FILTROS_PUNTO.map((f) => (
          <Chip key={f.id} on={filtro === f.id} onPress={() => setFiltro(f.id)}>{f.texto} ({cuenta(f.id)})</Chip>
        ))}
      </Chips>
      {sectores.length > 0 && (
        <Chips>
          <Chip on={sector === ""} onPress={() => setSector("")}>Todos los sectores</Chip>
          {sectores.map((x) => (
            <Chip key={x.id} on={sector === x.id} onPress={() => setSector(x.id)}>{x.nombre}</Chip>
          ))}
          <Chip on={sector === "ninguno"} onPress={() => setSector("ninguno")}>Sin sector</Chip>
        </Chips>
      )}
      <TextInput
        style={s.buscar}
        value={texto}
        onChangeText={setTexto}
        placeholder="Buscar empresa, calle, colonia…"
        placeholderTextColor={T.grisClaro}
        accessibilityLabel="Buscar punto"
        autoCorrect={false}
        clearButtonMode="while-editing"
      />
      <Text style={[e.vacio, { paddingTop: 0 }]}>{filas.length} de {puntos.length} puntos</Text>

      {cargando && <Text style={e.vacio}>Leyendo los puntos…</Text>}
      {!cargando && errorCarga && <ErrorCarga que="los puntos" onReintentar={() => recargar()} />}
      {!cargando && !errorCarga && filas.length === 0 && (
        <Text style={e.vacio}>{puntos.length ? "Ningún punto coincide con esos filtros." : "Todavía no hay puntos de recolección."}</Text>
      )}

      {filas.map((p) => {
        const est = estadoUbicacion(p);
        const sec = p.sectorId ? porSector.get(p.sectorId) : null;
        return (
          <Pressable key={p.id} onPress={() => setSelId(p.id)} accessibilityRole="button" accessibilityLabel={`${p.empresa}, ${p.alias}, ${est.texto}`}>
            <Tarjeta style={{ padding: 14 }}>
              <View style={e.fila}>
                <View style={{ flex: 1 }}>
                  <Text style={e.titulo}>{p.empresa}</Text>
                  <Text style={e.linea} numberOfLines={2}>
                    {p.alias}{p.calle || p.colonia ? ` · ${[p.calle, p.colonia].filter(Boolean).join(", ")}` : ""}
                  </Text>
                  <Text style={[s.ruta, !p.ruta?.clave && { color: T.alerta }]}>
                    {p.ruta?.clave ? p.ruta.nombre || p.ruta.clave : "Sin ruta"}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 6 }}>
                  {sec && <LetraSector sector={sec} />}
                  <Badge clase={est.clase}>{est.corto}</Badge>
                </View>
              </View>
            </Tarjeta>
          </Pressable>
        );
      })}

      <Hoja visible={!!sel} onClose={() => setSelId(null)} titulo={sel ? [sel.alias, sel.clienteFolio].filter(Boolean).join(" · ") : ""}>
        {sel && (
          <DetallePunto
            key={sel.id}
            punto={sel}
            sector={sel.sectorId ? porSector.get(sel.sectorId) : null}
            rutas={rutas}
            navigation={navigation}
            reflejar={reflejar}
          />
        )}
      </Hoja>
    </ScrollView>
  );
}

function DetallePunto({ punto, sector, rutas, navigation, reflejar }) {
  const est = estadoUbicacion(punto);
  const [ocupado, setOcupado] = useState("");
  const [mensaje, setMensaje] = useState(null); // { tipo, texto }
  const [refs, setRefs] = useState(punto.referencias || "");

  /** Guarda pin y/o referencias y refleja en la lista lo que la base dejó. */
  const guardar = async (que, cambios, textoOk) => {
    setMensaje(null);
    setOcupado(que);
    const r = await guardarPunto(punto.id, cambios);
    setOcupado("");
    if (atenderSegundoPaso(r, navigation)) return;
    if (!r.ok) { setMensaje({ tipo: "error", texto: r.motivo || "No se pudo guardar. Revisa tu señal." }); return; }
    const f = r.punto || {};
    const nuevo = {};
    if (cambios.pin) {
      Object.assign(nuevo, {
        lat: f.lat ?? cambios.pin[0], lng: f.lng ?? cambios.pin[1], origen: "panel",
        fecha: f.ubicacion_fecha || new Date().toISOString(), sectorId: f.sector_id ?? r.sector?.id ?? null,
      });
    }
    if (cambios.referencias !== undefined) nuevo.referencias = f.referencias ?? cambios.referencias.trim();
    reflejar(punto.id, nuevo);
    const deSector = cambios.pin ? (r.sector ? ` Queda en el ${r.sector.nombre}.` : " No cae en ningún sector todavía.") : "";
    setMensaje({ tipo: "ok", texto: `${textoOk}${deSector}` });
  };

  const confirmar = () =>
    guardar("confirmar", { pin: [Number(punto.lat), Number(punto.lng)] }, "Ubicación confirmada: ya es de la oficina.");

  const usarMiUbicacion = async () => {
    setMensaje(null);
    setOcupado("gps");
    const r = await leerUbicacion({ alta: true });
    setOcupado("");
    if (!r.ok) {
      if (r.sinPermiso) avisarSinPermiso(r.motivo);
      else setMensaje({ tipo: "error", texto: r.motivo });
      return;
    }
    const v = revisarLecturaPin(r.lectura);
    if (!v.ok) { setMensaje({ tipo: "error", texto: v.motivo }); return; }
    const reemplaza = est.id !== "sin" ? " Reemplaza el pin que tiene ahora." : "";
    const precision = v.precision != null ? ` (precisión ±${v.precision} m)` : "";
    Alert.alert(
      "Usar mi ubicación actual",
      (v.imprecisa
        ? `La señal del GPS es imprecisa${precision}: el pin puede quedar lejos de la puerta. Mejor sal a la entrada, al aire libre.`
        : `Se guarda donde estás parado${precision} como la ubicación de ${punto.alias || "este punto"}.`) + reemplaza,
      [
        { text: "Cancelar", style: "cancel" },
        { text: v.imprecisa ? "Guardar de todos modos" : "Guardar aquí", onPress: () => guardar("gps", { pin: v.pin }, "Guardado con tu ubicación actual.") },
      ]
    );
  };

  const refsCambio = refs.trim() !== (punto.referencias || "").trim();

  return (
    <>
      <Text style={e.hojaTitulo}>{punto.empresa}</Text>
      <Text style={[e.hojaSub, { marginBottom: 8 }]}>{direccionPunto(punto)}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Badge clase={est.clase}>{est.texto}</Badge>
        {est.id !== "sin" && !!punto.fecha && <Text style={s.fecha}>el {cuando(punto.fecha)}</Text>}
        {sector && <LetraSector sector={sector} conNombre />}
      </View>

      <Accion icono="map" variante="linea" onPress={() => Linking.openURL(enlaceVerPunto(punto)).catch(() => {})}>
        {est.id === "sin" ? "Buscar la dirección en Google Maps" : "Ver en Google Maps"}
      </Accion>

      <Seccion>Ubicación</Seccion>
      {est.id === "cliente" && (
        <>
          <Text style={s.nota}>El cliente puso este pin al darse de alta. Revísalo en el mapa y confírmalo, o ve al lugar y usa tu ubicación.</Text>
          <Accion icono="check-circle" disabled={!!ocupado} onPress={confirmar}>
            {ocupado === "confirmar" ? "Guardando…" : "Confirmar ubicación"}
          </Accion>
        </>
      )}
      {est.id === "sin" && <Text style={s.nota}>Este punto no tiene ubicación. Parado en la entrada del lugar, usa la ubicación de tu teléfono.</Text>}
      {est.id === "chofer" && <Text style={s.nota}>La puso el chofer en su visita. Si la cambias, pasa a ser de la oficina y el chofer ya no podrá moverla.</Text>}
      <Accion icono="crosshair" variante={est.id === "cliente" ? "linea" : "verde"} disabled={!!ocupado} onPress={usarMiUbicacion}>
        {ocupado === "gps" ? "Leyendo el GPS…" : "Usar mi ubicación actual aquí"}
      </Accion>

      <Campo
        etiqueta="Referencias para llegar"
        valor={refs}
        onCambio={(v) => { setRefs(v); setMensaje(null); }}
        placeholder="Ej. portón azul, entrar por la calle Uniones"
        multiline
        maxLength={500}
        style={[s.area]}
      />
      {refsCambio && (
        <Accion icono="save" disabled={!!ocupado} onPress={() => guardar("refs", { referencias: refs }, "Referencias guardadas.")}>
          {ocupado === "refs" ? "Guardando…" : "Guardar referencias"}
        </Accion>
      )}

      {mensaje && <Aviso tipo={mensaje.tipo}>{mensaje.texto}</Aviso>}

      <RutaDelPunto punto={punto} rutas={rutas} navigation={navigation} reflejar={reflejar} />
    </>
  );
}

/** La sección Ruta (como RutaDelPunto.js de la web). Se guarda aparte del pin. */
function RutaDelPunto({ punto, rutas, navigation, reflejar }) {
  const inicial = {
    rutaClave: punto.ruta?.clave || "",
    serviciosPorMes: String(punto.ruta?.serviciosPorMes ?? 4),
    porLlamada: Boolean(punto.ruta?.porLlamada),
  };
  const [b, setB] = useState(inicial);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  const sucio = b.rutaClave !== inicial.rutaClave || b.serviciosPorMes !== inicial.serviciosPorMes || b.porLlamada !== inicial.porLlamada;
  const elegida = rutas.find((r) => r.id === b.rutaClave);
  // Sólo las activas; la que ya tenía se enseña aunque se haya desactivado.
  const opciones = rutas.filter((r) => r.activa || r.id === inicial.rutaClave);
  const cambiar = (c) => { setB((x) => ({ ...x, ...c })); setMensaje(null); };

  const guardar = async () => {
    const n = revisarServiciosPorMes(b.serviciosPorMes);
    if (!n.ok) { setMensaje({ tipo: "error", texto: n.motivo }); return; }
    setGuardando(true);
    setMensaje(null);
    const r = await asignarRutaAPunto({ domicilioId: punto.id, rutaClave: b.rutaClave || null, serviciosPorMes: n.n, porLlamada: b.porLlamada });
    setGuardando(false);
    if (atenderSegundoPaso(r, navigation)) return;
    if (!r.ok) { setMensaje({ tipo: "error", texto: r.motivo || "No se pudo guardar. Revisa tu señal." }); return; }
    const ruta = { clave: b.rutaClave || null, nombre: elegida?.nombre || "", serviciosPorMes: n.n, porLlamada: b.porLlamada };
    reflejar(punto.id, { ruta });
    setMensaje({
      tipo: "ok",
      texto: ruta.clave
        ? `Listo: ${punto.empresa} ya está en la ${ruta.nombre}. Desde hoy puede pedir en sus días de ruta, en la página y en la app.`
        : "Listo: el punto quedó sin ruta.",
    });
  };

  return (
    <>
      <Seccion>Ruta</Seccion>
      <Text style={s.nota}>
        {inicial.rutaClave
          ? "La ruta que pasa por este punto. El cliente pide sus recolecciones en los días de esta ruta."
          : "Este punto no tiene ruta: el cliente sólo puede pedir recolecciones extra desde la página, y en la app no puede agendar."}
      </Text>
      <View style={{ gap: 8, marginTop: 10 }}>
        <OpcionRuta on={b.rutaClave === ""} titulo="Sin ruta" onPress={() => cambiar({ rutaClave: "" })} />
        {opciones.map((r) => (
          <OpcionRuta
            key={r.id}
            on={b.rutaClave === r.id}
            titulo={`${r.nombre}${!r.activa ? " (desactivada)" : ""}`}
            detalle={r.dias?.length ? diasDeRuta(r) : "Sin días"}
            onPress={() => cambiar({ rutaClave: r.id })}
          />
        ))}
      </View>
      {elegida && (
        <Text style={[s.nota, { marginTop: 8 }]}>
          {elegida.dias?.length ? `Pasa: ${diasDeRuta(elegida)}.` : "Esta ruta todavía no tiene días: el cliente no verá fechas hasta que se pongan en Rutas."}
          {elegida.chofer ? ` Chofer: ${elegida.chofer}.` : " Sin chofer asignado en la ruta."}
        </Text>
      )}
      <Campo
        etiqueta="Recolecciones al mes"
        valor={b.serviciosPorMes}
        onCambio={(v) => cambiar({ serviciosPorMes: v.replace(/\D/g, "").slice(0, 3) })}
        keyboardType="number-pad"
        style={[{ width: 120 }]}
      />
      <View style={s.switchFila}>
        <Text style={s.switchTxt}>Por llamada (sin días fijos)</Text>
        <Switch
          value={b.porLlamada}
          onValueChange={(v) => cambiar({ porLlamada: v })}
          accessibilityLabel="Por llamada, sin días fijos"
          trackColor={{ true: T.accion, false: T.linea }}
        />
      </View>
      <Accion icono="save" variante="naranja" onPress={guardar} disabled={!sucio || guardando}>
        {guardando ? "Guardando…" : "Guardar ruta"}
      </Accion>
      {sucio && !guardando && (
        <Accion variante="linea" onPress={() => { setB(inicial); setMensaje(null); }}>Descartar</Accion>
      )}
      {mensaje && <Aviso tipo={mensaje.tipo}>{mensaje.texto}</Aviso>}
    </>
  );
}

function OpcionRuta({ on, titulo, detalle, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={[s.opcion, on && s.opcionOn]}
      accessibilityRole="radio"
      accessibilityState={{ checked: Boolean(on) }}
      accessibilityLabel={detalle ? `${titulo}, ${detalle}` : titulo}
    >
      <View style={[s.radio, on && s.radioOn]} />
      <View style={{ flex: 1 }}>
        <Text style={s.opcionTit}>{titulo}</Text>
        {!!detalle && <Text style={s.opcionDet}>{detalle}</Text>}
      </View>
    </Pressable>
  );
}

function LetraSector({ sector, conNombre = false }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }} accessible accessibilityLabel={sector.nombre}>
      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: sector.color || T.accion, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>{sector.clave}</Text>
      </View>
      {conNombre && <Text style={s.fecha}>{sector.nombre}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  buscar: { backgroundColor: T.panel2, borderWidth: 1, borderColor: T.linea, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, color: T.tinta, fontSize: 14, minHeight: 46, marginBottom: 8 },
  ruta: { color: T.gris, fontSize: 12, marginTop: 4, fontWeight: "600" },
  fecha: { color: T.gris, fontSize: 12.5 },
  nota: { color: T.gris, fontSize: 12.5, lineHeight: 18 },
  area: { minHeight: 80, textAlignVertical: "top" },
  switchFila: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14, gap: 12, minHeight: 44 },
  switchTxt: { color: T.tinta, fontSize: 13.5, flex: 1 },
  opcion: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: T.linea, backgroundColor: T.panel, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 12, minHeight: 48 },
  opcionOn: { borderColor: T.accion, backgroundColor: T.accionTinte },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: T.gris },
  radioOn: { borderColor: T.accionTxt, backgroundColor: T.accionTxt },
  opcionTit: { color: T.tinta, fontSize: 13.5, fontWeight: "700" },
  opcionDet: { color: T.gris, fontSize: 12, marginTop: 2 },
});
