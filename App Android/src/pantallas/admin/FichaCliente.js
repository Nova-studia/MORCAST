import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, RefreshControl, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "../../tema";
import { Tarjeta, TituloTarjeta, Badge } from "../../ui";
import AvisoResultado from "../../AvisoResultado";
import { pesos, fechaLarga } from "../../datos-admin";
import { ESTADOS_SOLICITUD_REC } from "../../rutas-datos";
import { etiquetaEstado, resumenBorrado } from "../../web/estado-cliente.mjs";
import {
  CAMPOS_FICHA, TEXTO_ESTADO, botonesDeEstado, formularioDeCliente, cambiosDeEdicion, esCampoNumero,
  servicioDelPunto, lineaUsuarioCliente,
} from "../../ficha-cliente.mjs";
import {
  fichaCliente, cambiarEstadoCliente, editarCliente, eliminarCliente, accesoUsuarioCliente,
  reenviarAccesoCliente, agregarPunto, quitarPunto, cambiarServicio,
} from "../../datos-ficha";
import { Accion, Aviso, Campo, Seccion, estilosCuentas as e } from "./piezas-cuentas";

/** La clase de insignia de la web ("" = gris) con los nombres de la app. */
const clase = (c) => c || "none";
const ICONO_ESTADO = { suspendido: "pause-circle", baja: "slash", activo: "rotate-ccw" };
const PUNTO_VACIO = { alias: "", calle: "", colonia: "", cp: "", referencias: "" };

/**
 * FICHA DEL CLIENTE (apps al 100%, fase C) — lo mismo que
 * /admin/clientes/[id] de la web: estado (suspender, baja, reactivar con
 * motivo), editar sus datos, eliminarlo (si el rol puede, escribiendo el
 * nombre), sus usuarios (quitar o devolver acceso, reenviar el enlace), sus
 * puntos (agregar, quitar, pausar o reanudar el servicio) y lo último que
 * pasó. Todo va por las acciones `cliente-*` del servidor, que deciden quién
 * puede y dejan la bitácora; esta pantalla solo pinta los botones.
 *
 * Se abre desde Clientes (`params.clienteId`, el UUID).
 */
