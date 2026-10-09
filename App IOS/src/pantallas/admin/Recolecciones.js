import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, Pressable, Modal, Image, TextInput, RefreshControl, Alert, ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "../../tema";
import { Tarjeta, Badge, Boton } from "../../ui";
import { ESTADOS_SOLICITUD_REC } from "../../rutas-datos";
import { listarOperadores } from "../../datos-remoto";
import {
  buscarRecolecciones, pendientesOficina, recoleccionPorId, programarRecoleccion, rechazarRecoleccion, fotoNoProcedio,
} from "../../datos-oficina";
import {
  hoyISO, estadoVencimiento, ordenarPorUrgencia, opcionesReagenda, textoAtraso,
  queSePuede, planPorOmision, normalizarHora, choferQueVa, fechaCortaDia, HORAS_RAPIDAS, TEXTO_PROGRAMAR,
} from "../../oficina.mjs";
import { rangoPorOmision } from "../../web/consulta-recolecciones.mjs";
import { textoChoferPorOmision, avisoRutaSinChofer } from "../../web/rutas-chofer.mjs";
import { totalPaginas, textoPagina } from "../../apps-admin.mjs";
import { Fallo } from "../../piezas-100";
import CalendarioMes from "./CalendarioMes";
import CalendarioFecha from "../../CalendarioFecha";

/**
 * RECOLECCIONES DE LA OFICINA EN EL TELÉFONO (6-oct-2026) — la misma
 * pantalla que /admin/recolecciones de la web: lo vencido arriba, filtros
 * por estado, y en cada una confirmar (día, hora y chofer), rechazar con
 * motivo, cambiar una confirmada o reagendar una vencida.
 *
 * 9-oct-2026 (apps al 100%): se BUSCA EN LA BASE, como la web (folio o
 * empresa, Desde/Hasta y páginas de 50 con el total). Antes se traían las
 * últimas 500 y lo de antes desaparecía sin aviso. Las VENCIDAS se piden
 * aparte: no pueden perderse aunque queden fuera del rango. Y "Nueva
 * recolección" para los pedidos por teléfono o WhatsApp.
 *
 * Todo lo que escribe va por el servidor (datos-oficina.js → /api/app/
 * recolecciones/*): ahí quedan la bitácora, el correo y la notificación al
 * cliente y al chofer, igual que desde la web. El peso real del relleno se
 * abre en la web (Más → En la web → Peso real).
 *
 * Se llega desde Más, desde "Cambiar" en la Agenda de servicios y al tocar
 * la notificación de una recolección pedida (`params.id` busca esa).
 */
