import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, RefreshControl, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "../../tema";
import { Tarjeta, TituloTarjeta, Boton } from "../../ui";
import CalendarioDia from "../../CalendarioDia";
import {
  listarSectoresAviso,
  listarRutasAviso,
  listarClientesAviso,
  listarAvisosEnviados,
  lectoresDeAviso,
  contarDestinatarios,
  mandarAviso,
  fueSinRed,
} from "../../datos-comunicacion";
import {
  ALCANCES_AVISO,
  MOTIVOS_AVISO,
  MAX_TITULO,
  MAX_MENSAJE,
  validarAviso,
  fraseResumen,
  textoAlcance,
  textoMotivo,
  fraseLecturas,
  textoNotificaciones,
  hoyMatamoros,
  nuevoIdEnvio,
  segundosEstimados,
  textoResultado,
} from "../../avisos-admin.js";
import { filtrarClientes, alternarId, marcarVisibles, textoMarcados } from "../../elegir-clientes.mjs";

/**
 * AVISOS A CLIENTES desde la app (6-oct-2026, paridad con /admin/avisos).
 *
 * Pedido de los dueños: avisar por sector, ruta o a un cliente cuando hay un
 * retraso o se reagenda. Llega por correo, arriba del portal y como
 * notificación a la app del cliente.
 *
 * Las mismas dos decisiones que la web:
 *  · ANTES de mandar se enseña a cuántas empresas y correos les llega.
 *  · Mandar pide una segunda confirmación con esa cifra a la vista: un aviso
 *    masivo no se puede "desmandar".
 *
 * Y una de la app: mandar tarda (un correo cada ~0.55 s; con 43 clientes,
 * unos 24 s) y la señal de la calle se puede caer en medio. Por eso hay
 * barra de avance y un `idEnvio` que se genera al confirmar: si se reintenta
 * con el mismo, el servidor contesta "ya se había mandado" en vez de
 * mandarlo dos veces.
 */


const FORM_VACIO = {
  // clienteIds: "Clientes específicos" (apps al 100%, 9-oct-2026, como la web).
  alcance: "todos", sectorId: "", rutaId: "", clienteId: "", clienteIds: [],
  motivo: "general", titulo: "", mensaje: "", vigenteHasta: "",
};

function fechaHora(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return d.toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Matamoros" });
  } catch {
    return d.toLocaleString();
  }
}

const fechaCorta = (f) => (f ? f.split("-").reverse().join("/") : "");

