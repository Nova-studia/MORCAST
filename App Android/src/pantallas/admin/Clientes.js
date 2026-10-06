import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, RefreshControl, Alert, Linking } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "../../tema";
import { Tarjeta, Badge } from "../../ui";
import { pesos } from "../../datos-admin";
import { enHold } from "../../estado-sistema";
import {
  listarClientesAdmin,
  listarSectores,
  crearCliente,
  darAccesoCliente,
  puedeRecibirAcceso,
  MOTIVO_ACCESO,
  loQueFalta,
  filtrarClientesPorSector,
  PLANES_CLIENTE,
  pareceCorreo,
} from "../../datos-cuentas";
import {
  useLista, atenderSegundoPaso, Chip, Chips, Hoja, Aviso, ErrorCarga, Campo, Dato, Seccion, Accion, estilosCuentas as e,
} from "./piezas-cuentas";

/**
 * COMO SE LLAMA CADA ESTADO DE CLIENTE.
 *
 * 🔴 Antes esto era `estatus === "activo" ? "Activo" : "Moroso"`, o sea que
 * TODO lo que no fuera activo salia acusado de moroso. `pendiente-info` NO es
 * una falta de pago: le falta un correo, un teléfono o el contacto (la regla
 * vive en `Web/lib/estado-cliente.mjs`).
 */
const ESTADO = {
  activo: { texto: "Activo", clase: "ok" },
  "pendiente-info": { texto: "Pendiente", clase: "ruta" },
  suspendido: { texto: "Suspendido", clase: "mal" },
  baja: { texto: "Baja", clase: "none" },
};

const VACIO = { empresa: "", contacto: "", correo: "", telefono: "", plan: "Por evento" };

/**
 * CLIENTES (6-oct-2026, paridad con /admin/clientes): la lista con su sector,
 * "Nuevo cliente" (sólo el expediente) y "Dar acceso" al portal (el servidor
 * le manda al cliente un correo para escoger su contraseña). Antes era de
 * sólo lectura: el alta del teléfono nunca escribía en la base.
 */
