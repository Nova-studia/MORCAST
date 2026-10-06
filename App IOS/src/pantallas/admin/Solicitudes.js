import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Modal, Linking } from "react-native";
import { Feather } from "@expo/vector-icons";
import { listarCotizaciones, cambiarEstadoCotizacion } from "../../datos-remoto";
import { T } from "../../tema";
import { Tarjeta, Badge, Boton } from "../../ui";
import { SOLICITUDES, ESTADOS_SOLICITUD, infoEstado, fechaLarga } from "../../datos-admin";
import { abrirWhatsApp } from "../../whatsapp";
// equipo 3: activar la cuenta del cliente aquí mismo (antes mandaba a la web).
import { activarCuentaCotizacion, existeCuenta, mensajeCredenciales, telefonoWhatsApp, pareceCorreo } from "../../datos-cuentas";
import { atenderSegundoPaso, Campo, Accion, Aviso } from "./piezas-cuentas";

export default function Solicitudes({ navigation }) {
  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(true);
  // La pestaña se monta una sola vez por sesión: si esa primera lectura
  // fallaba, la bandeja se quedaba en blanco hasta cerrar la app. `intento`
  // vuelve a pedirla desde el botón "Reintentar".
  const [errorCarga, setErrorCarga] = useState(false);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    setErrorCarga(false);
    listarCotizaciones()
      .then((l) => {
        if (!vivo) return;
        if (l === null) setErrorCarga(true);
        else setLista(l);
      })
      .catch(() => { if (vivo) setErrorCarga(true); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [intento]);
  const [filtro, setFiltro] = useState("todas");
  const [sel, setSel] = useState(null);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const filas = lista.filter((x) => filtro === "todas" || x.estado === filtro).sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
  const conteo = (id) => (id === "todas" ? lista.length : lista.filter((x) => x.estado === id).length);

  /**
   * Mover la solicitud por el embudo ESCRIBE en la base.
   *
   * Antes solo se repintaba el renglón: al salir de la pantalla y volver, la
   * solicitud seguía en el estado viejo porque nunca se guardó nada.
   */
  const cambiar = async (id, estado) => {
    if (guardando) return;
    setGuardando(true);
    setError("");

    const anterior = lista.find((x) => x.id === id)?.estado;
    setLista((l) => l.map((x) => (x.id === id ? { ...x, estado } : x)));
    setSel((x) => (x && x.id === id ? { ...x, estado } : x));

    const r = await cambiarEstadoCotizacion(id, estado);
    if (!r.ok) {
      // Se deshace lo que se pintó: mejor que quede como está de verdad.
      setLista((l) => l.map((x) => (x.id === id ? { ...x, estado: anterior } : x)));
      setSel((x) => (x && x.id === id ? { ...x, estado: anterior } : x));
      setError(r.motivo || "No se pudo guardar el cambio. Revisa tu señal.");
    }
    setGuardando(false);
  };

  const abrir = (url) => Linking.openURL(url).catch(() => {});

  /**
   * ACTIVAR LA CUENTA DEL CLIENTE de una solicitud ganada (6-oct-2026).
   *
   * Antes este bloque mandaba al panel de la página: crear una cuenta
   * necesita la llave de servicio, que no puede vivir en el teléfono. Ahora
   * lo hace el servidor (`/api/app/solicitudes/activar`) con el MISMO código
   * que el botón de la web: usuario, empresa, perfil, solicitud ganada y
   * bitácora (sin la contraseña).
   *
   * `activada` refleja que de verdad existe una cuenta con ese correo (se le
   * pregunta al servidor al abrir la ficha), no una casilla en memoria.
   * La contraseña se enseña una sola vez y no se guarda en ningún lado.
   */
  const [activaciones, setActivaciones] = useState({});
  const actDe = (x) => ({ correo: x.correo, password: "", activada: false, ...(activaciones[x.id] || {}) });
  const setAct = (id, patch) => setActivaciones((a) => ({ ...a, [id]: { ...(a[id] || {}), ...patch } }));

  useEffect(() => {
    let vivo = true;
    if (!sel || sel.estado !== "ganada" || activaciones[sel.id]?.activada || !sel.correo) return;
    existeCuenta(sel.correo).then((r) => {
      if (vivo && r.ok && r.existe) setAct(sel.id, { activada: true, yaExistia: true });
    });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel]);

  const activar = async (x) => {
    const a = actDe(x);
    if (!pareceCorreo(a.correo)) { setAct(x.id, { error: "El correo no es válido." }); return; }
    if (a.password && a.password.length < 8) { setAct(x.id, { error: "La contraseña debe tener al menos 8 caracteres." }); return; }
    setAct(x.id, { creando: true, error: "" });
    const r = await activarCuentaCotizacion({
      cotizacionId: x.id,
      empresa: x.empresa,
      contacto: x.contacto || x.nombre,
      telefono: x.telefono,
      correo: a.correo,
      // Vacía = la genera el servidor, legible por teléfono.
      password: a.password || undefined,
    });
    if (atenderSegundoPaso(r, navigation)) { setAct(x.id, { creando: false }); return; }
    if (!r.ok) { setAct(x.id, { creando: false, error: r.motivo || "No se pudo crear la cuenta." }); return; }
    setAct(x.id, { creando: false, error: "", activada: true, password: r.password || a.password, correo: r.correo || a.correo, folio: r.cliente?.folio });
    setLista((l) => l.map((y) => (y.id === x.id ? { ...y, estado: "ganada" } : y)));
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: T.fondo }}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      // Propiedad de iOS: deja que el sistema recorra el contenido cuando sale
      // el teclado. Viene apagada por omision y sin ella el campo de abajo se
      // queda tapado. En Android se ignora (alli lo resuelve el resize).
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
    >
      <Text style={s.h1}>Solicitudes</Text>
      <Text style={s.sub}>Las solicitudes del formulario del sitio. Dales seguimiento hasta cerrarlas.</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }} contentContainerStyle={{ gap: 8 }}>
        <Chip on={filtro === "todas"} onPress={() => setFiltro("todas")}>Todas ({conteo("todas")})</Chip>
        {ESTADOS_SOLICITUD.map((e) => (
          <Chip key={e.id} on={filtro === e.id} onPress={() => setFiltro(e.id)}>{e.texto} ({conteo(e.id)})</Chip>
        ))}
      </ScrollView>

      {/* Tres situaciones que antes se veían igual (en blanco): leyendo, no se
          pudo leer, o de verdad no hay ninguna. */}
      {cargando && <Text style={s.vacio}>Leyendo las solicitudes…</Text>}

      {!cargando && errorCarga && (
        <View style={[s.errorCaja, { marginTop: 0 }]}>
          <Feather name="alert-circle" size={14} color="#e07d7d" />
          <View style={{ flex: 1 }}>
            <Text style={s.errorLista}>No se pudieron leer las solicitudes. Revisa tu señal e intenta otra vez.</Text>
            <Boton variante="linea" onPress={() => setIntento((n) => n + 1)} style={{ marginTop: 10 }}>
              Reintentar
            </Boton>
          </View>
        </View>
      )}

      {!cargando && !errorCarga && filas.length === 0 && (
        <Text style={s.vacio}>
          {filtro === "todas"
            ? "Todavía no llega ninguna solicitud. Aquí aparecen las que dejan en el formulario de cotización del sitio."
            : "Sin solicitudes en este filtro."}
        </Text>
      )}

      {filas.map((x) => {
        const est = infoEstado(x.estado);
        return (
          <Pressable key={x.id} onPress={() => setSel(x)}>
            <Tarjeta style={{ padding: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.folio}>{x.folio || x.id} · {fechaLarga(x.fecha)}</Text>
                  <Text style={s.empresa}>{x.empresa}</Text>
                  <Text style={s.serv}>{x.servicio}</Text>
                </View>
                <Badge clase={est.clase}>{est.texto}</Badge>
              </View>
            </Tarjeta>
          </Pressable>
        );
      })}

      {/* Modal de detalle */}
      <Modal visible={!!sel} animationType="slide" transparent onRequestClose={() => setSel(null)}>
        <View style={s.modalFondo}>
          <View style={s.modal}>
            {sel && (
              <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 30 }} automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled">
                <View style={s.modalCab}>
                  <Text style={s.modalFolio}>{sel.folio || sel.id}</Text>
                  <Pressable onPress={() => setSel(null)} hitSlop={10}><Feather name="x" size={22} color={T.gris} /></Pressable>
                </View>
                <Text style={s.modalEmpresa}>{sel.empresa}</Text>
                {!!sel.nombre && <Text style={s.modalNombre}>{sel.nombre}</Text>}

                <View style={{ gap: 8, marginTop: 12 }}>
                  <Pressable style={s.contacto} onPress={() => abrir(`mailto:${sel.correo}`)}><Feather name="mail" size={15} color={T.tinta} /><Text style={s.contactoTxt}>{sel.correo}</Text></Pressable>
                  <Pressable style={s.contacto} onPress={() => abrir(`tel:+52${sel.telefono.replace(/\s/g, "")}`)}><Feather name="phone" size={15} color={T.tinta} /><Text style={s.contactoTxt}>{sel.telefono}</Text></Pressable>
                  <Pressable style={[s.contacto, { backgroundColor: T.verde, borderColor: T.verde }]} onPress={() => abrirWhatsApp(sel.telefono, `Hola${sel.nombre ? " " + sel.nombre : ""}, le escribimos de Morcast del Norte sobre su solicitud ${sel.folio || sel.id}.`)}>
                    <Feather name="message-square" size={15} color="#fff" /><Text style={[s.contactoTxt, { color: "#fff", fontWeight: "700" }]}>Contactar por WhatsApp</Text>
                  </Pressable>
                </View>

                <View style={s.mensaje}><Text style={s.mensajeLbl}>MENSAJE</Text><Text style={s.mensajeTxt}>{sel.mensaje}</Text></View>
                <View style={s.datos}>
                  <Text style={s.datoK}>Servicio: <Text style={s.datoV}>{sel.servicio}</Text></Text>
                  <Text style={s.datoK}>Frecuencia: <Text style={s.datoV}>{sel.frecuencia}</Text></Text>
                </View>

                <Text style={s.seccion}>Cambiar estado</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 6 }}>
                  {ESTADOS_SOLICITUD.map((e) => (
                    <Pressable key={e.id} onPress={() => cambiar(sel.id, e.id)} style={[s.estChip, sel.estado === e.id && s.estChipOn]}>
                      <Text style={[s.estChipTxt, sel.estado === e.id && { color: "#0d1211" }]}>{e.texto}</Text>
                    </Pressable>
                  ))}
                </View>

                {!!error && (
                  <View style={s.errorCaja}>
                    <Feather name="alert-circle" size={14} color="#e07d7d" />
                    <Text style={s.errorTxt}>{error}</Text>
                  </View>
                )}

                {sel.estado === "ganada" && (() => {
                  const a = actDe(sel);
                  const nombre = sel.nombre || sel.contacto || sel.empresa;
                  return (
                    <View style={s.activar}>
                      {a.activada ? (
                        <>
                          <View style={s.actTit}>
                            <Feather name="check-circle" size={16} color={T.verdeClaro} />
                            <Text style={s.actTitTxt}>Cuenta de cliente activada{a.folio ? ` — ${a.folio}` : ""}</Text>
                          </View>
                          {a.password ? (
                            <>
                              <Text style={s.actP}>Envíale estas credenciales para que entre al portal y a la app:</Text>
                              <Text style={s.cred} selectable>{a.correo}</Text>
                              <Text style={[s.cred, { fontSize: 17, letterSpacing: 1 }]} selectable>{a.password}</Text>
                              <Text style={s.actNota}>
                                Mándala antes de salir de esta pantalla: no se guarda en ningún lado y ya no se puede
                                volver a ver.
                              </Text>
                              <Accion
                                icono="message-square"
                                onPress={() => abrirWhatsApp(telefonoWhatsApp(sel.telefono), mensajeCredenciales(nombre, a.correo, a.password))}
                              >
                                Mandar por WhatsApp
                              </Accion>
                              <Accion
                                icono="mail"
                                variante="linea"
                                onPress={() => abrir(`mailto:${a.correo}?subject=${encodeURIComponent("Acceso a su Portal de Clientes — Morcast del Norte")}&body=${encodeURIComponent(mensajeCredenciales(nombre, a.correo, a.password))}`)}
                              >
                                Mandar por correo
                              </Accion>
                              <Accion variante="linea" onPress={() => setAct(sel.id, { password: "" })}>Ya la mandé</Accion>
                            </>
                          ) : (
                            // Ya existía una cuenta con ese correo (o ya se mandó): la
                            // contraseña no la sabe nadie aquí, y decir una sería mentir.
                            <Text style={s.actP}>
                              {a.yaExistia
                                ? `Ya existe una cuenta con ${a.correo}. No se creó otra. Si el cliente no puede entrar, que use "¿Olvidaste tu contraseña?" en vez de darlo de alta de nuevo.`
                                : `La cuenta de ${a.correo} quedó activa. La contraseña ya no se puede volver a ver.`}
                            </Text>
                          )}
                        </>
                      ) : (
                        <>
                          <View style={s.actTit}>
                            <Feather name="user-check" size={16} color={T.verdeClaro} />
                            <Text style={s.actTitTxt}>Activar cuenta de cliente</Text>
                          </View>
                          <Text style={s.actP}>Crea el acceso al portal y a la app para {sel.empresa}.</Text>
                          <Campo
                            etiqueta="Correo de acceso"
                            valor={a.correo}
                            onCambio={(v) => setAct(sel.id, { correo: v, error: "" })}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                          />
                          <Campo
                            etiqueta="Contraseña (opcional)"
                            valor={a.password}
                            onCambio={(v) => setAct(sel.id, { password: v, error: "" })}
                            autoCapitalize="none"
                            autoCorrect={false}
                            placeholder="Déjala vacía y se genera una"
                            ayuda="Si la dejas vacía, Morcast genera una fácil de dictar (sin l, 1, O ni 0)."
                          />
                          {!!a.error && <Aviso tipo="error">{a.error}</Aviso>}
                          <Accion icono="key" onPress={() => activar(sel)} disabled={!a.correo || a.creando}>
                            {a.creando ? "Creando la cuenta…" : "Activar cuenta de cliente"}
                          </Accion>
                          <Text style={s.actNota}>La empresa envía estas credenciales al cliente por WhatsApp o correo.</Text>
                        </>
                      )}
                    </View>
                  );
                })()}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function Chip({ on, onPress, children }) {
  return (
    <Pressable onPress={onPress} style={[cs.chip, on && cs.on]}><Text style={[cs.txt, on && cs.txtOn]}>{children}</Text></Pressable>
  );
}
const cs = StyleSheet.create({
  chip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: T.linea, backgroundColor: T.panel },
  on: { backgroundColor: T.naranja, borderColor: T.naranja },
  txt: { color: T.gris, fontSize: 12.5, fontWeight: "600" },
  txtOn: { color: "#0d1211" },
});