export default function FichaCliente({ route, navigation }) {
  const clienteId = route?.params?.clienteId;
  const [f, setF] = useState(null);
  const [carga, setCarga] = useState(null); // respuesta fallida al abrir
  const [refrescando, setRefrescando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [res, setRes] = useState(null); // resultado de la última acción
  const [aviso, setAviso] = useState("");
  const [cambio, setCambio] = useState(null); // { estado, motivo }
  const [editando, setEditando] = useState(null); // formulario
  const [borrar, setBorrar] = useState(null); // { texto }
  const [punto, setPunto] = useState(null); // punto nuevo
  const [ultima, setUltima] = useState(null); // para "Reintentar" sin señal

  const cargar = useCallback(async () => {
    const r = await fichaCliente(clienteId);
    if (!r?.ok) { setCarga(r || { ok: false }); return false; }
    setCarga(null);
    setF(r);
    return true;
  }, [clienteId]);
  useEffect(() => { cargar(); }, [cargar]);

  const refrescar = async () => {
    setRefrescando(true);
    try { await cargar(); } finally { setRefrescando(false); }
  };

  /** Corre una acción, enseña su resultado y relee la ficha. */
  const correr = async (hacer, ok) => {
    if (ocupado) return false;
    setOcupado(true);
    setRes(null);
    setAviso("");
    setUltima(() => () => correr(hacer, ok));
    const r = await hacer();
    setOcupado(false);
    if (!r?.ok) { setRes(r || { ok: false }); return false; }
    setAviso(typeof ok === "function" ? ok(r) : ok);
    await cargar();
    return true;
  };

  if (!f) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: T.fondo }} contentContainerStyle={{ padding: 16 }}>
        {carga ? (
          <>
            <AvisoResultado r={carga} onReintentar={cargar} style={{ marginTop: 0 }} />
            {!carga.sinRed && <Accion icono="refresh-cw" variante="linea" onPress={cargar}>Reintentar</Accion>}
          </>
        ) : (
          <Text style={e.vacio}>Abriendo la ficha…</Text>
        )}
      </ScrollView>
    );
  }

  const c = f.cliente || {};
  const et = etiquetaEstado(c.estado);
  const conteos = f.conteos || {};

  const confirmarQuitarPunto = (d) =>
    Alert.alert(
      "Quitar el punto",
      `¿Quitar el punto "${d.alias}"? Si tiene historial, solo se cancela su servicio.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Quitar",
          style: "destructive",
          onPress: () => correr(() => quitarPunto({ clienteId: c.id, domicilioId: d.id }), (r) => (r.cancelado ? "Tenía historial: se canceló su servicio." : "Punto quitado.")),
        },
      ]
    );

  const confirmarQuitarAcceso = (u) =>
    Alert.alert("Quitar el acceso", `¿Quitarle el acceso a ${u.correo || u.nombre}? Ya no podrá entrar al portal ni a la app.`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Quitar acceso", style: "destructive", onPress: () => correr(() => accesoUsuarioCliente({ clienteId: c.id, perfilId: u.id, activo: false }), "Acceso quitado.") },
    ]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: T.fondo }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={T.gris} />}
    >
      <Text style={e.folio}>{c.folio}</Text>
      <Text style={e.h1}>{c.empresa}</Text>
      <View style={s.insignias}>
        <Badge clase={clase(et.clase)}>{et.texto}</Badge>
        {c.es_prueba ? <Badge clase="prog">Cuenta de revisión</Badge> : null}
      </View>
      {!!c.estado_motivo && (c.estado === "suspendido" || c.estado === "baja") && (
        <Text style={s.motivo}>
          Motivo: {c.estado_motivo}{c.estado_fecha ? ` · ${fechaLarga(String(c.estado_fecha).slice(0, 10))}` : ""}
        </Text>
      )}

      {!!aviso && <Aviso tipo="ok">{aviso}</Aviso>}
      <AvisoResultado r={res} onReintentar={ultima || undefined} />

      {/* ------------------------------------------------ Estado */}
      <Tarjeta style={{ marginTop: 14 }}>
        <TituloTarjeta>Estado de la cuenta</TituloTarjeta>
        <View style={s.fila}>
          {botonesDeEstado(c.estado).map((est) => (
            <Pressable
              key={est}
              onPress={() => { setCambio({ estado: est, motivo: "" }); setBorrar(null); setRes(null); }}
              style={[s.btn, est === "activo" && s.btnPrincipal]}
              accessibilityRole="button"
            >
              <Feather name={ICONO_ESTADO[est]} size={15} color={est === "activo" ? "#fff" : T.tinta} />
              <Text style={[s.btnTxt, est === "activo" && { color: "#fff" }]}>{TEXTO_ESTADO[est].titulo}</Text>
            </Pressable>
          ))}
          {f.puedeEliminar && (
            <Pressable onPress={() => { setBorrar({ texto: "" }); setCambio(null); setRes(null); }} style={[s.btn, s.btnPeligro]} accessibilityRole="button">
              <Feather name="trash-2" size={15} color={T.error} />
              <Text style={[s.btnTxt, { color: T.error }]}>Eliminar definitivamente</Text>
            </Pressable>
          )}
        </View>

        {cambio && (
          <View style={s.caja}>
            <Text style={s.cajaTit}>{TEXTO_ESTADO[cambio.estado].titulo}</Text>
            <Text style={s.nota}>{TEXTO_ESTADO[cambio.estado].explica}</Text>
            {cambio.estado !== "activo" && (
              <Campo
                etiqueta="Motivo (queda en la bitácora)"
                valor={cambio.motivo}
                onCambio={(v) => setCambio((x) => ({ ...x, motivo: v }))}
                placeholder="Ej. Adeudo de septiembre"
              />
            )}
            <View style={[s.fila, { marginTop: 12 }]}>
              <Accion variante="linea" onPress={() => setCambio(null)} disabled={ocupado} style={{ flex: 1 }}>Cancelar</Accion>
              <Accion
                onPress={async () => {
                  if (await correr(() => cambiarEstadoCliente({ clienteId: c.id, estado: cambio.estado, motivo: cambio.motivo }), "Listo, se cambió el estado.")) setCambio(null);
                }}
                disabled={ocupado}
                style={{ flex: 1 }}
              >
                {ocupado ? "Guardando…" : `Confirmar: ${TEXTO_ESTADO[cambio.estado].titulo.toLowerCase()}`}
              </Accion>
            </View>
          </View>
        )}

        {borrar && (
          <View style={[s.caja, { borderColor: T.error }]}>
            <Text style={[s.cajaTit, { color: T.error }]}>Eliminar definitivamente</Text>
            <Text style={s.nota}>{resumenBorrado(conteos)} <Text style={{ fontWeight: "800", color: T.tinta }}>No se puede deshacer.</Text></Text>
            {conteos.recolecciones || conteos.movimientos ? (
              <Text style={s.nota}>
                Tiene historial. Si ya es un cliente real, conviene "Dar de baja": se conserva su historial por la retención ambiental y fiscal.
              </Text>
            ) : null}
            <Campo
              etiqueta={`Escribe "${c.empresa}" para confirmar`}
              valor={borrar.texto}
              onCambio={(v) => setBorrar({ texto: v })}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={[s.fila, { marginTop: 12 }]}>
              <Accion variante="linea" onPress={() => setBorrar(null)} disabled={ocupado} style={{ flex: 1 }}>Cancelar</Accion>
              <Pressable
                disabled={ocupado || !borrar.texto.trim()}
                onPress={async () => {
                  setOcupado(true);
                  setRes(null);
                  const r = await eliminarCliente({ clienteId: c.id, confirmacion: borrar.texto });
                  setOcupado(false);
                  if (!r?.ok) { setRes(r || { ok: false }); return; }
                  Alert.alert("Cliente eliminado", `${c.empresa} se eliminó definitivamente.`);
                  navigation.goBack();
                }}
                style={[s.btnBorrar, { opacity: ocupado || !borrar.texto.trim() ? 0.5 : 1 }]}
                accessibilityRole="button"
              >
                <Text style={s.btnBorrarTxt}>{ocupado ? "Eliminando…" : "Eliminar para siempre"}</Text>
              </Pressable>
            </View>
          </View>
        )}
      </Tarjeta>

      {/* ------------------------------------------------ Datos */}
      <Tarjeta>
        <TituloTarjeta
          derecha={!editando ? (
            <Pressable onPress={() => { setEditando(formularioDeCliente(c)); setRes(null); }} style={s.btnChico} accessibilityRole="button">
              <Feather name="edit-2" size={14} color={T.tinta} />
              <Text style={s.btnTxt}>Editar</Text>
            </Pressable>
          ) : null}
        >
          Datos
        </TituloTarjeta>
        {!editando ? (
          CAMPOS_FICHA.map(([k, t]) => (
            <View key={k} style={s.dato}>
              <Text style={s.datoK}>{t}</Text>
              <Text style={s.datoV} selectable>{k === "limite_credito" ? pesos(c[k] || 0) : (c[k] ?? "") === "" ? "—" : String(c[k])}</Text>
            </View>
          ))
        ) : (
          <>
            {CAMPOS_FICHA.map(([k, t]) => (
              <Campo
                key={k}
                etiqueta={t}
                valor={editando[k]}
                onCambio={(v) => setEditando((x) => ({ ...x, [k]: v }))}
                keyboardType={esCampoNumero(k) ? "decimal-pad" : k === "telefono" ? "phone-pad" : k === "correo" ? "email-address" : "default"}
                autoCapitalize={k === "correo" ? "none" : "sentences"}
                multiline={k === "nota_interna"}
              />
            ))}
            <View style={[s.fila, { marginTop: 12 }]}>
              <Accion variante="linea" onPress={() => setEditando(null)} disabled={ocupado} style={{ flex: 1 }}>Cancelar</Accion>
              <Accion
                onPress={async () => {
                  const ok = await correr(
                    () => editarCliente({ clienteId: c.id, cambios: cambiosDeEdicion(editando) }),
                    (r) => (r.cambios?.estado === "activo" ? "Guardado. Ya tiene todos sus datos: quedó Activo." : "Guardado.")
                  );
                  if (ok) setEditando(null);
                }}
                disabled={ocupado}
                style={{ flex: 1 }}
              >
                {ocupado ? "Guardando…" : "Guardar"}
              </Accion>
            </View>
          </>
        )}
      </Tarjeta>

      {/* ------------------------------------------------ Puntos */}
      <Tarjeta>
        <TituloTarjeta
          derecha={!punto ? (
            <Pressable onPress={() => setPunto(PUNTO_VACIO)} style={s.btnChico} accessibilityRole="button">
              <Feather name="plus" size={14} color={T.tinta} />
              <Text style={s.btnTxt}>Agregar</Text>
            </Pressable>
          ) : null}
        >
          Puntos de recolección ({(f.puntos || []).length})
        </TituloTarjeta>
        {(f.puntos || []).length === 0 && !punto && <Text style={e.vacio}>Sin puntos.</Text>}
        {(f.puntos || []).map((d, i) => {
          const sus = servicioDelPunto(d);
          return (
            <View key={d.id} style={[s.renglon, i > 0 && s.borde]}>
              <Text style={s.datoV}>{d.alias}</Text>
              <Text style={s.nota}>{[d.calle, d.colonia, d.cp].filter(Boolean).join(", ") || "Sin dirección"}</Text>
              <Text style={s.nota}>
                {sus ? `Servicio: ${sus.estado}${sus.rutas?.nombre ? ` · Ruta ${sus.rutas.nombre}` : " · Sin ruta"}` : "Sin servicio"}
              </Text>
              <View style={[s.fila, { marginTop: 8 }]}>
                {sus && sus.estado === "activa" && (
                  <BotonChico icono="pause" onPress={() => correr(() => cambiarServicio({ clienteId: c.id, suscripcionId: sus.id, estado: "pausada" }), "Servicio en pausa.")} disabled={ocupado}>Pausar</BotonChico>
                )}
                {sus && sus.estado !== "activa" && (
                  <BotonChico icono="play" onPress={() => correr(() => cambiarServicio({ clienteId: c.id, suscripcionId: sus.id, estado: "activa" }), "Servicio activo.")} disabled={ocupado}>Reanudar</BotonChico>
                )}
                <BotonChico icono="trash-2" peligro onPress={() => confirmarQuitarPunto(d)} disabled={ocupado}>Quitar</BotonChico>
              </View>
            </View>
          );
        })}
        {punto && (
          <View style={s.caja}>
            <Text style={s.cajaTit}>Punto nuevo</Text>
            <Campo etiqueta="Nombre del punto (ej. Planta 2)" valor={punto.alias} onCambio={(v) => setPunto((p) => ({ ...p, alias: v }))} />
            <Campo etiqueta="Calle y número" valor={punto.calle} onCambio={(v) => setPunto((p) => ({ ...p, calle: v }))} />
            <Campo etiqueta="Colonia" valor={punto.colonia} onCambio={(v) => setPunto((p) => ({ ...p, colonia: v }))} />
            <Campo etiqueta="C.P." valor={punto.cp} onCambio={(v) => setPunto((p) => ({ ...p, cp: v }))} keyboardType="number-pad" />
            <Campo etiqueta="Referencias" valor={punto.referencias} onCambio={(v) => setPunto((p) => ({ ...p, referencias: v }))} />
            <Text style={s.nota}>El pin exacto y la ruta se ponen después en Puntos de recolección.</Text>
            <View style={[s.fila, { marginTop: 12 }]}>
              <Accion variante="linea" onPress={() => setPunto(null)} disabled={ocupado} style={{ flex: 1 }}>Cancelar</Accion>
              <Accion
                onPress={async () => { if (await correr(() => agregarPunto({ clienteId: c.id, punto }), "Punto agregado.")) setPunto(null); }}
                disabled={ocupado}
                style={{ flex: 1 }}
              >
                {ocupado ? "Guardando…" : "Agregar punto"}
              </Accion>
            </View>
          </View>
        )}
      </Tarjeta>

      {/* ------------------------------------------------ Usuarios */}
      <Tarjeta>
        <TituloTarjeta>Usuarios con acceso ({(f.usuarios || []).length})</TituloTarjeta>
        {(f.usuarios || []).length === 0 && (
          <Text style={e.vacio}>Nadie tiene acceso todavía. Dale acceso desde la lista de Clientes.</Text>
        )}
        {(f.usuarios || []).map((u, i) => (
          <View key={u.id} style={[s.renglon, i > 0 && s.borde]}>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <Text style={s.datoV}>{u.nombre || u.correo}</Text>
              {!u.activo && <Badge clase="mal">Sin acceso</Badge>}
            </View>
            <Text style={s.nota}>{lineaUsuarioCliente(u, fechaLarga)}</Text>
            <View style={[s.fila, { marginTop: 8 }]}>
              <BotonChico
                icono="mail"
                onPress={() => correr(() => reenviarAccesoCliente({ clienteId: c.id, perfilId: u.id }), (r) => `Enlace enviado a ${r.correo || u.correo}.`)}
                disabled={ocupado}
              >
                Reenviar acceso
              </BotonChico>
              {u.activo ? (
                <BotonChico icono="slash" peligro onPress={() => confirmarQuitarAcceso(u)} disabled={ocupado}>Quitar acceso</BotonChico>
              ) : (
                <BotonChico icono="key" onPress={() => correr(() => accesoUsuarioCliente({ clienteId: c.id, perfilId: u.id, activo: true }), "Acceso devuelto.")} disabled={ocupado}>
                  Devolver acceso
                </BotonChico>
              )}
            </View>
          </View>
        ))}
      </Tarjeta>

      {/* ------------------------------------------------ Historial corto */}
      <Tarjeta>
        <TituloTarjeta>Últimas recolecciones</TituloTarjeta>
        {(f.solicitudes || []).length === 0 ? <Text style={e.vacio}>Sin recolecciones.</Text> : (
          f.solicitudes.map((x, i) => {
            const b = ESTADOS_SOLICITUD_REC.find((y) => y.id === x.estado) || { texto: x.estado, clase: "none" };
            return (
              <Pressable
                key={x.id}
                onPress={() => navigation.navigate("Recolecciones", { id: x.id, folio: x.folio })}
                style={[s.mini, i > 0 && s.borde]}
                accessibilityRole="button"
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.datoV}>{x.folio}</Text>
                  <Text style={s.nota}>{fechaLarga(x.fecha_confirmada || x.fecha_pedida)}</Text>
                </View>
                <Badge clase={b.clase}>{b.texto}</Badge>
              </Pressable>
            );
          })
        )}
      </Tarjeta>

      <Tarjeta>
        <TituloTarjeta>Últimos movimientos</TituloTarjeta>
        {(f.movimientos || []).length === 0 ? <Text style={e.vacio}>Sin movimientos.</Text> : (
          f.movimientos.map((m, i) => (
            <View key={m.id} style={[s.mini, i > 0 && s.borde]}>
              <View style={{ flex: 1 }}>
                <Text style={s.datoV} numberOfLines={1}>{m.concepto || m.tipo}</Text>
                <Text style={s.nota}>{fechaLarga(m.fecha)} · {m.estado}</Text>
              </View>
              <Text style={[s.datoV, { color: m.tipo === "abono" ? T.ok : T.tinta }]}>{pesos(m.monto)}</Text>
            </View>
          ))
        )}
      </Tarjeta>
      <Seccion>Folio {c.folio}</Seccion>
    </ScrollView>
  );
}

function BotonChico({ icono, onPress, disabled, peligro, children }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [s.btn, peligro && s.btnPeligro, { opacity: disabled ? 0.5 : pressed ? 0.85 : 1 }]}
      accessibilityRole="button"
    >
      <Feather name={icono} size={14} color={peligro ? T.error : T.tinta} />
      <Text style={[s.btnTxt, peligro && { color: T.error }]}>{children}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  insignias: { flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 8 },
  motivo: { color: T.gris, fontSize: 12.5, marginTop: 6, lineHeight: 17 },
  fila: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  btn: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 42, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: T.linea, backgroundColor: T.panel2 },
  btnChico: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 36, paddingHorizontal: 10, borderRadius: 9, borderWidth: 1, borderColor: T.linea },
  btnPrincipal: { backgroundColor: T.accion, borderColor: T.accion },
  btnPeligro: { borderColor: "rgba(217,119,107,0.6)" },
  btnTxt: { color: T.tinta, fontSize: 13, fontWeight: "700" },
  caja: { marginTop: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: T.linea, backgroundColor: T.panel2 },
  cajaTit: { color: T.tinta, fontSize: 14.5, fontWeight: "800" },
  nota: { color: T.gris, fontSize: 12.5, marginTop: 4, lineHeight: 17 },
  btnBorrar: { flex: 1, minHeight: 46, borderRadius: 11, backgroundColor: "#b3261e", alignItems: "center", justifyContent: "center", marginTop: 10, paddingHorizontal: 12 },
  btnBorrarTxt: { color: "#fff", fontSize: 14, fontWeight: "800" },
  dato: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: T.linea },
  datoK: { color: T.gris, fontSize: 13 },
  datoV: { color: T.tinta, fontSize: 13.5, fontWeight: "600", flexShrink: 1 },
  renglon: { paddingVertical: 10 },
  borde: { borderTopWidth: 1, borderTopColor: T.linea },
  mini: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9 },
});
