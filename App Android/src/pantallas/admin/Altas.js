import { useState } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl, Linking, StyleSheet, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "../../tema";
import { Tarjeta, Badge } from "../../ui";
import { abrirWhatsApp } from "../../whatsapp";
import {
  listarAltas,
  cambiarEstadoAlta,
  activarAlta,
  archivosAlta,
  ESTADOS_ALTA,
  estadoDe,
  claseBadge,
  telefonoWhatsApp,
  mensajeCuentaActivadaApple, mensajeCuentaActivada,
} from "../../datos-cuentas";
import {
  useLista, atenderSegundoPaso, Chip, Chips, Hoja, Aviso, ErrorCarga, Dato, Seccion, Accion, estilosCuentas as e,
} from "./piezas-cuentas";

/**
 * ALTAS DE CLIENTES (6-oct-2026, paridad con /admin/altas).
 *
 * Quien llena "Cotización/Alta" en la página cae aquí, y también quien se
 * registra con Google. A esos últimos les sale "Activar cuenta": su acceso
 * ya existe, sólo falta ligarlo con su empresa (y con eso nace su punto de
 * recolección con el pin que puso). Todo lo que escribe va por la web
 * (`/api/app/altas/*`), con el mismo código del panel.
 */

const fecha = (iso) =>
  iso ? new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "";