export default function AvisosAdmin() {
  const hoy = hoyMatamoros();
  const [sectores, setSectores] = useState([]);
  const [rutas, setRutas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [historial, setHistorial] = useState(null); // null = cargando
  const [falloHist, setFalloHist] = useState(false);
  const [refrescando, setRefrescando] = useState(false);

  const [form, setForm] = useState(FORM_VACIO);
  const [busqueda, setBusqueda] = useState("");
  const [vista, setVista] = useState({ cargando: false, resumen: null, motivo: "" });
  const [calendario, setCalendario] = useState(false);

  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState(null);
  // El id del envío se queda mientras el aviso no cambie: un reintento tras
  // perder la señal manda el MISMO y el servidor no lo repite.
  const idEnvio = useRef(null);

  const cargarHistorial = async () => {
    const h = await listarAvisosEnviados();
    setFalloHist(h === null);
    setHistorial(h || []);
  };

  useEffect(() => {
    let vivo = true;
    Promise.all([listarSectoresAviso(), listarRutasAviso(), listarClientesAviso()]).then(([s, r, c]) => {
      if (!vivo) return;
      setSectores(s);
      setRutas(r);
      setClientes(c);
    });
    cargarHistorial();
    return () => { vivo = false; };
  }, []);

  const refrescar = async () => {
    setRefrescando(true);
    try { await cargarHistorial(); } finally { setRefrescando(false); }
  };

  const cambia = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    // Cualquier cambio invalida la confirmación (la cifra ya no es la del
    // aviso que se mandaría) y el id de envío: ya es OTRO aviso.
    setConfirmando(false);
    idEnvio.current = null;
    setError("");
  };

  // ¿A cuántos les llega? Se recalcula al cambiar el destino, con una pausa
  // corta para no pedirlo a cada toque.
  const idDestino = { sector: form.sectorId, ruta: form.rutaId, cliente: form.clienteId, clientes: form.clienteIds.join(",") }[form.alcance] || "";
  useEffect(() => {
    let vivo = true;
    if (form.alcance !== "todos" && !idDestino) {
      setVista({ cargando: false, resumen: null, motivo: "" });
      return;
    }
    setVista((v) => ({ ...v, cargando: true }));
    const t = setTimeout(() => {
      contarDestinatarios({ alcance: form.alcance, sectorId: form.sectorId, rutaId: form.rutaId, clienteId: form.clienteId, clienteIds: form.clienteIds }).then((r) => {
        if (!vivo) return;
        setVista(r?.ok ? { cargando: false, resumen: r.resumen, motivo: "" } : { cargando: false, resumen: null, motivo: r?.motivo || "" });
      });
    }, 300);
    return () => { vivo = false; clearTimeout(t); };
  }, [form.alcance, form.sectorId, form.rutaId, form.clienteId, idDestino]);

  // La lista para marcar: todos (son decenas), filtrados por el buscador.
  const coincidencias = useMemo(() => filtrarClientes(clientes, busqueda), [busqueda, clientes]);
  const marcados = new Set(form.clienteIds);
  const nombreDe = (id) => clientes.find((c) => c.id === id)?.empresa || "Cliente";
  const rutasVisibles = rutas.filter((r) => r.activa !== false || r.id === form.rutaId);

  /** Primer toque: valida y enseña la confirmación con la cifra. */
  const revisar = () => {
    const v = validarAviso(form, { hoy });
    if (!v.ok) { setError(v.motivo); return; }
    if (vista.resumen && vista.resumen.clientes === 0) {
      setError("Ningún cliente cae en este alcance. Elige otro destino.");
      return;
    }
    if (!idEnvio.current) idEnvio.current = nuevoIdEnvio();
    setError("");
    setResultado(null);
    setConfirmando(true);
  };

  /** Segundo toque: manda de verdad. */
  const enviar = async () => {
    if (enviando) return;
    if (!idEnvio.current) idEnvio.current = nuevoIdEnvio();
    setEnviando(true);
    setError("");
    setSegundos(0);
    const reloj = setInterval(() => setSegundos((x) => x + 1), 1000);
    const r = await mandarAviso(form, idEnvio.current);
    clearInterval(reloj);
    setEnviando(false);

    if (!r?.ok) {
      if (fueSinRed(r)) {
        // No se sabe si salió: se queda la confirmación con el MISMO id para
        // reintentar sin miedo a mandarlo dos veces.
        setError("Se cortó la señal antes de saber si salió. Vuelve a tocar «Sí, mandar»: si ya había salido, no se manda otra vez.");
        return;
      }
      setConfirmando(false);
      setError(r?.segundoPaso
        ? "Confirma con el código que te llegó al correo y vuelve a tocar «Revisar y mandar». Lo que escribiste sigue aquí."
        : r?.motivo || "No se pudo mandar el aviso. Vuelve a intentarlo.");
      return;
    }

    setConfirmando(false);
    setResultado(r);
    idEnvio.current = null;
    setForm(FORM_VACIO);
    setBusqueda("");
    cargarHistorial();
  };

  const estimado = segundosEstimados(vista.resumen?.correos);
  const avance = Math.min(0.95, segundos / estimado);
  const tituloDestino = { sector: "el sector", ruta: "la ruta", cliente: "el cliente", clientes: "los clientes" }[form.alcance];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: T.fondo }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={T.gris} />}
    >
      <Text style={s.h1}>Avisos a clientes</Text>
      <Text style={s.sub}>Retrasos, reagendas o avisos generales. Llegan por correo, arriba del portal y a la app del cliente.</Text>

      <Tarjeta>
        <TituloTarjeta>Nuevo aviso</TituloTarjeta>

        <Text style={s.etiqueta}>¿A quién?</Text>
        <View style={s.chips}>
          {ALCANCES_AVISO.map((a) => (
            <Chip key={a.id} activo={form.alcance === a.id} onPress={() => cambia({ alcance: a.id })} texto={a.texto} />
          ))}
        </View>

        {form.alcance === "sector" && (
          <View style={s.bloque}>
            <Text style={s.etiqueta}>Sector</Text>
            <View style={s.chips}>
              {sectores.length === 0 && <Text style={s.nota}>Cargando sectores…</Text>}
              {sectores.map((x) => (
                <Chip key={x.id} activo={form.sectorId === x.id} onPress={() => cambia({ sectorId: x.id })} texto={x.nombre} />
              ))}
            </View>
            <Text style={s.nota}>Le llega a cada cliente con al menos un punto de recolección en ese sector.</Text>
          </View>
        )}

        {form.alcance === "ruta" && (
          <View style={s.bloque}>
            <Text style={s.etiqueta}>Ruta</Text>
            <View style={s.chips}>
              {rutasVisibles.length === 0 && <Text style={s.nota}>Cargando rutas…</Text>}
              {rutasVisibles.map((r) => (
                <Chip
                  key={r.id}
                  activo={form.rutaId === r.id}
                  onPress={() => cambia({ rutaId: r.id })}
                  texto={`${r.nombre}${r.activa === false ? " · inactiva" : ""}`}
                />
              ))}
            </View>
            <Text style={s.nota}>Le llega a cada cliente con un servicio activo en esa ruta.</Text>
          </View>
        )}

        {/* Clientes específicos (apps al 100%, como la web): la lista para
            marcar, con buscador, "Marcar todos" (o los que se ven) y "Quitar
            todos". Con uno solo se guarda como "un cliente". */}
        {form.alcance === "clientes" && (
          <View style={s.bloque}>
            <Text style={s.etiqueta}>Clientes · {textoMarcados(form.clienteIds.length)}</Text>
            {form.clienteIds.length > 0 && (
              <View style={[s.chips, { marginBottom: 8 }]}>
                {form.clienteIds.map((id) => (
                  <Pressable key={id} onPress={() => cambia({ clienteIds: alternarId(form.clienteIds, id) })} style={s.marcado} accessibilityRole="button" accessibilityLabel={`Quitar a ${nombreDe(id)}`}>
                    <Text style={s.marcadoTxt} numberOfLines={1}>{nombreDe(id)}</Text>
                    <Feather name="x" size={13} color={T.tinta} />
                  </Pressable>
                ))}
              </View>
            )}
            <View style={s.buscador}>
              <Feather name="search" size={16} color={T.gris} />
              <TextInput
                value={busqueda}
                onChangeText={setBusqueda}
                placeholder="Busca por empresa, folio o correo"
                placeholderTextColor={T.grisClaro}
                style={s.buscadorInput}
                autoCorrect={false}
                accessibilityLabel="Buscar cliente"
              />
            </View>
            <View style={[s.chips, { marginTop: 8 }]}>
              <Chip
                activo={false}
                onPress={() => cambia({ clienteIds: marcarVisibles(form.clienteIds, coincidencias) })}
                texto={`Marcar ${busqueda.trim() ? "los que se ven" : "todos"} (${coincidencias.length})`}
              />
              {form.clienteIds.length > 0 && <Chip activo={false} onPress={() => cambia({ clienteIds: [] })} texto="Quitar todos" />}
            </View>
            <ScrollView style={[s.resultados, { maxHeight: 320 }]} nestedScrollEnabled keyboardShouldPersistTaps="handled">
              {clientes.length === 0 && <Text style={[s.nota, { padding: 12 }]}>Cargando clientes…</Text>}
              {clientes.length > 0 && coincidencias.length === 0 && <Text style={[s.nota, { padding: 12 }]}>Ningún cliente con «{busqueda.trim()}».</Text>}
              {coincidencias.map((c, i) => {
                const on = marcados.has(c.id);
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => cambia({ clienteIds: alternarId(form.clienteIds, c.id) })}
                    style={[s.resultado, s.casilla, i < coincidencias.length - 1 && s.borde, on && { backgroundColor: T.accionTinte }]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                  >
                    <Feather name={on ? "check-square" : "square"} size={19} color={on ? T.accionTxt : T.grisClaro} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.resultadoNom}>{c.empresa}</Text>
                      <Text style={s.nota}>{[c.folio, c.correo || "sin correo", c.estado && c.estado !== "activo" ? c.estado : null].filter(Boolean).join(" · ")}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ¿A cuántos les llega? — la cifra que frena un aviso equivocado. */}
        <View style={s.vista} accessibilityLiveRegion="polite">
          <Feather name="users" size={18} color={T.accionTxt} />
          <View style={{ flex: 1 }}>
            {form.alcance !== "todos" && !idDestino ? (
              <Text style={s.nota}>Elige {tituloDestino} para ver a cuántos les llega.</Text>
            ) : vista.cargando ? (
              <Text style={s.nota}>Calculando a quién le llega…</Text>
            ) : vista.resumen ? (
              <>
                <View style={s.cifras}>
                  <Cifra n={vista.resumen.clientes} t={vista.resumen.clientes === 1 ? "cliente" : "clientes"} />
                  <Cifra n={vista.resumen.correos} t={vista.resumen.correos === 1 ? "correo" : "correos"} />
                  <Cifra n={vista.resumen.sinCorreo} t="sin correo" alerta={vista.resumen.sinCorreo > 0} />
                </View>
                <Text style={s.nota}>{fraseResumen(vista.resumen)}</Text>
              </>
            ) : (
              <Text style={[s.nota, { color: T.error }]}>{vista.motivo || "No se pudo calcular a quién le llega."}</Text>
            )}
          </View>
        </View>

        <Text style={s.etiqueta}>Motivo</Text>
        <View style={s.chips}>
          {MOTIVOS_AVISO.map((m) => (
            <Chip key={m.id} activo={form.motivo === m.id} onPress={() => cambia({ motivo: m.id })} texto={m.texto} />
          ))}
        </View>

        <Text style={s.etiqueta}>Título</Text>
        <TextInput
          value={form.titulo}
          onChangeText={(t) => cambia({ titulo: t })}
          maxLength={MAX_TITULO}
          placeholder="Ej. Retraso en la Ruta Norte"
          placeholderTextColor={T.grisClaro}
          style={s.input}
          accessibilityLabel="Título del aviso"
        />

        <Text style={s.etiqueta}>Mensaje</Text>
        <TextInput
          value={form.mensaje}
          onChangeText={(t) => cambia({ mensaje: t })}
          maxLength={MAX_MENSAJE}
          multiline
          placeholder="Qué pasa, a quién le afecta y qué tiene que hacer el cliente (si algo)."
          placeholderTextColor={T.grisClaro}
          style={[s.input, { minHeight: 110, textAlignVertical: "top" }]}
          accessibilityLabel="Mensaje del aviso"
        />
        <Text style={s.contador}>{form.mensaje.length} / {MAX_MENSAJE}</Text>

        <Text style={s.etiqueta}>Vigente hasta <Text style={{ fontWeight: "400", color: T.gris }}>(opcional)</Text></Text>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <Pressable onPress={() => setCalendario(true)} style={[s.input, s.fechaBoton]} accessibilityRole="button" accessibilityLabel={form.vigenteHasta ? `Vigente hasta ${fechaCorta(form.vigenteHasta)}. Toca para cambiar` : "Elegir fecha de vigencia"}>
            <Feather name="calendar" size={16} color={T.accionTxt} />
            <Text style={{ color: form.vigenteHasta ? T.tinta : T.grisClaro, fontSize: 14.5 }}>{form.vigenteHasta ? fechaCorta(form.vigenteHasta) : "Sin fecha"}</Text>
          </Pressable>
          {!!form.vigenteHasta && (
            <Pressable onPress={() => cambia({ vigenteHasta: "" })} style={s.icoBoton} accessibilityRole="button" accessibilityLabel="Quitar la fecha">
              <Feather name="x" size={20} color={T.gris} />
            </Pressable>
          )}
        </View>
        <Text style={s.nota}>Después de esa fecha deja de verse en el portal. Sin fecha, se ve 30 días.</Text>

        {!!error && (
          <View style={s.errorCaja} accessibilityRole="alert">
            <Feather name="alert-circle" size={15} color={T.error} />
            <Text style={s.errorTxt}>{error}</Text>
          </View>
        )}

        {confirmando ? (
          <View style={s.confirma}>
            <Text style={s.confirmaTxt}>
              Vas a mandar <Text style={{ fontWeight: "800" }}>«{form.titulo.trim()}»</Text>.{" "}
              {vista.resumen ? fraseResumen(vista.resumen) : "Calculando a quién le llega…"} Un aviso mandado no se puede retirar.
            </Text>
            {enviando && (
              <View style={{ marginTop: 10 }} accessibilityLiveRegion="polite">
                <View style={s.barra}><View style={[s.barraLlena, { width: `${Math.round(avance * 100)}%` }]} /></View>
                <Text style={s.nota}>Mandando… {segundos} s de unos {estimado} s. No cierres la app.</Text>
              </View>
            )}
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              <Boton onPress={enviar} disabled={enviando} style={{ flex: 1 }}>
                {enviando ? "Mandando…" : "Sí, mandar"}
              </Boton>
              <Boton variante="linea" onPress={() => setConfirmando(false)} disabled={enviando} style={{ flex: 1 }}>Corregir</Boton>
            </View>
          </View>
        ) : (
          <Boton onPress={revisar} style={{ marginTop: 14 }}>Revisar y mandar</Boton>
        )}

        {resultado && <Resultado r={resultado} />}
      </Tarjeta>

      <Tarjeta>
        <TituloTarjeta>Así lo verá el cliente</TituloTarjeta>
        <VistaPrevia aviso={form} />
      </Tarjeta>

      <Tarjeta>
        <TituloTarjeta>Avisos enviados</TituloTarjeta>
        {historial === null ? (
          <ActivityIndicator color={T.gris} style={{ marginVertical: 14 }} />
        ) : falloHist ? (
          <Text style={s.vacio}>No se pudo leer el historial. Jala hacia abajo para reintentar.</Text>
        ) : historial.length === 0 ? (
          <Text style={s.vacio}>Todavía no se ha mandado ningún aviso.</Text>
        ) : (
          historial.map((a, i) => <FilaAviso key={a.id} a={a} ultimo={i === historial.length - 1} />)
        )}
      </Tarjeta>

      <CalendarioDia
        visible={calendario}
        valor={form.vigenteHasta || hoy}
        min={hoy}
        titulo="Vigente hasta…"
        onCerrar={() => setCalendario(false)}
        onElegir={(f) => { setCalendario(false); cambia({ vigenteHasta: f }); }}
      />
    </ScrollView>
  );
}

function Chip({ activo, onPress, texto }) {
  return (
    <Pressable
      onPress={onPress}
      style={[s.chip, activo && s.chipOn]}
      accessibilityRole="button"
      accessibilityState={{ selected: activo }}
    >
      <Text style={[s.chipTxt, activo && { color: "#fff" }]}>{texto}</Text>
    </Pressable>
  );
}

function Cifra({ n, t, alerta }) {
  return (
    <View style={{ marginRight: 18 }}>
      <Text style={[s.cifra, alerta && { color: T.alerta }]}>{n}</Text>
      <Text style={s.cifraTxt}>{t}</Text>
    </View>
  );
}

/** Retraso en ámbar, reagenda en azul, general neutro (como la web). */
function InsigniaMotivo({ motivo }) {
  const color = motivo === "retraso" ? T.alerta : motivo === "reagenda" ? T.accionTxt : T.gris;
  return (
    <View style={[s.insignia, { borderColor: color }]}>
      <Text style={[s.insigniaTxt, { color }]}>{textoMotivo(motivo)}</Text>
    </View>
  );
}

/** La tarjeta como le llega al cliente, con lo que va escrito. */
function VistaPrevia({ aviso }) {
  const titulo = aviso.titulo.trim() || "Título del aviso";
  const mensaje = aviso.mensaje.trim() || "Aquí va el mensaje para los clientes.";
  return (
    <View style={s.previa}>
      <InsigniaMotivo motivo={aviso.motivo} />
      <Text style={s.previaTit}>{titulo}</Text>
      <Text style={s.previaMsg}>{mensaje}</Text>
      {!!aviso.vigenteHasta && <Text style={s.nota}>Vigente hasta {fechaCorta(aviso.vigenteHasta)}</Text>}
    </View>
  );
}

/** Qué pasó al mandar, en palabras: cuántos salieron y a quién hay que llamar. */
function Resultado({ r }) {
  const bien = r.yaEnviado || (!r.sinResend && !(r.fallidos || []).length);
  const color = bien ? T.ok : T.alerta;
  return (
    <View style={[s.resultadoCaja, { borderColor: color }]} accessibilityRole="alert">
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Feather name={bien ? "check-circle" : "alert-triangle"} size={16} color={color} />
        <Text style={[s.resultadoTit, { color }]}>{r.demo ? "Modo demostración: no se mandó nada" : r.yaEnviado ? "Ya se había mandado" : "Aviso mandado"}</Text>
      </View>
      {!r.demo && <Text style={s.resultadoTxt}>{textoResultado(r)}</Text>}
    </View>
  );
}

/**
 * Un aviso del historial. "Leído por X de Y" se toca para ver quién y
 * cuándo; la lista se pide al abrir (casi nunca se consulta).
 */
function FilaAviso({ a, ultimo }) {
  const [abierto, setAbierto] = useState(false);
  const [lectores, setLectores] = useState(null);
  const [fallo, setFallo] = useState(false);
  const frase = fraseLecturas({ leidos: a.leidos, usuariosDestino: a.usuarios_destino });
  const hayLecturas = (a.leidos ?? 0) > 0;

  const alternar = async () => {
    const abrir = !abierto;
    setAbierto(abrir);
    if (abrir && lectores === null) {
      const r = await lectoresDeAviso(a.id);
      setFallo(!r.ok);
      setLectores(r.lectores || []);
    }
  };

  return (
    <View style={[s.hist, !ultimo && s.borde]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <InsigniaMotivo motivo={a.motivo} />
        <Text style={s.nota}>{fechaHora(a.creado)} · {textoAlcance(a)}</Text>
      </View>
      <Text style={s.histTit}>{a.titulo}</Text>
      {!!a.vigente_hasta && <Text style={s.nota}>Vigente hasta {fechaCorta(a.vigente_hasta)}</Text>}
      <Text style={s.nota}>
        {a.correos_enviados ?? 0} {(a.correos_enviados ?? 0) === 1 ? "correo" : "correos"} · {textoNotificaciones(a.notificaciones_enviadas)}
        {a.perfiles?.nombre ? ` · ${a.perfiles.nombre}` : ""}
      </Text>
      {hayLecturas ? (
        <Pressable onPress={alternar} style={s.lecturas} accessibilityRole="button" accessibilityState={{ expanded: abierto }}>
          <Feather name="users" size={14} color={T.accionTxt} />
          <Text style={s.lecturasTxt}>{frase}</Text>
          <Feather name={abierto ? "chevron-up" : "chevron-down"} size={16} color={T.accionTxt} />
        </Pressable>
      ) : (
        <Text style={[s.nota, { marginTop: 6 }]}>{frase}</Text>
      )}
      {abierto && (
        <View style={s.lectores}>
          {lectores === null && <Text style={s.nota}>Cargando…</Text>}
          {fallo && <Text style={[s.nota, { color: T.error }]}>No se pudo leer quién lo vio. Inténtalo otra vez.</Text>}
          {lectores && !fallo && lectores.length === 0 && <Text style={s.nota}>Nadie lo ha marcado como leído todavía.</Text>}
          {(lectores || []).map((l) => (
            <View key={l.usuarioId} style={s.lector}>
              <View style={{ flex: 1 }}>
                <Text style={s.lectorNom}>{l.nombre}</Text>
                {!!l.empresa && <Text style={s.nota}>{l.empresa}</Text>}
              </View>
              <Text style={s.nota}>{fechaHora(l.leido)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  h1: { color: T.tinta, fontSize: 22, fontWeight: "800" },
  sub: { color: T.gris, fontSize: 13.5, marginTop: 3, marginBottom: 14, lineHeight: 19 },
  etiqueta: { color: T.tinta, fontSize: 13.5, fontWeight: "700", marginTop: 14, marginBottom: 7 },
  bloque: { marginTop: 2 },
  nota: { color: T.gris, fontSize: 12.5, lineHeight: 17, marginTop: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: T.linea, alignItems: "center", justifyContent: "center" },
  chipOn: { backgroundColor: T.accion, borderColor: T.accion },
  chipTxt: { color: T.gris, fontSize: 13.5, fontWeight: "600" },
  elegido: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: T.accion, borderRadius: 12, padding: 12 },
  elegidoNom: { color: T.tinta, fontSize: 14.5, fontWeight: "700" },
  icoBoton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  buscador: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: T.panel2, borderWidth: 1, borderColor: T.linea, borderRadius: 12, paddingHorizontal: 12, minHeight: 48 },
  buscadorInput: { flex: 1, color: T.tinta, fontSize: 15, paddingVertical: 10 },
  resultados: { borderWidth: 1, borderColor: T.linea, borderRadius: 12, marginTop: 6, overflow: "hidden" },
  resultado: { padding: 12, minHeight: 48 },
  resultadoNom: { color: T.tinta, fontSize: 14, fontWeight: "600" },
  casilla: { flexDirection: "row", alignItems: "center", gap: 10 },
  marcado: { flexDirection: "row", alignItems: "center", gap: 6, maxWidth: "100%", paddingHorizontal: 10, minHeight: 32, borderRadius: 16, backgroundColor: T.accionTinte, borderWidth: 1, borderColor: "rgba(42,106,153,0.55)" },
  marcadoTxt: { color: T.tinta, fontSize: 12.5, fontWeight: "600", flexShrink: 1 },
  borde: { borderBottomWidth: 1, borderBottomColor: T.linea },
  vista: { flexDirection: "row", gap: 10, backgroundColor: T.accionTinte, borderRadius: 12, padding: 12, marginTop: 14 },
  cifras: { flexDirection: "row", marginBottom: 2 },
  cifra: { color: T.tinta, fontSize: 20, fontWeight: "800" },
  cifraTxt: { color: T.gris, fontSize: 11.5 },
  input: { backgroundColor: T.panel2, borderWidth: 1, borderColor: T.linea, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, color: T.tinta, fontSize: 15, minHeight: 48 },
  contador: { color: T.grisClaro, fontSize: 11.5, textAlign: "right", marginTop: 4 },
  fechaBoton: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  errorCaja: { flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: "rgba(217,119,107,0.10)", borderWidth: 1, borderColor: "rgba(217,119,107,0.35)", borderRadius: 10, padding: 10, marginTop: 12 },
  errorTxt: { color: T.error, fontSize: 13, flex: 1, lineHeight: 18 },
  confirma: { borderWidth: 1, borderColor: T.accion, backgroundColor: T.accionTinte, borderRadius: 12, padding: 12, marginTop: 14 },
  confirmaTxt: { color: T.tinta, fontSize: 14, lineHeight: 20 },
  barra: { height: 8, borderRadius: 4, backgroundColor: T.panel2, overflow: "hidden" },
  barraLlena: { height: 8, borderRadius: 4, backgroundColor: T.accionTxt },
  resultadoCaja: { borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 14 },
  resultadoTit: { fontSize: 14, fontWeight: "800" },
  resultadoTxt: { color: T.tinta, fontSize: 13, lineHeight: 19, marginTop: 6 },
  insignia: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2, alignSelf: "flex-start" },
  insigniaTxt: { fontSize: 11.5, fontWeight: "700" },
  previa: { backgroundColor: T.panel2, borderWidth: 1, borderColor: T.linea, borderRadius: 12, padding: 12, gap: 4 },
  previaTit: { color: T.tinta, fontSize: 15, fontWeight: "800", marginTop: 6 },
  previaMsg: { color: T.tinta, fontSize: 13.5, lineHeight: 19 },
  vacio: { color: T.gris, textAlign: "center", paddingVertical: 14 },
  hist: { paddingVertical: 12 },
  histTit: { color: T.tinta, fontSize: 14.5, fontWeight: "700", marginTop: 6 },
  lecturas: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6, minHeight: 40 },
  lecturasTxt: { color: T.accionTxt, fontSize: 13.5, fontWeight: "600", textDecorationLine: "underline" },
  lectores: { backgroundColor: T.panel2, borderRadius: 10, padding: 10, marginTop: 4, gap: 6 },
  lector: { flexDirection: "row", alignItems: "center", gap: 8 },
  lectorNom: { color: T.tinta, fontSize: 13.5, fontWeight: "600" },
});