const s = StyleSheet.create({
  h1: { color: T.tinta, fontSize: 22, fontWeight: "800" },
  sub: { color: T.gris, fontSize: 13.5, marginTop: 3, marginBottom: 14, lineHeight: 19 },
  folio: { color: T.gris, fontSize: 11.5 },
  empresa: { color: T.tinta, fontSize: 15, fontWeight: "700", marginTop: 3 },
  serv: { color: T.gris, fontSize: 12.5, marginTop: 2 },
  vacio: { color: T.gris, fontSize: 13, lineHeight: 19, paddingVertical: 6 },
  errorLista: { color: "#e07d7d", fontSize: 12.5, lineHeight: 17 },
  modalFondo: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modal: { backgroundColor: T.fondo, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: "92%", borderWidth: 1, borderColor: T.linea },
  modalCab: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modalFolio: { color: T.gris, fontSize: 13, fontWeight: "700" },
  modalEmpresa: { color: T.tinta, fontSize: 19, fontWeight: "800", marginTop: 6 },
  modalNombre: { color: T.gris, fontSize: 13.5, marginTop: 2 },
  contacto: { flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: T.panel, borderWidth: 1, borderColor: T.linea, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 13 },
  contactoTxt: { color: T.tinta, fontSize: 13.5 },
  mensaje: { backgroundColor: T.panel, borderWidth: 1, borderColor: T.linea, borderRadius: 10, padding: 12, marginTop: 14 },
  mensajeLbl: { color: T.gris, fontSize: 10, letterSpacing: 0.05, marginBottom: 4 },
  mensajeTxt: { color: T.tinta, fontSize: 13.5, lineHeight: 19 },
  datos: { marginTop: 10, gap: 3 },
  datoK: { color: T.gris, fontSize: 13 },
  datoV: { color: T.tinta, fontWeight: "600" },
  seccion: { color: T.gris, fontSize: 11, letterSpacing: 0.05, marginTop: 16, textTransform: "uppercase" },
  estChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9, borderWidth: 1, borderColor: T.linea, backgroundColor: T.panel },
  estChipOn: { backgroundColor: T.verde, borderColor: T.verde },
  estChipTxt: { color: T.gris, fontSize: 12.5, fontWeight: "600" },
  errorCaja: { flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: "rgba(224,125,125,0.10)", borderWidth: 1, borderColor: "rgba(224,125,125,0.35)", borderRadius: 10, padding: 10, marginTop: 12 },
  errorTxt: { color: "#e07d7d", fontSize: 12.5, flex: 1, lineHeight: 17 },
  activar: { marginTop: 16, backgroundColor: "rgba(78,179,74,0.08)", borderWidth: 1, borderColor: "rgba(78,179,74,0.3)", borderRadius: 12, padding: 13 },
  actTit: { flexDirection: "row", alignItems: "center", gap: 7 },
  actTitTxt: { color: T.tinta, fontSize: 14.5, fontWeight: "700" },
  actP: { color: T.gris, fontSize: 12.5, marginTop: 5, marginBottom: 6, lineHeight: 18 },
  actNota: { color: T.grisClaro, fontSize: 11.5, marginTop: 8, lineHeight: 16 },
  cred: { color: T.tinta, fontSize: 15, fontWeight: "700", marginTop: 6 },
});