const fechaHora = (iso) =>
  iso
    ? new Date(iso).toLocaleString("es-MX", {
        timeZone: "America/Matamoros", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : "";

export default function Altas({ navigation }) {
  const { lista: altas, setLista, cargando, refrescando, errorCarga, recargar } = useLista(listarAltas);
  const [filtro, setFiltro] = useState("nueva");
  const [sel, setSel] = useState(null);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState("");
  // La contraseña de UNA sola vez: va con el id de la solicitud a cuestas
  // para que no se pinte sobre la ficha de otra persona (mismo cuidado que
  // la web). "Ya la mandé" la borra; el siguiente paso (su ruta) se queda.
  const [credencial, setCredencial] = useState(null); // { solicitudId, correo, password, folio, telefono }
  const [siguiente, setSiguiente] = useState(null); // { solicitudId, puntoId }

  const google = altas.filter((a) => a.origen === "google").length;
  const nuevas = altas.filter((a) => a.estado === "nueva").length;
  const filas =
    filtro === "todas" ? altas
    : filtro === "google" ? altas.filter((a) => a.origen === "google")
    : altas.filter((a) => a.estado === filtro);

  const abrir = (a) => { setSel(a); setError(""); };
  const cerrar = () => { setSel(null); setError(""); };
  const reflejar = (id, cambios) => {
    setLista((l) => l.map((x) => (x.id === id ? { ...x, ...cambios } : x)));
    setSel((s) => (s && s.id === id ? { ...s, ...cambios } : s));
  };

  const marcar = async (a, estado) => {
    setError("");
    setOcupado(estado);
    const r = await cambiarEstadoAlta(a.id, estado);
    setOcupado("");
    if (atenderSegundoPaso(r, navigation)) return;
    if (!r.ok) { setError(r.motivo || "No se pudo guardar."); return; }
    reflejar(a.id, { estado });
  };

  const activar = async (a) => {
    setError("");
    setOcupado("activar");
    const r = await activarAlta(a.id);
    setOcupado("");
    if (atenderSegundoPaso(r, navigation)) return;
    if (!r.ok) { setError(r.motivo || "No se pudo activar."); return; }
    // Activó, pero su punto no se creó: se dice para que nadie confirme
    // recolecciones creyendo que traen dirección.
    if (r.avisoPunto) setError(r.avisoPunto);
    if (r.sinContrasena) {
      // Cuenta de Apple: activada SIN contraseña (Apple guía 4).
      setCredencial({ solicitudId: a.id, correo: r.correo, folio: r.cliente?.folio, telefono: a.telefono, sinContrasena: true });
    } else if (r.password) {
      setCredencial({ solicitudId: a.id, correo: r.correo, password: r.password, folio: r.cliente?.folio, telefono: a.telefono });
    }
    if (r.puntoId) setSiguiente({ solicitudId: a.id, puntoId: r.puntoId });
    reflejar(a.id, { estado: "aprobada" });
  };

  const descargar = async (a, cual) => {
    setError("");
    setOcupado(cual);
    const r = await archivosAlta(a.id);
    setOcupado("");
    if (atenderSegundoPaso(r, navigation)) return;
    if (r.demo) { setError("En la demostración no hay archivos guardados."); return; }
    const url = r.ok ? r[cual] : null;
    if (!url) { setError(r.motivo || "No se encontró el archivo de esa solicitud."); return; }
    Linking.openURL(url).catch(() => setError("No se pudo abrir el archivo en este teléfono."));
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: T.fondo }}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => recargar({ jalando: true })} tintColor={T.gris} />}
    >
      <Text style={e.h1}>Altas de clientes</Text>
      <Text style={e.sub}>
        Lo que llega de "Cotización/Alta" de la página y quienes se registran con Google. A esos últimos se
        les activa la cuenta desde aquí.
      </Text>

      <Chips>
        <Chip on={filtro === "nueva"} onPress={() => setFiltro("nueva")}>Sin atender ({nuevas})</Chip>
        {ESTADOS_ALTA.slice(1).map((s) => (
          <Chip key={s.id} on={filtro === s.id} onPress={() => setFiltro(s.id)}>{s.texto}</Chip>
        ))}
        <Chip on={filtro === "google"} onPress={() => setFiltro("google")}>Se registraron ({google})</Chip>
        <Chip on={filtro === "todas"} onPress={() => setFiltro("todas")}>Todas</Chip>
      </Chips>

      {cargando && <Text style={e.vacio}>Leyendo las altas…</Text>}
      {!cargando && errorCarga && <ErrorCarga que="las altas" onReintentar={() => recargar()} />}
      {!cargando && !errorCarga && filas.length === 0 && <Text style={e.vacio}>No hay altas en este estado.</Text>}

      {filas.map((a) => {
        const est = estadoDe(ESTADOS_ALTA, a.estado);
        return (
          <Pressable key={a.id} onPress={() => abrir(a)} accessibilityRole="button" accessibilityLabel={`${a.empresa}, ${est.texto}`}>
            <Tarjeta style={{ padding: 14 }}>
              <View style={e.fila}>
                <View style={{ flex: 1 }}>
                  <Text style={e.folio}>
                    {a.origen === "google" ? "Google · " : ""}{a.folio} · {fecha(a.creado)}
                  </Text>
                  <Text style={e.titulo}>{a.empresa}</Text>
                  <Text style={e.linea}>
                    {a.enCobertura ? "En cobertura" : "Fuera de cobertura"}
                    {a.firmada ? (a.correoConfirmado ? " · Firmada" : " · Firmada, correo por confirmar") : " · Sin firma"}
                  </Text>
                </View>
                <Badge clase={claseBadge(est.clase)}>{est.texto}</Badge>
              </View>
            </Tarjeta>
          </Pressable>
        );
      })}

      <Hoja visible={!!sel} onClose={cerrar} titulo={sel ? `${sel.folio} · ${fecha(sel.creado)}` : ""}>
        {sel && (
          <>
            <Text style={e.hojaTitulo}>{sel.empresa}</Text>
            <Text style={e.hojaSub}>
              {sel.origen === "google" ? "Se registró con Google" : "Llenó el alta en la página"}
            </Text>

            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {!!sel.telefono && (
                <Contacto icono="phone" texto="Llamar" onPress={() => Linking.openURL(`tel:${sel.telefono}`).catch(() => {})} />
              )}
              {!!sel.correo && (
                <Contacto icono="mail" texto="Correo" onPress={() => Linking.openURL(`mailto:${sel.correo}?subject=${encodeURIComponent(`Tu alta en Morcast (${sel.folio})`)}`).catch(() => {})} />
              )}
              {!!sel.telefono && (
                <Contacto icono="message-square" texto="WhatsApp" onPress={() => abrirWhatsApp(telefonoWhatsApp(sel.telefono), "")} />
              )}
            </View>

            {!!error && <Aviso tipo="error">{error}</Aviso>}

            {/* La contraseña sólo sobre la ficha de ESTA persona. */}
            {credencial && credencial.solicitudId === sel.id && credencial.sinContrasena && (
              <View style={st.cred}>
                <Text style={st.credTit}>Cuenta activada{credencial.folio ? ` — cliente ${credencial.folio}` : ""}</Text>
                <Text style={st.credP}>
                  <Text style={{ fontWeight: "800" }}>Entra con Apple: no necesita contraseña.</Text> Avísale que abra la
                  app y toque “Ya me activaron — revisar”.
                </Text>
                <Accion
                  icono="message-square"
                  onPress={() => abrirWhatsApp(telefonoWhatsApp(credencial.telefono), mensajeCuentaActivadaApple())}
                >
                  Mandar por WhatsApp
                </Accion>
                <Accion variante="linea" onPress={() => setCredencial(null)}>Listo</Accion>
              </View>
            )}
            {credencial && credencial.solicitudId === sel.id && !credencial.sinContrasena && (
              <View style={st.cred}>
                <Text style={st.credTit}>Cuenta activada{credencial.folio ? ` — cliente ${credencial.folio}` : ""}</Text>
                <Text style={st.credP}>
                  Esta contraseña se enseña <Text style={{ fontWeight: "800" }}>una sola vez</Text> y no se guarda en
                  ningún lado. Mándasela ahora; le sirve para entrar desde la app (en la página puede entrar con su Google).
                </Text>
                <Text style={st.credDato} selectable>{credencial.correo}</Text>
                <Text style={[st.credDato, { fontSize: 18, letterSpacing: 1 }]} selectable>{credencial.password}</Text>
                <Accion
                  icono="message-square"
                  onPress={() => abrirWhatsApp(telefonoWhatsApp(credencial.telefono), mensajeCuentaActivada(credencial.correo, credencial.password))}
                >
                  Mandar por WhatsApp
                </Accion>
                <Accion variante="linea" onPress={() => setCredencial(null)}>Ya la mandé</Accion>
              </View>
            )}

            {siguiente && siguiente.solicitudId === sel.id && (
              <View style={st.siguiente}>
                <Text style={st.credTit}>Siguiente paso: su ruta</Text>
                <Text style={st.credP}>
                  Ya tiene su punto de recolección con el pin que puso. Revisa el pin y asígnale la ruta que pasa por
                  ahí para que pueda pedir en sus días.
                </Text>
                <Accion
                  icono="map-pin"
                  variante="naranja"
                  onPress={() => { const puntoId = siguiente.puntoId; cerrar(); navigation.navigate("Puntos", { puntoId }); }}
                >
                  Revisar pin y asignarle su ruta
                </Accion>
              </View>
            )}

            <Seccion>Firma</Seccion>
            {sel.firmada ? (
              <>
                <Text style={st.firma}>
                  Firmó <Text style={{ color: T.tinta, fontWeight: "700" }}>{sel.firmanteNombre}</Text>
                  {sel.firmanteCargo ? ` (${sel.firmanteCargo})` : ""} el {fechaHora(sel.firmadoEn)}, desde la IP{" "}
                  {sel.firmaIp || "—"}. Términos {sel.terminosVersion}.{" "}
                  {sel.correoConfirmado
                    ? sel.correoConfirmadoPor === "google"
                      ? "Correo verificado por Google."
                      : `Correo confirmado el ${fechaHora(sel.correoConfirmadoEn)}.`
                    : "Correo aún sin confirmar (se le mandó el enlace)."}
                </Text>
                {sel.tienePdf && (
                  <Accion icono="file-text" variante="linea" disabled={!!ocupado} onPress={() => descargar(sel, "pdf")}>
                    {ocupado === "pdf" ? "Abriendo…" : "Ver PDF firmado"}
                  </Accion>
                )}
                {sel.tieneConstancia && (
                  <Accion icono="file" variante="linea" disabled={!!ocupado} onPress={() => descargar(sel, "constancia")}>
                    {ocupado === "constancia" ? "Abriendo…" : "Constancia fiscal"}
                  </Accion>
                )}
                {!!sel.contenidoHuella && <Text style={st.huella} selectable>Huella de lo firmado: {sel.contenidoHuella}</Text>}
              </>
            ) : (
              <Text style={st.firma}>Sin firma (llegó antes de la firma electrónica).</Text>
            )}

            <Seccion>Datos</Seccion>
            <Dato etiqueta="Contacto" valor={[sel.contacto, sel.telefono].filter(Boolean).join(" · ")} />
            <Dato etiqueta="Correo" valor={sel.correo} />
            <Dato etiqueta="Representante legal" valor={[sel.representanteNombre, sel.representanteCargo].filter(Boolean).join(" · ")} />
            <Dato etiqueta="Contacto de facturación" valor={[sel.facturacionNombre, sel.facturacionCorreo, sel.facturacionTelefono].filter(Boolean).join(" · ")} />
            <Dato etiqueta="Domicilio" valor={[sel.calle, sel.colonia, sel.cp].filter(Boolean).join(", ")} />
            <Dato etiqueta="Referencias" valor={sel.referencias} />
            <Dato etiqueta="Horario de acceso" valor={sel.horarioAcceso} />
            <Dato etiqueta="Residuos" valor={(sel.residuos || []).join(", ")} />
            <Dato etiqueta="Equipo pedido" valor={(sel.equipo || []).map((q) => `${q.cantidad} × ${q.tipo} ${q.medida}`).join(", ")} />
            <Dato
              etiqueta="Recolecciones al mes"
              valor={sel.serviciosPorMes ?? (sel.origen === "google" ? "No lo preguntamos en el registro" : null)}
            />
            <Dato etiqueta="Razón social" valor={sel.razonSocial} />
            <Dato etiqueta="RFC" valor={sel.rfc} />
            <Dato etiqueta="Domicilio fiscal" valor={sel.domicilioFiscal} />
            <Dato etiqueta="Uso de CFDI" valor={sel.usoCFDI} />
            <Dato etiqueta="Forma de pago" valor={sel.formaPago} />
            <Dato
              etiqueta="Cobertura"
              valor={sel.enCobertura ? `Sí — ${(sel.rutasQueCubren || []).join(", ") || "en ruta"}` : "No, queda fuera de las rutas de hoy"}
            />
            {sel.lat != null && sel.lng != null && (
              <Accion
                icono="map-pin"
                variante="linea"
                onPress={() => Linking.openURL(`https://www.google.com/maps?q=${sel.lat},${sel.lng}`).catch(() => {})}
              >
                Ver el punto en el mapa
              </Accion>
            )}

            <Seccion>Qué sigue</Seccion>
            {/* Para quien se registró con Google, "Activar cuenta" ES el gesto
                de aprobar: se pinta sin mirar el estado (el servidor rechaza
                la segunda activación) y "Aprobar" se esconde, porque sólo
                cambia el estado y dejaba a esa persona sin salida. */}
            {sel.origen === "google" && (
              <Accion icono="user-check" disabled={!!ocupado} onPress={() => activar(sel)}>
                {ocupado === "activar" ? "Activando…" : "Activar cuenta"}
              </Accion>
            )}
            {sel.origen !== "google" && sel.estado !== "aprobada" && (
              <Accion icono="check" disabled={!!ocupado} onPress={() => marcar(sel, "aprobada")}>
                {ocupado === "aprobada" ? "Guardando…" : "Aprobar"}
              </Accion>
            )}
            {sel.estado !== "contactada" && (
              <Accion variante="linea" disabled={!!ocupado} onPress={() => marcar(sel, "contactada")}>
                {ocupado === "contactada" ? "Guardando…" : "Marcar contactada"}
              </Accion>
            )}
            {sel.estado !== "rechazada" && (
              <Accion icono="x" variante="linea" disabled={!!ocupado} onPress={() => marcar(sel, "rechazada")}>
                {ocupado === "rechazada" ? "Guardando…" : "Rechazar"}
              </Accion>
            )}
          </>
        )}
      </Hoja>
    </ScrollView>
  );
}