export default function Recolecciones({ navigation, route }) {
  const hoy = hoyISO();
  const [filtros, setFiltros] = useState(() => ({ q: "", ...rangoPorOmision(hoy), estado: "" }));
  const [texto, setTexto] = useState("");
  const [pagina, setPagina] = useState(1);
  const [filas, setFilas] = useState([]);
  const [total, setTotal] = useState(0);
  const [pend, setPend] = useState({ vencidas: [], porConfirmar: 0 });
  const [cargando, setCargando] = useState(true);
  const [fallo, setFallo] = useState(null);
  const [refrescando, setRefrescando] = useState(false);
  const [verVencidas, setVerVencidas] = useState(false);
  const [calendario, setCalendario] = useState(""); // "" | "desde" | "hasta"
  const [sel, setSel] = useState(null);
  const [choferes, setChoferes] = useState([]);
  const [hecho, setHecho] = useState("");
  const turno = useRef(0);

  const cargar = useCallback(async () => {
    const n = ++turno.current;
    const [r, p] = await Promise.all([buscarRecolecciones({ ...filtros, pagina }), pendientesOficina(hoy)]);
    if (n !== turno.current) return;
    if (r.ok) {
      setFallo(null);
      setFilas(r.filas);
      setTotal(r.total);
    } else {
      setFallo({ sinRed: true, motivo: r.motivo });
    }
    if (p) setPend(p);
    setCargando(false);
  }, [filtros, pagina, hoy]);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    listarOperadores().then(setChoferes).catch(() => {});
  }, []);

  // Al volver a la pantalla (de la Agenda, de "Nueva recolección") se relee:
  // la web, un cliente o el chofer pudieron cambiar algo mientras tanto.
  useEffect(() => navigation.addListener("focus", () => cargar()), [cargar, navigation]);

  // El buscador espera a que se deje de escribir.
  useEffect(() => {
    const t = setTimeout(() => {
      setFiltros((f) => (f.q === texto ? f : { ...f, q: texto }));
      setPagina(1);
    }, 400);
    return () => clearTimeout(t);
  }, [texto]);

  // `params.id`: abrir esa recolección (notificación o "Cambiar" de la
  // Agenda). Se lee de la base por su id —puede estar fuera del rango— y se
  // busca su folio para que también quede en la lista.
  const pedida = route?.params?.id || null;
  useEffect(() => {
    if (!pedida) return;
    let vivo = true;
    recoleccionPorId(pedida).then((x) => {
      if (!vivo || !x) return;
      setVerVencidas(false);
      setTexto(x.folio || "");
      setFiltros((f) => ({ ...f, q: x.folio || "", desde: "", hasta: "", estado: "" }));
      setPagina(1);
      setSel(x);
    });
    navigation.setParams({ id: undefined });
    return () => { vivo = false; };
  }, [pedida, navigation]);

  // Recién creada en "Nueva recolección".
  const creada = route?.params?.creada || null;
  useEffect(() => {
    if (!creada) return;
    setHecho(creada);
    navigation.setParams({ creada: undefined });
  }, [creada, navigation]);

  const refrescar = async () => {
    setRefrescando(true);
    try { await cargar(); } finally { setRefrescando(false); }
  };

  const cambiaFiltro = (patch) => {
    setFiltros((f) => ({ ...f, ...patch }));
    setPagina(1);
  };

  const vencidas = pend.vencidas || [];
  const lista = useMemo(
    () => (verVencidas ? ordenarPorUrgencia(vencidas, hoy) : filas),
    [verVencidas, vencidas, filas, hoy]
  );
  const paginas = totalPaginas(total);
  const badge = (id) => ESTADOS_SOLICITUD_REC.find((e) => e.id === id) || { texto: id, clase: "none" };

  const alTerminar = async (texto2) => {
    setSel(null);
    setHecho(texto2);
    await cargar();
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: T.fondo }}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={T.gris} />}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={s.h1}>Recolecciones</Text>
          <Text style={[s.sub, { marginBottom: 0 }]}>
            {pend.porConfirmar === 0
              ? "No hay solicitudes por confirmar."
              : `${pend.porConfirmar} solicitud${pend.porConfirmar === 1 ? "" : "es"} por confirmar.`}
          </Text>
        </View>
        <Pressable
          onPress={() => navigation.navigate("NuevaRecoleccion")}
          style={s.btnNueva}
          accessibilityRole="button"
          accessibilityLabel="Nueva recolección"
        >
          <Feather name="plus" size={16} color="#fff" />
          <Text style={s.btnNuevaTxt}>Nueva</Text>
        </Pressable>
      </View>

      <View style={{ height: 14 }} />

      {!!hecho && (
        <View style={s.hecho} accessibilityLiveRegion="polite">
          <Feather name="check-circle" size={16} color={T.ok} />
          <Text style={s.hechoTxt}>{hecho}</Text>
          <Pressable onPress={() => setHecho("")} hitSlop={10} accessibilityLabel="Cerrar aviso"><Feather name="x" size={16} color={T.gris} /></Pressable>
        </View>
      )}

      {/* Lo vencido va ARRIBA de todo: es lo que hay que resolver hoy. */}
      {vencidas.length > 0 && !verVencidas && (
        <View style={s.vencidas}>
          <Feather name="alert-triangle" size={18} color={T.error} />
          <View style={{ flex: 1 }}>
            <Text style={s.vencidasTit}>
              {vencidas.length === 1 ? "1 recolección se pasó de fecha" : `${vencidas.length} recolecciones se pasaron de fecha`}
            </Text>
            <Text style={s.vencidasSub}>Reagéndalas: puedes ponerlas para hoy mismo.</Text>
          </View>
          <Pressable onPress={() => setVerVencidas(true)} style={s.vencidasBtn} accessibilityRole="button">
            <Text style={s.vencidasBtnTxt}>Ver esas</Text>
          </Pressable>
        </View>
      )}

      {verVencidas ? (
        <Pressable onPress={() => setVerVencidas(false)} style={s.volver} accessibilityRole="button">
          <Feather name="arrow-left" size={15} color={T.accionTxt} />
          <Text style={s.volverTxt}>Vencidas ({vencidas.length}) · volver a la búsqueda</Text>
        </Pressable>
      ) : (
        <>
          {/* Búsqueda en la base: folio o empresa. */}
          <View style={s.buscador}>
            <Feather name="search" size={16} color={T.gris} />
            <TextInput
              value={texto}
              onChangeText={setTexto}
              placeholder="Folio o empresa"
              placeholderTextColor={T.grisClaro}
              style={s.buscadorInput}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              accessibilityLabel="Buscar por folio o empresa"
            />
            {texto ? (
              <Pressable onPress={() => setTexto("")} hitSlop={10} accessibilityLabel="Borrar búsqueda"><Feather name="x" size={16} color={T.gris} /></Pressable>
            ) : null}
          </View>

          {/* Desde / Hasta sobre la fecha efectiva (por omisión, desde hace 30 días). */}
          <View style={s.fechasFila}>
            <Opcion on={calendario === "desde"} onPress={() => setCalendario((c) => (c === "desde" ? "" : "desde"))}>
              Desde: {filtros.desde ? fechaCortaDia(filtros.desde) : "el inicio"}
            </Opcion>
            <Opcion on={calendario === "hasta"} onPress={() => setCalendario((c) => (c === "hasta" ? "" : "hasta"))}>
              Hasta: {filtros.hasta ? fechaCortaDia(filtros.hasta) : "sin tope"}
            </Opcion>
          </View>
          {calendario ? (
            <View style={{ marginTop: 8 }}>
              <CalendarioFecha
                valor={filtros[calendario]}
                onCambiar={(f) => { cambiaFiltro({ [calendario]: f }); setCalendario(""); }}
                min={calendario === "hasta" ? filtros.desde || undefined : undefined}
                max={calendario === "desde" ? filtros.hasta || undefined : undefined}
                hoy={hoy}
              />
              <Pressable onPress={() => { cambiaFiltro({ [calendario]: "" }); setCalendario(""); }} style={s.quitarFecha} accessibilityRole="button">
                <Text style={s.quitarFechaTxt}>{calendario === "desde" ? "Sin fecha de inicio" : "Sin tope"}</Text>
              </Pressable>
            </View>
          ) : null}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 12 }} contentContainerStyle={{ gap: 8 }}>
            <Chip on={filtros.estado === ""} onPress={() => cambiaFiltro({ estado: "" })}>Todas</Chip>
            {ESTADOS_SOLICITUD_REC.map((e) => (
              <Chip key={e.id} on={filtros.estado === e.id} onPress={() => cambiaFiltro({ estado: e.id })}>{e.texto}</Chip>
            ))}
          </ScrollView>
        </>
      )}

      {cargando && <Text style={s.vacio}>Leyendo las recolecciones…</Text>}
      {!cargando && fallo && !verVencidas && (
        <Fallo fallo={fallo} onReintentar={() => { setCargando(true); cargar(); }} style={{ marginTop: 0, marginBottom: 12 }} />
      )}
      {!cargando && !fallo && lista.length === 0 && (
        <Text style={s.vacio}>
          {verVencidas ? "No hay recolecciones vencidas." : filtros.q || filtros.estado ? "Ninguna recolección con esa búsqueda." : "No hay recolecciones en esas fechas."}
        </Text>
      )}

      {lista.map((x) => {
        const b = badge(x.estado);
        const venc = estadoVencimiento(x, hoy);
        const quien = choferQueVa(x);
        return (
          <Pressable
            key={x.id}
            onPress={() => setSel(x)}
            accessibilityRole="button"
            accessibilityLabel={`${x.folio}, ${x.cliente}, ${b.texto}${venc.vencida ? `, ${venc.texto}` : ""}`}
          >
            <Tarjeta style={[{ padding: 14 }, venc.vencida && s.tarjetaVencida]}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.folio}>{x.folio} · pedida para {fechaCortaDia(x.fechaPedida)}</Text>
                  <Text style={s.cliente} numberOfLines={2}>{x.cliente}</Text>
                  <Text style={s.det} numberOfLines={2}>
                    {[x.punto, x.rutaNombre, x.origen === "extra" ? "Extra" : "De ruta"].filter((t) => t && t !== "—").join(" · ")}
                  </Text>
                  <Text style={s.det}>Residuo: {x.tipoResiduo || "sin especificar"}</Text>
                  {!!x.fechaConfirmada && ["confirmada", "en-ruta", "completada", "no-procedio"].includes(x.estado) && (
                    <Text style={s.acordado}>
                      Acordado: {fechaCortaDia(x.fechaConfirmada)}
                      {x.horaConfirmada ? ` a las ${String(x.horaConfirmada).slice(0, 5)}` : " (sin hora)"}
                      {" · "}{quien.nombre ? `${quien.nombre} (${quien.de})` : "sin chofer asignado"}
                    </Text>
                  )}
                </View>
                <View style={{ alignItems: "flex-end", gap: 6 }}>
                  {venc.vencida && <Badge clase="mal">{venc.texto} · {textoAtraso(venc.dias)}</Badge>}
                  <Badge clase={b.clase}>{b.texto}</Badge>
                </View>
              </View>
            </Tarjeta>
          </Pressable>
        );
      })}

      {/* Páginas de 50, con el total. */}
      {!verVencidas && !fallo && total > 0 && (
        <View style={s.paginas}>
          <Pressable
            onPress={() => setPagina((p) => Math.max(1, p - 1))}
            disabled={pagina <= 1}
            style={[s.pagBtn, pagina <= 1 && { opacity: 0.35 }]}
            accessibilityRole="button"
            accessibilityLabel="Página anterior"
          >
            <Feather name="chevron-left" size={18} color={T.tinta} />
          </Pressable>
          <Text style={s.pagTxt}>{textoPagina({ pagina, total })}</Text>
          <Pressable
            onPress={() => setPagina((p) => Math.min(paginas, p + 1))}
            disabled={pagina >= paginas}
            style={[s.pagBtn, pagina >= paginas && { opacity: 0.35 }]}
            accessibilityRole="button"
            accessibilityLabel="Página siguiente"
          >
            <Feather name="chevron-right" size={18} color={T.tinta} />
          </Pressable>
        </View>
      )}

      <Modal visible={!!sel} animationType="slide" transparent onRequestClose={() => setSel(null)}>
        <View style={s.modalFondo}>
          <View style={s.modal}>
            {sel && (
              <Detalle
                key={sel.id}
                s={sel}
                hoy={hoy}
                choferes={choferes}
                badge={badge(sel.estado)}
                onCerrar={() => setSel(null)}
                onListo={alTerminar}
              />
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ */
/* El detalle de una recolección, con sus acciones                     */
/* ------------------------------------------------------------------ */

function Detalle({ s: x, hoy, choferes, badge, onCerrar, onListo }) {
  const puede = queSePuede(x, hoy);
  const venc = estadoVencimiento(x, hoy);
  const quien = choferQueVa(x);
  const [plan, setPlan] = useState(() => planPorOmision(x, hoy));
  const [horaTexto, setHoraTexto] = useState(plan.hora);
  const [verCalendario, setVerCalendario] = useState(false);
  // "Cambiar" una confirmada se abre a propósito: no se le pone el editor
  // encima a algo que ya está acordado si solo se quiere mirar.
  const [editando, setEditando] = useState(puede.programar !== "cambiar");
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const [foto, setFoto] = useState(null); // null | "cargando" | "sin-foto" | url

  const atajos = opcionesReagenda(x.diasRuta, hoy);
  const elegido = choferes.find((c) => c.id === plan.choferId);

  const guardar = async () => {
    const h = normalizarHora(horaTexto);
    if (!h.ok) return setError(h.motivo);
    if (!plan.fecha) return setError("Elige el día.");
    setOcupado(true);
    setError("");
    const r = await programarRecoleccion({ id: x.id, fecha: plan.fecha, hora: h.hora, choferId: plan.choferId });
    setOcupado(false);
    if (!r.ok) return setError(r.motivo);
    const cuando = `${fechaCortaDia(plan.fecha)}${h.hora ? ` a las ${h.hora}` : ""}`;
    onListo(
      puede.programar === "confirmar"
        ? `${x.folio} confirmada para el ${cuando}. Ya se avisó al cliente y al chofer.`
        : `${x.folio} quedó para el ${cuando}. Ya se avisó al cliente y al chofer.`
    );
  };

  const rechazar = () => {
    Alert.alert(
      "¿Rechazar la recolección?",
      `Se le avisa a ${x.cliente} por correo con el motivo${motivo.trim() ? "" : " «Sin cupo en la ruta.»"}.`,
      [
        { text: "No", style: "cancel" },
        {
          text: "Rechazar",
          style: "destructive",
          onPress: async () => {
            setOcupado(true);
            setError("");
            const r = await rechazarRecoleccion(x.id, motivo.trim());
            setOcupado(false);
            if (!r.ok) return setError(r.motivo);
            onListo(`${x.folio} rechazada. Se le avisó al cliente.`);
          },
        },
      ]
    );
  };

  const verFoto = async () => {
    setFoto("cargando");
    const url = await fotoNoProcedio(x.id);
    setFoto(url || "sin-foto");
  };

  return (
    <ScrollView
      contentContainerStyle={{ padding: 18, paddingBottom: 36 }}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <View style={s.modalCab}>
        <Text style={s.modalFolio}>{x.folio}</Text>
        <Pressable onPress={onCerrar} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cerrar"><Feather name="x" size={22} color={T.gris} /></Pressable>
      </View>
      <Text style={s.modalCliente}>{x.cliente}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
        {venc.vencida && <Badge clase="mal">{venc.texto} · {textoAtraso(venc.dias)}</Badge>}
        <Badge clase={badge.clase}>{badge.texto}</Badge>
      </View>
      {venc.vencida && <Text style={s.vencidaDet}>{venc.detalle}</Text>}

      <View style={s.datos}>
        <Dato k="Punto" v={x.punto || "—"} />
        <Dato k="Ruta" v={x.rutaNombre} />
        <Dato k="Tipo" v={x.origen === "extra" ? "Recolección extra" : "De su ruta"} />
        <Dato k="Residuo que pidió" v={x.tipoResiduo || "Sin especificar"} />
        <Dato k="Pedida para" v={fechaCortaDia(x.fechaPedida)} />
        {!!x.fechaConfirmada && (
          <Dato
            k="Acordado"
            v={`${fechaCortaDia(x.fechaConfirmada)}${x.horaConfirmada ? ` · ${String(x.horaConfirmada).slice(0, 5)}` : " · sin hora"}`}
          />
        )}
        <Dato k="Chofer" v={quien.nombre ? `${quien.nombre} (${quien.de})` : "Sin chofer asignado"} />
      </View>

      {!!x.nota && <Text style={s.nota}>“{x.nota}”</Text>}
      {!!x.motivoRechazo && x.estado === "rechazada" && <Text style={s.rechazo}>Rechazada: {x.motivoRechazo}</Text>}

      {/* "No procedió": el chofer sí llegó. Su motivo y su foto son el
          respaldo ante el cliente; no cuenta como incumplida ni se cobra. */}
      {x.estado === "no-procedio" && (
        <View style={s.noProc}>
          <Text style={s.noProcTit}>No procedió: {x.motivoNoProcedio || "sin motivo registrado"}</Text>
          {!!x.detalleNoProcedio && <Text style={s.noProcDet}>{x.detalleNoProcedio}</Text>}
          {foto === null && (
            <Boton variante="linea" onPress={verFoto} style={{ marginTop: 10 }}>Ver foto del chofer</Boton>
          )}
          {foto === "cargando" && <ActivityIndicator color={T.gris} style={{ marginTop: 10, alignSelf: "flex-start" }} />}
          {foto === "sin-foto" && <Text style={s.noProcDet}>El chofer no dejó foto.</Text>}
          {foto && !["cargando", "sin-foto"].includes(foto) && (
            <Image
              source={{ uri: foto }}
              style={s.fotoNP}
              resizeMode="cover"
              accessibilityLabel={`Foto de la visita ${x.folio}`}
            />
          )}
        </View>
      )}

      {puede.programar === "cambiar" && !editando && (
        <Boton variante="linea" onPress={() => setEditando(true)} style={{ marginTop: 16 }}>
          Cambiar día, hora o chofer
        </Boton>
      )}

      {puede.programar && editando && (
        <>
          <Text style={s.seccion}>
            {puede.programar === "reagendar" ? "Reagendar para" : puede.programar === "cambiar" ? "Cambiar a" : "Agendar para"}
          </Text>
          {/* Propone, no decide: hoy/mañana son extra; el otro es cuando la
              unidad ya pasa por ahí. El calendario queda para lo demás. */}
          <View style={s.chips}>
            {atajos.map((o) => (
              <Opcion key={o.id} on={plan.fecha === o.fecha} onPress={() => { setPlan((p) => ({ ...p, fecha: o.fecha })); setVerCalendario(false); }}>
                {o.texto} · {fechaCortaDia(o.fecha)}
              </Opcion>
            ))}
            <Opcion on={verCalendario} onPress={() => setVerCalendario((v) => !v)}>Otro día…</Opcion>
          </View>
          {verCalendario && (
            <CalendarioMes valor={plan.fecha} minimo={hoy} onElegir={(f) => setPlan((p) => ({ ...p, fecha: f }))} />
          )}
          <Text style={s.elegido}>Día: <Text style={{ color: T.tinta, fontWeight: "700" }}>{fechaCortaDia(plan.fecha)}</Text></Text>

          <Text style={s.seccion}>Hora (opcional)</Text>
          <View style={s.chips}>
            <Opcion on={!horaTexto} onPress={() => setHoraTexto("")}>Sin hora</Opcion>
            {HORAS_RAPIDAS.map((h) => (
              <Opcion key={h} on={horaTexto === h} onPress={() => setHoraTexto(h)}>{h}</Opcion>
            ))}
          </View>
          <TextInput
            value={horaTexto}
            onChangeText={setHoraTexto}
            placeholder="Otra hora, p. ej. 09:30"
            placeholderTextColor={T.grisClaro}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
            style={s.input}
            accessibilityLabel="Hora acordada, en formato de 24 horas"
          />

          <Text style={s.seccion}>Chofer</Text>
          <View style={s.choferes}>
            <FilaChofer
              on={!plan.choferId}
              onPress={() => setPlan((p) => ({ ...p, choferId: "" }))}
              texto={textoChoferPorOmision({ choferId: x.rutaChoferId, chofer: x.choferRuta })}
            />
            {choferes.map((c) => (
              <FilaChofer key={c.id} on={plan.choferId === c.id} onPress={() => setPlan((p) => ({ ...p, choferId: c.id }))} texto={c.nombre} />
            ))}
          </View>

          {/* Sin chofer elegido y sin chofer en la ruta, nadie la vería. */}
          {!!avisoRutaSinChofer({ choferElegido: plan.choferId, ruta: { choferId: x.rutaChoferId } }) && (
            <Text style={s.avisoChofer}>{avisoRutaSinChofer({ choferElegido: plan.choferId, ruta: { choferId: x.rutaChoferId } })}</Text>
          )}

          {!!error && <AvisoError texto={error} />}

          <Boton onPress={guardar} disabled={ocupado} style={{ marginTop: 16 }}>
            {ocupado ? "Guardando…" : TEXTO_PROGRAMAR[puede.programar]}
          </Boton>
          <Text style={s.ayuda}>
            Al guardar se le avisa al cliente y al chofer{elegido ? ` (${elegido.nombre})` : ""}, por correo y al teléfono.
          </Text>
          {puede.programar === "cambiar" && (
            <Boton variante="linea" onPress={() => { setEditando(false); setError(""); }} disabled={ocupado} style={{ marginTop: 10 }}>
              Cancelar
            </Boton>
          )}
        </>
      )}

      {puede.rechazar && (
        <>
          <Text style={s.seccion}>Rechazar</Text>
          <TextInput
            value={motivo}
            onChangeText={setMotivo}
            placeholder="Motivo del rechazo (por omisión: Sin cupo en la ruta.)"
            placeholderTextColor={T.grisClaro}
            maxLength={300}
            multiline
            style={[s.input, { minHeight: 64, textAlignVertical: "top" }]}
            accessibilityLabel="Motivo del rechazo"
          />
          {!puede.programar && !!error && <AvisoError texto={error} />}
          <Pressable
            onPress={rechazar}
            disabled={ocupado}
            style={({ pressed }) => [s.btnRechazar, { opacity: ocupado ? 0.5 : pressed ? 0.85 : 1 }]}
            accessibilityRole="button"
          >
            <Feather name="x-circle" size={16} color={T.error} />
            <Text style={s.btnRechazarTxt}>Rechazar recolección</Text>
          </Pressable>
        </>
      )}

      {!puede.programar && !puede.rechazar && x.estado === "en-ruta" && (
        <Text style={s.ayuda}>El chofer ya la tomó: mientras va en ruta no se le cambia el día ni el chofer.</Text>
      )}
    </ScrollView>
  );
}

function Dato({ k, v }) {
  return (
    <View style={s.datoFila}>
      <Text style={s.datoK}>{k}</Text>
      <Text style={s.datoV}>{v}</Text>
    </View>
  );
}

function AvisoError({ texto }) {
  return (
    <View style={s.errorCaja} accessibilityLiveRegion="polite">
      <Feather name="alert-circle" size={14} color={T.error} />
      <Text style={s.errorTxt}>{texto}</Text>
    </View>
  );
}

function Chip({ on, onPress, alerta, children }) {
  return (
    <Pressable
      onPress={onPress}
      style={[s.chip, on && (alerta ? s.chipAlerta : s.chipOn)]}
      accessibilityRole="button"
      accessibilityState={{ selected: !!on }}
    >
      <Text style={[s.chipTxt, on && { color: alerta ? "#fff" : "#0d1211" }]}>{children}</Text>
    </Pressable>
  );
}

function Opcion({ on, onPress, children }) {
  return (
    <Pressable onPress={onPress} style={[s.opcion, on && s.opcionOn]} accessibilityRole="button" accessibilityState={{ selected: !!on }}>
      <Text style={[s.opcionTxt, on && { color: "#fff", fontWeight: "700" }]}>{children}</Text>
    </Pressable>
  );
}

function FilaChofer({ on, onPress, texto }) {
  return (
    <Pressable onPress={onPress} style={[s.filaChofer, on && s.filaChoferOn]} accessibilityRole="radio" accessibilityState={{ checked: !!on }}>
      <Feather name={on ? "check-circle" : "circle"} size={18} color={on ? T.accionTxt : T.grisClaro} />
      <Text style={[s.filaChoferTxt, on && { fontWeight: "700" }]}>{texto}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  h1: { color: T.tinta, fontSize: 22, fontWeight: "800" },
  sub: { color: T.gris, fontSize: 13.5, marginTop: 3, marginBottom: 14, lineHeight: 19 },
  vacio: { color: T.gris, fontSize: 13.5, lineHeight: 19, marginTop: 6 },
  hecho: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(111,168,103,0.12)", borderWidth: 1, borderColor: "rgba(111,168,103,0.4)", borderRadius: 10, padding: 11, marginBottom: 12 },
  hechoTxt: { color: T.tinta, fontSize: 13, flex: 1, lineHeight: 18 },
  vencidas: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(217,119,107,0.10)", borderWidth: 1, borderColor: "rgba(217,119,107,0.45)", borderRadius: 12, padding: 12, marginBottom: 12 },
  vencidasTit: { color: T.tinta, fontSize: 14, fontWeight: "700" },
  vencidasSub: { color: T.gris, fontSize: 12, marginTop: 2 },
  vencidasBtn: { paddingHorizontal: 12, minHeight: 40, justifyContent: "center", borderRadius: 9, borderWidth: 1, borderColor: T.error },
  vencidasBtnTxt: { color: T.error, fontSize: 12.5, fontWeight: "700" },
  chip: { paddingHorizontal: 13, minHeight: 36, justifyContent: "center", borderRadius: 20, borderWidth: 1, borderColor: T.linea, backgroundColor: T.panel },
  chipOn: { backgroundColor: T.naranja, borderColor: T.naranja },
  chipAlerta: { backgroundColor: T.error, borderColor: T.error },
  chipTxt: { color: T.gris, fontSize: 12.5, fontWeight: "600" },
  tarjetaVencida: { borderColor: "rgba(217,119,107,0.55)" },
  folio: { color: T.gris, fontSize: 11.5 },
  cliente: { color: T.tinta, fontSize: 15, fontWeight: "700", marginTop: 3 },
  det: { color: T.gris, fontSize: 12.5, marginTop: 2, lineHeight: 17 },
  acordado: { color: T.ok, fontSize: 12.5, marginTop: 4, lineHeight: 17 },
  modalFondo: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modal: { backgroundColor: T.fondo, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: "94%", borderWidth: 1, borderColor: T.linea },
  modalCab: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modalFolio: { color: T.gris, fontSize: 13, fontWeight: "700" },
  modalCliente: { color: T.tinta, fontSize: 19, fontWeight: "800", marginTop: 6 },
  vencidaDet: { color: T.error, fontSize: 12.5, marginTop: 8, lineHeight: 17 },
  datos: { marginTop: 12 },
  datoFila: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: T.linea },
  datoK: { color: T.gris, fontSize: 13 },
  datoV: { color: T.tinta, fontSize: 13, fontWeight: "600", flexShrink: 1, textAlign: "right" },
  nota: { color: T.gris, fontSize: 13, fontStyle: "italic", marginTop: 10, lineHeight: 18 },
  rechazo: { color: T.adminTxt, fontSize: 13, marginTop: 10 },
  noProc: { marginTop: 12, borderLeftWidth: 3, borderLeftColor: T.alerta, paddingLeft: 11 },
  noProcTit: { color: T.alerta, fontSize: 13.5, fontWeight: "700", lineHeight: 18 },
  noProcDet: { color: T.tinta, fontSize: 13, marginTop: 4, lineHeight: 18 },
  fotoNP: { width: "100%", aspectRatio: 4 / 3, borderRadius: 10, borderWidth: 1, borderColor: T.linea, marginTop: 10 },
  seccion: { color: T.gris, fontSize: 11, letterSpacing: 0.5, marginTop: 18, marginBottom: 8, textTransform: "uppercase" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  opcion: { paddingHorizontal: 12, minHeight: 40, justifyContent: "center", borderRadius: 10, borderWidth: 1, borderColor: T.linea, backgroundColor: T.panel },
  opcionOn: { backgroundColor: T.accion, borderColor: T.accion },
  opcionTxt: { color: T.tinta, fontSize: 13 },
  elegido: { color: T.gris, fontSize: 12.5, marginTop: 8 },
  input: { backgroundColor: T.panel2, borderWidth: 1, borderColor: T.linea, borderRadius: 10, color: T.tinta, fontSize: 15, paddingHorizontal: 12, paddingVertical: 10, marginTop: 8, minHeight: 46 },
  choferes: { backgroundColor: T.panel, borderWidth: 1, borderColor: T.linea, borderRadius: 12, overflow: "hidden" },
  filaChofer: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, minHeight: 48, borderBottomWidth: 1, borderBottomColor: T.linea },
  filaChoferOn: { backgroundColor: T.accionTinte },
  filaChoferTxt: { color: T.tinta, fontSize: 14, flex: 1 },
  ayuda: { color: T.grisClaro, fontSize: 12, marginTop: 8, lineHeight: 17 },
  errorCaja: { flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: "rgba(217,119,107,0.10)", borderWidth: 1, borderColor: "rgba(217,119,107,0.35)", borderRadius: 10, padding: 10, marginTop: 12 },
  errorTxt: { color: T.error, fontSize: 12.5, flex: 1, lineHeight: 17 },
  btnRechazar: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 48, borderRadius: 11, borderWidth: 1, borderColor: "rgba(217,119,107,0.6)", marginTop: 10 },
  btnRechazarTxt: { color: T.error, fontSize: 14.5, fontWeight: "700" },
  avisoChofer: { color: T.adminTxt, fontSize: 12.5, marginTop: 10, lineHeight: 17 },
  btnNueva: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: T.accion, borderRadius: 10, paddingHorizontal: 14, minHeight: 44 },
  btnNuevaTxt: { color: "#fff", fontWeight: "700", fontSize: 13.5 },
  buscador: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: T.panel2, borderWidth: 1, borderColor: T.linea, borderRadius: 10, paddingHorizontal: 12, minHeight: 46 },
  buscadorInput: { flex: 1, color: T.tinta, fontSize: 14.5, paddingVertical: 10 },
  fechasFila: { flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" },
  quitarFecha: { alignSelf: "flex-start", paddingVertical: 8, minHeight: 36 },
  quitarFechaTxt: { color: T.accionTxt, fontSize: 13, fontWeight: "700" },
  volver: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12, minHeight: 40 },
  volverTxt: { color: T.accionTxt, fontSize: 13.5, fontWeight: "700" },
  paginas: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 14, marginTop: 4 },
  pagBtn: { width: 44, height: 44, borderRadius: 10, borderWidth: 1, borderColor: T.linea, alignItems: "center", justifyContent: "center", backgroundColor: T.panel },
  pagTxt: { color: T.gris, fontSize: 13 },
});