export default function Clientes({ navigation }) {
  const { lista, setLista, cargando, refrescando, errorCarga, recargar } = useLista(listarClientesAdmin);
  const [sectores, setSectores] = useState([]);
  const [filtroSector, setFiltroSector] = useState("");
  const [sel, setSel] = useState(null);
  const [alta, setAlta] = useState(false);
  const [form, setForm] = useState(VACIO);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState(null); // { tipo, texto } en la ficha

  useEffect(() => {
    let vivo = true;
    listarSectores().then((s) => { if (vivo) setSectores(s); });
    return () => { vivo = false; };
  }, []);

  const visibles = filtrarClientesPorSector(lista, filtroSector);
  const activos = lista.filter((c) => c.estatus === "activo").length;
  const pendientes = lista.filter((c) => c.estatus === "pendiente-info").length;

  const crear = async () => {
    setError("");
    if (!form.empresa.trim()) { setError("Escribe el nombre de la empresa."); return; }
    if (form.correo.trim() && !pareceCorreo(form.correo)) { setError("Ese correo no parece válido."); return; }
    setGuardando(true);
    const r = await crearCliente(form);
    setGuardando(false);
    if (atenderSegundoPaso(r, navigation)) return;
    if (!r.ok) { setError(r.motivo || "No se pudo dar de alta. Vuelve a intentarlo."); return; }
    if (r.cliente) setLista((l) => [r.cliente, ...l]);
    else recargar();
    setForm(VACIO);
    setAlta(false);
  };

  const darAcceso = (c) => {
    // Es un correo real a un cliente real: se confirma antes de mandarlo.
    Alert.alert(
      "Dar acceso al portal",
      `¿Enviar el acceso al portal a ${c.empresa} (${c.correo})? Le llega un correo para escoger su contraseña.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Enviar",
          onPress: async () => {
            setAviso(null);
            setEnviando(true);
            const r = await darAccesoCliente(c.uuid);
            setEnviando(false);
            if (atenderSegundoPaso(r, navigation)) return;
            if (!r.ok) { setAviso({ tipo: "error", texto: r.motivo || "No se pudo dar el acceso." }); return; }
            setLista((l) => l.map((x) => (x.uuid === c.uuid ? { ...x, tieneAcceso: true } : x)));
            setSel((x) => (x && x.uuid === c.uuid ? { ...x, tieneAcceso: true } : x));
            setAviso({ tipo: "ok", texto: `Listo: a ${r.correo || c.correo} le llegó el correo para escoger su contraseña.` });
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: T.fondo }}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      // Propiedad de iOS: deja que el sistema recorra el contenido cuando sale
      // el teclado. En Android se ignora (allí lo resuelve el resize).
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => recargar({ jalando: true })} tintColor={T.gris} />}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={e.h1}>Clientes</Text>
          <Text style={[e.sub, { marginBottom: 0 }]}>
            {lista.length} clientes · {activos} activos{pendientes > 0 ? ` · ${pendientes} pendientes por información` : ""}
          </Text>
        </View>
        <Pressable
          onPress={() => { setAlta((v) => !v); setError(""); }}
          style={s.btnAlta}
          accessibilityRole="button"
          accessibilityLabel={alta ? "Cerrar el alta" : "Nuevo cliente"}
        >
          <Feather name={alta ? "x" : "user-plus"} size={16} color="#fff" />
          <Text style={s.btnAltaTxt}>{alta ? "Cerrar" : "Nuevo"}</Text>
        </Pressable>
      </View>

      {alta && (
        <Tarjeta style={{ marginTop: 14 }}>
          <Text style={s.altaTit}>Nuevo cliente</Text>
          <Text style={s.altaNota}>
            Sólo da de alta la empresa. El acceso al portal se manda después con "Dar acceso", para que el cliente
            escoja su contraseña.
          </Text>
          <Campo etiqueta="Empresa / razón social" valor={form.empresa} onCambio={(v) => setForm({ ...form, empresa: v })} />
          <Campo etiqueta="Contacto" valor={form.contacto} onCambio={(v) => setForm({ ...form, contacto: v })} />
          <Campo
            etiqueta="Correo"
            valor={form.correo}
            onCambio={(v) => setForm({ ...form, correo: v })}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Campo etiqueta="Teléfono" valor={form.telefono} onCambio={(v) => setForm({ ...form, telefono: v })} keyboardType="phone-pad" />
          <Text style={[s.altaTit, { fontSize: 12.5, marginTop: 12 }]}>Plan</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
            {PLANES_CLIENTE.map((p) => (
              <Chip key={p} on={form.plan === p} onPress={() => setForm({ ...form, plan: p })}>{p}</Chip>
            ))}
          </View>
          {!!error && <Aviso tipo="error">{error}</Aviso>}
          <Accion icono="save" onPress={crear} disabled={guardando || !form.empresa.trim()} style={{ marginTop: 14 }}>
            {guardando ? "Guardando…" : "Guardar cliente"}
          </Accion>
        </Tarjeta>
      )}

      <Text style={s.filtroTit}>Sector</Text>
      <Chips>
        <Chip on={filtroSector === ""} onPress={() => setFiltroSector("")}>Todos</Chip>
        {sectores.map((x) => (
          <Chip key={x.id} on={filtroSector === x.clave} onPress={() => setFiltroSector(x.clave)}>{x.nombre}</Chip>
        ))}
        <Chip on={filtroSector === "ninguno"} onPress={() => setFiltroSector("ninguno")}>Sin sector</Chip>
      </Chips>
      {!!filtroSector && <Text style={[e.vacio, { paddingTop: 0 }]}>{visibles.length} de {lista.length} clientes</Text>}

      {cargando && <Text style={e.vacio}>Leyendo los clientes…</Text>}
      {!cargando && errorCarga && <ErrorCarga que="los clientes" onReintentar={() => recargar()} />}
      {!cargando && !errorCarga && filtroSector && visibles.length === 0 && (
        <Text style={e.vacio}>
          {filtroSector === "ninguno"
            ? "Todos los clientes tienen sector."
            : "Ningún cliente tiene puntos en ese sector. Si los sectores no tienen límites todavía, se dibujan en la página (Rutas, sectores y puntos → Sectores)."}
        </Text>
      )}

      {visibles.map((c) => {
        const est = ESTADO[c.estatus] || { texto: c.estatus || "Sin estado", clase: "none" };
        return (
          <Pressable key={c.uuid || c.id} onPress={() => { setSel(c); setAviso(null); }} accessibilityRole="button" accessibilityLabel={`${c.empresa}, ${est.texto}`}>
            <Tarjeta style={{ padding: 14 }}>
              <View style={e.fila}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <Text style={e.folio}>{c.id}</Text>
                    {(c.sectores || []).map((x) => <InsigniaSector key={x.clave} sector={x} />)}
                  </View>
                  <Text style={e.titulo}>{c.empresa}</Text>
                  <Text style={e.linea} numberOfLines={1}>{[c.contacto, c.plan].filter(Boolean).join(" · ")}</Text>
                  {!enHold() && (
                    <Text style={s.saldos}>Saldo {pesos(c.saldo)} · Por pagar {c.porPagar ? pesos(c.porPagar) : "—"}</Text>
                  )}
                </View>
                <View style={{ alignItems: "flex-end", gap: 6 }}>
                  <Badge clase={est.clase}>{est.texto}</Badge>
                  {c.tieneAcceso && <Text style={s.conAcceso}>Con acceso</Text>}
                </View>
              </View>
            </Tarjeta>
          </Pressable>
        );
      })}

      <Hoja visible={!!sel} onClose={() => setSel(null)} titulo={sel ? sel.id : ""}>
        {sel && (() => {
          const evaluado = puedeRecibirAcceso(sel);
          const falta = loQueFalta(sel);
          const est = ESTADO[sel.estatus] || { texto: sel.estatus || "Sin estado", clase: "none" };
          return (
            <>
              <Text style={e.hojaTitulo}>{sel.empresa}</Text>
              <View style={{ flexDirection: "row", gap: 6, alignItems: "center", marginTop: 6, marginBottom: 12, flexWrap: "wrap" }}>
                <Badge clase={est.clase}>{sel.estatus === "pendiente-info" ? "Pendiente por información" : est.texto}</Badge>
                {(sel.sectores || []).map((x) => <InsigniaSector key={x.clave} sector={x} grande />)}
              </View>
              {falta.length > 0 && <Aviso tipo="alerta" style={{ marginTop: 0, marginBottom: 10 }}>Falta: {falta.join(", ")}.</Aviso>}
              <Dato etiqueta="Contacto" valor={sel.contacto} />
              <Dato etiqueta="Correo" valor={sel.correo} />
              <Dato etiqueta="Teléfono" valor={sel.telefono} />
              <Dato etiqueta="Plan" valor={sel.plan} />
              <Dato etiqueta="Cliente desde" valor={sel.desde} />
              {!!sel.telefono && (
                <Accion icono="phone" variante="linea" onPress={() => Linking.openURL(`tel:${sel.telefono}`).catch(() => {})}>
                  Llamar
                </Accion>
              )}

              <Seccion>Acceso al portal</Seccion>
              {sel.tieneAcceso ? (
                <Aviso tipo="ok" style={{ marginTop: 0 }}>Ya tiene acceso al portal y a la app.</Aviso>
              ) : (
                <>
                  <Accion
                    icono="key"
                    onPress={() => darAcceso(sel)}
                    disabled={!evaluado.puede || enviando}
                  >
                    {enviando ? "Enviando…" : evaluado.puede ? "Dar acceso" : MOTIVO_ACCESO[evaluado.motivo]}
                  </Accion>
                  {!evaluado.puede && evaluado.motivo === "sin-correo" && (
                    <Text style={s.nota}>Este cliente no tiene correo registrado. Agrégaselo en la página antes de darle acceso.</Text>
                  )}
                </>
              )}
              {aviso && <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>}
            </>
          );
        })()}
      </Hoja>
    </ScrollView>
  );
}

/** La letra del sector, del color del sector (como `SectorInsignia` de la web). */
function InsigniaSector({ sector, grande = false }) {
  const tam = grande ? 24 : 18;
  return (
    <View
      style={{ width: tam, height: tam, borderRadius: tam / 2, backgroundColor: sector.color || T.accion, alignItems: "center", justifyContent: "center" }}
      accessible
      accessibilityLabel={sector.nombre || `Sector ${sector.clave}`}
    >
      <Text style={{ color: "#fff", fontSize: grande ? 12.5 : 10.5, fontWeight: "800" }}>{sector.clave}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  btnAlta: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: T.accion, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, minHeight: 44 },
  btnAltaTxt: { color: "#fff", fontWeight: "700", fontSize: 13.5 },
  altaTit: { color: T.tinta, fontSize: 15, fontWeight: "700" },
  altaNota: { color: T.gris, fontSize: 12.5, marginTop: 4, lineHeight: 17 },
  filtroTit: { color: T.gris, fontSize: 11, letterSpacing: 0.5, marginTop: 16, marginBottom: 8, textTransform: "uppercase", fontWeight: "700" },
  saldos: { color: T.grisClaro, fontSize: 12, marginTop: 4 },
  conAcceso: { color: T.ok, fontSize: 11.5, fontWeight: "700" },
  nota: { color: T.grisClaro, fontSize: 12, marginTop: 8, lineHeight: 17 },
});