function Contacto({ icono, texto, onPress }) {
  return (
    <Pressable onPress={onPress} style={st.contacto} accessibilityRole="button" accessibilityLabel={texto}>
      <Feather name={icono} size={15} color={T.tinta} />
      <Text style={st.contactoTxt}>{texto}</Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  contacto: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: T.panel, borderWidth: 1, borderColor: T.linea, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 14, minHeight: 44 },
  contactoTxt: { color: T.tinta, fontSize: 13.5, fontWeight: "600" },
  cred: { marginTop: 14, backgroundColor: "rgba(111,168,103,0.08)", borderWidth: 1, borderColor: "rgba(111,168,103,0.35)", borderRadius: 12, padding: 13 },
  siguiente: { marginTop: 14, backgroundColor: T.accionTinte, borderWidth: 1, borderColor: "rgba(42,106,153,0.45)", borderRadius: 12, padding: 13 },
  credTit: { color: T.tinta, fontSize: 14.5, fontWeight: "800" },
  credP: { color: T.gris, fontSize: 12.5, marginTop: 5, lineHeight: 18 },
  credDato: { color: T.tinta, fontSize: 15, fontWeight: "700", marginTop: 8, fontFamily: Platform.select({ ios: "Courier", default: "monospace" }) },
  firma: { color: T.gris, fontSize: 12.5, lineHeight: 18 },
  huella: { color: T.grisClaro, fontSize: 11, marginTop: 10, lineHeight: 15 },
});
