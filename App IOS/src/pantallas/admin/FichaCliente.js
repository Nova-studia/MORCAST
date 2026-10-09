import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, RefreshControl, Alert, TextInput } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "../../tema";
import { Tarjeta, TituloTarjeta, Badge, Boton } from "../../ui";
import { pesos, fechaLarga } from "../../datos-admin";
import {
  fichaCliente, cambiarEstadoCliente, editarCliente, eliminarCliente, accesoUsuarioCliente, reenviarAccesoCliente,
  agregarPuntoCliente, quitarPuntoCliente, cambiarServicioCliente,
} from "../../datos-equipo";
import { etiquetaEstado, resumenBorrado, validarCambioEstado } from "../../web/estado-cliente.mjs";
import { botonesEstado, TEXTO_ESTADO, CAMPOS_CLIENTE, cambiosDeFicha, servicioDePunto } from "../../apps-admin.mjs";
import { claseBadge } from "../../cuentas-admin.mjs";
import { ESTADOS_SOLICITUD_REC } from "../../rutas-datos";
import { Fallo, Listo } from "../../piezas-100";
import { Hoja, Campo } from "./piezas-cuentas";

const PUNTO_VACIO = { alias: "", calle: "", colonia: "", cp: "", referencias: "" };

/**
 * FICHA DEL CLIENTE (9-oct-2026, apps al 100%; lo mismo que
 * /admin/clientes/[id] de la web).
 *
 * Datos, estado (suspender, dar de baja, reactivar, con motivo), eliminar
 * definitivamente (dueño o con el permiso, escribiendo el nombre), puntos y
 * su servicio (agregar, quitar, pausar/reanudar), los usuarios con acceso
 * (quitar/devolver, reenviar enlace) y lo último que ha pasado.
 *
 * Todo lo que cambia algo va por `cliente-*` (la puerta única): el servidor
 * decide quién puede, anota la bitácora y avisa a quien toque. Esta pantalla
 * solo pinta los botones.
 */
export default function FichaCliente({ route, navigation }) {
  const clienteId = route?.params?.clienteId;
  const [f, setF] = useState(null);
  const [falloCarga, setFalloCarga] = useState(null);
  const [refrescando, setRefrescando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [fallo, setFallo] = useState(null);
  const [hecho, setHecho] = useState("");
  const [cambio, setCambio] = useState(null); // { estado, motivo }
  const [editando, setEditando] = useState(null);
  const [borrar, setBorrar] = useState(null); // { texto }
  const [punto, setPunto] = useState(null);

  const cargar = useCallback(async () => {
    if (!clienteId) { setFalloCarga({ motivo: "Falta el cliente." }); return; }
    const r = await fichaCliente(clienteId);
    if (!r.ok) { setFalloCarga({ sinRed: r.sinRed, motivo: r.motivo }); return; }
    setFalloCarga(null);
    setF(r);
  }, [clienteId]);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    if (f?.cliente?.empresa) navigation.setOptions({ title: f.cliente.empresa });
  }, [f?.cliente?.empresa, navigation]);

  const refrescar = async () => {
    setRefrescando(true);
    try { await cargar(); } finally { setRefrescando(false); }
  };

  /** Corre una acción; si sale bien, dice `ok` y relee la ficha. */
  const correr = async (promesa, ok) => {
    setOcupado(true);
    setFallo(null);
    setHecho("");
    const r = await promesa;
    setOcupado(false);
    if (!r.ok) { setFallo({ sinRed: r.sinRed, motivo: r.motivo || "No se pudo." }); return false; }
    if (ok) setHecho(typeof ok === "function" ? ok(r) : ok);
    await cargar();
    return true;
  };

  if (!f) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: T.fondo }} contentContainerStyle={{ padding: 16 }}>
        {falloCarga ? <Fallo fallo={falloCarga} onReintentar={cargar} style={{ marginTop: 0 }} /> : <Text style={s.nota}>Abriendo la ficha…</Text>}
      </ScrollView>
    );
  }

  const c = f.cliente;
  const et = etiquetaEstado(c.estado);
  const resumen = resumenBorrado(f.conteos || {});
  const conHistorial = Boolean(f.conteos && (f.conteos.recolecciones || f.conteos.movimientos));

  const confirmarEstado = async () => {
    const v = validarCambioEstado({ actual: c.estado, nuevo: cambio.estado, motivo: cambio.motivo });
    if (!v.ok) { setFallo({ motivo: v.motivo }); return; }
    if (await correr(cambiarEstadoCliente(c.id, cambio.estado, cambio.motivo), "Listo, se cambió el estado.")) setCambio(null);
  };

  const guardarDatos = async () => {
    const cambios = cambiosDeFicha(editando);
    if (await correr(editarCliente(c.id, cambios), (r) => (r.cambios?.estado === "activo" ? "Guardado. Ya tiene todos sus datos: quedó Activo." : "Guardado."))) setEditando(null);
  };

  const eliminar = async () => {
    setOcupado(true);
    setFallo(null);
    const r = await eliminarCliente(c.id, borrar.texto);
    setOcupado(false);
    if (!r.ok) { setFallo({ sinRed: r.sinRed, motivo: r.motivo }); return; }
    Alert.alert("Cliente eliminado", `${c.empresa} se eliminó para siempre.`);
    navigation.goBack();
  };

  const quitarPunto = (d) =>
    Alert.alert(`¿Quitar el punto «${d.alias}»?`, "Si tiene historial, solo se cancela su servicio.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Quitar", style: "destructive", onPress: () => correr(quitarPuntoCliente(c.id, d.id), (r) => (r.cancelado ? "Tenía historial: se canceló su servicio." : "Punto quitado.")) },
    ]);

  const quitarAcceso = (u) =>
    Alert.alert("Quitar acceso", `¿Quitarle el acceso a ${u.correo || u.nombre}? Ya no podrá entrar al portal ni a la app.`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Quitar", style: "destructive", onPress: () => correr(accesoUsuarioCliente(c.id, u.id, false), "Acceso quitado.") },
    ]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: T.fondo }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={T.gris} />}
    >
      <Text style={s.folio}>{c.folio}</Text>
      <Text style={s.h1}>{c.empresa}</Text>
      <View style={s.insignias}>
        <Badge clase={claseBadge(et.clase)}>{et.texto}</Badge>
        {c.es_prueba ? <Badge clase="prog">Cuenta de revisión</Badge> : null}
      </View>
      {c.estado_motivo && (c.estado === "suspendido" || c.estado === "baja") ? (
        <Text style={s.nota}>Motivo: {c.estado_motivo}{c.estado_fecha ? ` · ${fechaLarga(String(c.estado_fecha).slice(0, 10))}` : ""}</Text>
      ) : null}

      <Listo onCerrar={() => setHecho("")}>{hecho}</Listo>
      <Fallo fallo={fallo} onReintentar={cargar} style={{ marginBottom: 12 }} />

      {/* ------------------------------------------------ estado */}
      <Tarjeta>
        <TituloTarjeta>Estado de la cuenta</TituloTarjeta>
        <View style={s.acciones}>
          {botonesEstado(c.estado).map((e) => (
            <Pressable key={e} onPress={() => { setFallo(null); setCambio({ estado: e, motivo: "" }); }} style={[s.accion, e === "activo" && s.accionVerde]} accessibilityRole="button">
              <Feather name={e === "suspendido" ? "pause" : e === "baja" ? "slash" : "rotate-ccw"} size={14} color={e === "activo" ? "#fff" : T.tinta} />
              <Text style={[s.accionTxt, e === "activo" && { color: "#fff" }]}>{TEXTO_ESTADO[e].titulo}</Text>
            </Pressable>
          ))}
          {f.puedeEliminar ? (
            <Pressable onPress={() => { setFallo(null); setBorrar({ texto: "" }); }} style={[s.accion, { borderColor: T.error }]} accessibilityRole="button">
              <Feather name="trash-2" size={14} color={T.error} />
              <Text style={[s.accionTxt, { color: T.error }]}>Eliminar definitivamente</Text>
            </Pressable>
          ) : null}
        </View>

        {cambio ? (
          <View style={s.caja}>
            <Text style={s.cajaTit}>{TEXTO_ESTADO[cambio.estado].titulo}</Text>
            <Text style={s.nota}>{TEXTO_ESTADO[cambio.estado].explica}</Text>
            {cambio.estado !== "activo" ? (
              <Campo etiqueta="Motivo (queda en la bitácora)" valor={cambio.motivo} onCambio={(v) => setCambio({ ...cambio, motivo: v })} placeholder="Ej. Adeudo de septiembre" />
            ) : null}
            <View style={[s.acciones, { marginTop: 12 }]}>
              <Boton onPress={confirmarEstado} disabled={ocupado} style={{ flex: 1 }}>
                {ocupado ? "Guardando…" : `Confirmar: ${TEXTO_ESTADO[cambio.estado].titulo.toLowerCase()}`}
              </Boton>
              <Boton variante="linea" onPress={() => setCambio(null)} disabled={ocupado}>Cancelar</Boton>
            </View>
          </View>
        ) : null}
      </Tarjeta>

      {/* ------------------------------------------------ datos */}
      <Tarjeta>
        <TituloTarjeta derecha={
          <Pressable onPress={() => setEditando(Object.fromEntries(CAMPOS_CLIENTE.map(([k]) => [k, c[k] == null ? "" : String(c[k])])))} style={s.accionChica} accessibilityRole="button" accessibilityLabel="Editar datos">
            <Feather name="edit-2" size={14} color={T.tinta} />
            <Text style={s.accionTxt}>Editar</Text>
          </Pressable>
        }>Datos</TituloTarjeta>
        {CAMPOS_CLIENTE.map(([k, t]) => (
          <View key={k} style={s.datoFila}>
            <Text style={s.datoK}>{t}</Text>
            <Text style={s.datoV} selectable>{k === "limite_credito" ? pesos(c[k] || 0) : c[k] || "—"}</Text>
          </View>
        ))}
      </Tarjeta>

      {/* ------------------------------------------------ puntos */}
      <Tarjeta>
        <TituloTarjeta derecha={
          <Pressable onPress={() => setPunto(PUNTO_VACIO)} style={s.accionChica} accessibilityRole="button" accessibilityLabel="Agregar punto">
            <Feather name="plus" size={14} color={T.tinta} />
            <Text style={s.accionTxt}>Agregar</Text>
          </Pressable>
        }>Puntos de recolección ({f.puntos.length})</TituloTarjeta>
        {f.puntos.length === 0 ? <Text style={s.nota}>Sin puntos.</Text> : null}
        {f.puntos.map((d, i) => {
          const sus = servicioDePunto(d);
          return (
            <View key={d.id} style={[s.punto, i > 0 && s.borde]}>
              <Text style={s.puntoTit}>{d.alias}</Text>
              <Text style={s.nota}>{[d.calle, d.colonia, d.cp].filter(Boolean).join(", ") || "Sin dirección"}</Text>
              <Text style={s.nota}>
                {sus ? `Servicio: ${sus.estado}${sus.rutas?.nombre ? ` · Ruta ${sus.rutas.nombre}` : " · Sin ruta"}` : "Sin servicio"}
              </Text>
              <View style={s.acciones}>
                {sus && sus.estado === "activa" ? (
                  <Pressable disabled={ocupado} onPress={() => correr(cambiarServicioCliente(c.id, sus.id, "pausada"), "Servicio en pausa.")} style={s.accion} accessibilityRole="button">
                    <Feather name="pause" size={14} color={T.tinta} /><Text style={s.accionTxt}>Pausar</Text>
                  </Pressable>
                ) : null}
                {sus && sus.estado !== "activa" ? (
                  <Pressable disabled={ocupado} onPress={() => correr(cambiarServicioCliente(c.id, sus.id, "activa"), "Servicio activo.")} style={s.accion} accessibilityRole="button">
                    <Feather name="play" size={14} color={T.tinta} /><Text style={s.accionTxt}>Reanudar</Text>
                  </Pressable>
                ) : null}
                <Pressable disabled={ocupado} onPress={() => quitarPunto(d)} style={s.accion} accessibilityRole="button">
                  <Feather name="trash-2" size={14} color={T.error} /><Text style={[s.accionTxt, { color: T.error }]}>Quitar</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
        <Text style={[s.nota, { marginTop: 8 }]}>El pin exacto y la ruta se ajustan en Puntos de recolección.</Text>
      </Tarjeta>

      {/* ------------------------------------------------ usuarios */}
      <Tarjeta>
        <TituloTarjeta>Usuarios con acceso ({f.usuarios.length})</TituloTarjeta>
        {f.usuarios.length === 0 ? <Text style={s.nota}>Nadie tiene acceso todavía. Dale acceso desde la lista de Clientes.</Text> : null}
        {f.usuarios.map((u, i) => (
          <View key={u.id} style={[s.punto, i > 0 && s.borde]}>
            <View style={{ flexDirection: "row", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <Text style={s.puntoTit}>{u.nombre || u.correo}</Text>
              {!u.activo ? <Badge clase="mal">Sin acceso</Badge> : null}
            </View>
            <Text style={s.nota}>
              {u.correo}{u.proveedor ? ` · entra con ${u.proveedor === "email" ? "correo" : u.proveedor}` : ""}
              {u.ultimoAcceso ? ` · último acceso ${fechaLarga(String(u.ultimoAcceso).slice(0, 10))}` : " · nunca ha entrado"}
            </Text>
            <View style={s.acciones}>
              <Pressable disabled={ocupado} onPress={() => correr(reenviarAccesoCliente(c.id, u.id), (r) => `Enlace enviado a ${r.correo || u.correo}.`)} style={s.accion} accessibilityRole="button">
                <Feather name="mail" size={14} color={T.tinta} /><Text style={s.accionTxt}>Reenviar acceso</Text>
              </Pressable>
              {u.activo ? (
                <Pressable disabled={ocupado} onPress={() => quitarAcceso(u)} style={s.accion} accessibilityRole="button">
                  <Feather name="slash" size={14} color={T.error} /><Text style={[s.accionTxt, { color: T.error }]}>Quitar acceso</Text>
                </Pressable>
              ) : (
                <Pressable disabled={ocupado} onPress={() => correr(accesoUsuarioCliente(c.id, u.id, true), "Acceso devuelto.")} style={s.accion} accessibilityRole="button">
                  <Feather name="key" size={14} color={T.tinta} /><Text style={s.accionTxt}>Devolver acceso</Text>
                </Pressable>
              )}
            </View>
          </View>
        ))}
      </Tarjeta>

      {/* ------------------------------------------------ historial corto */}
      <Tarjeta>
        <TituloTarjeta>Últimas recolecciones</TituloTarjeta>
        {f.solicitudes.length === 0 ? <Text style={s.nota}>Sin recolecciones.</Text> : null}
        {f.solicitudes.map((x) => (
          <Pressable key={x.id} onPress={() => navigation.navigate("Recolecciones", { id: x.id })} style={s.histFila} accessibilityRole="button">
            <Text style={s.histFolio}>{x.folio}</Text>
            <Text style={s.histDato}>{fechaLarga(x.fecha_confirmada || x.fecha_pedida)}</Text>
            <Text style={s.histDato}>{ESTADOS_SOLICITUD_REC.find((e) => e.id === x.estado)?.texto || x.estado}</Text>
          </Pressable>
        ))}
      </Tarjeta>
      <Tarjeta>
        <TituloTarjeta>Últimos movimientos</TituloTarjeta>
        {f.movimientos.length === 0 ? <Text style={s.nota}>Sin movimientos.</Text> : null}
        {f.movimientos.map((m) => (
          <View key={m.id} style={s.histFila}>
            <Text style={s.histDato}>{fechaLarga(m.fecha)}</Text>
            <Text style={s.histDato}>{m.tipo}</Text>
            <Text style={s.histFolio}>{pesos(m.monto)}</Text>
            <Text style={s.histDato}>{m.estado}</Text>
          </View>
        ))}
      </Tarjeta>

      {/* ------------------------------------------------ hojas */}
      <Hoja visible={!!editando} onClose={() => setEditando(null)} titulo="Editar datos">
        {editando ? (
          <>
            {CAMPOS_CLIENTE.map(([k, t]) => (
              <Campo
                key={k}
                etiqueta={t}
                valor={editando[k]}
                onCambio={(v) => setEditando({ ...editando, [k]: v })}
                keyboardType={k === "dias_credito" || k === "limite_credito" ? "decimal-pad" : k === "correo" ? "email-address" : k === "telefono" ? "phone-pad" : "default"}
                autoCapitalize={k === "correo" ? "none" : "sentences"}
              />
            ))}
            <Fallo fallo={fallo} onReintentar={guardarDatos} />
            <Boton onPress={guardarDatos} disabled={ocupado} style={{ marginTop: 14 }}>{ocupado ? "Guardando…" : "Guardar"}</Boton>
          </>
        ) : null}
      </Hoja>

      <Hoja visible={!!punto} onClose={() => setPunto(null)} titulo="Punto nuevo">
        {punto ? (
          <>
            {[["alias", "Nombre del punto (ej. Planta 2)"], ["calle", "Calle y número"], ["colonia", "Colonia"], ["cp", "C.P."], ["referencias", "Referencias"]].map(([k, t]) => (
              <Campo key={k} etiqueta={t} valor={punto[k]} onCambio={(v) => setPunto({ ...punto, [k]: v })} keyboardType={k === "cp" ? "number-pad" : "default"} />
            ))}
            <Text style={[s.nota, { marginTop: 10 }]}>El pin exacto y la ruta se ajustan después en Puntos de recolección.</Text>
            <Fallo fallo={fallo} onReintentar={() => setFallo(null)} />
            <Boton
              onPress={async () => { if (await correr(agregarPuntoCliente(c.id, punto), "Punto agregado.")) setPunto(null); }}
              disabled={ocupado}
              style={{ marginTop: 14 }}
            >
              {ocupado ? "Guardando…" : "Agregar punto"}
            </Boton>
          </>
        ) : null}
      </Hoja>

      <Hoja visible={!!borrar} onClose={() => setBorrar(null)} titulo="Eliminar definitivamente">
        {borrar ? (
          <>
            <Text style={s.peligro}>{resumen} No se puede deshacer.</Text>
            {conHistorial ? (
              <Text style={[s.nota, { marginTop: 8 }]}>
                Tiene historial. Si ya es un cliente real, conviene «Dar de baja»: se conserva su historial por la retención ambiental y fiscal.
              </Text>
            ) : null}
            <Text style={s.label}>Escribe «{c.empresa}» para confirmar</Text>
            <TextInput
              value={borrar.texto}
              onChangeText={(v) => setBorrar({ texto: v })}
              autoCapitalize="none"
              autoCorrect={false}
              style={s.input}
              placeholderTextColor={T.grisClaro}
              accessibilityLabel="Nombre de la empresa para confirmar"
            />
            <Fallo fallo={fallo} onReintentar={eliminar} />
            <Pressable
              onPress={eliminar}
              disabled={ocupado || !borrar.texto.trim()}
              style={[s.btnPeligro, (ocupado || !borrar.texto.trim()) && { opacity: 0.5 }]}
              accessibilityRole="button"
            >
              <Text style={s.btnPeligroTxt}>{ocupado ? "Eliminando…" : "Eliminar para siempre"}</Text>
            </Pressable>
          </>
        ) : null}
      </Hoja>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  folio: { color: T.gris, fontSize: 12 },
  h1: { color: T.tinta, fontSize: 21, fontWeight: "800", marginTop: 2 },
  insignias: { flexDirection: "row", gap: 6, marginTop: 8, marginBottom: 6, flexWrap: "wrap" },
  nota: { color: T.gris, fontSize: 12.5, lineHeight: 18 },
  label: { color: T.tinta, fontSize: 12.5, fontWeight: "700", marginTop: 14, marginBottom: 6 },
  acciones: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 8 },
  accion: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: T.linea, borderRadius: 9, paddingHorizontal: 12, minHeight: 40, backgroundColor: T.panel2 },
  accionVerde: { backgroundColor: T.accion, borderColor: T.accion },
  accionChica: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: T.linea, borderRadius: 9, paddingHorizontal: 10, minHeight: 36 },
  accionTxt: { color: T.tinta, fontSize: 13, fontWeight: "700" },
  caja: { marginTop: 12, borderWidth: 1, borderColor: T.linea, borderRadius: 12, padding: 12, backgroundColor: T.panel2 },
  cajaTit: { color: T.tinta, fontSize: 14.5, fontWeight: "800", marginBottom: 4 },
  datoFila: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: T.linea },
  datoK: { color: T.gris, fontSize: 13 },
  datoV: { color: T.tinta, fontSize: 13, fontWeight: "600", flexShrink: 1, textAlign: "right" },
  punto: { paddingVertical: 10 },
  borde: { borderTopWidth: 1, borderTopColor: T.linea },
  puntoTit: { color: T.tinta, fontSize: 14, fontWeight: "700" },
  histFila: { flexDirection: "row", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: T.linea, minHeight: 40, alignItems: "center" },
  histFolio: { color: T.tinta, fontSize: 13, fontWeight: "700" },
  histDato: { color: T.gris, fontSize: 12.5, flexShrink: 1 },
  peligro: { color: T.tinta, fontSize: 14, lineHeight: 20 },
  input: { backgroundColor: T.panel2, borderWidth: 1, borderColor: T.linea, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, color: T.tinta, fontSize: 14, minHeight: 46 },
  btnPeligro: { marginTop: 14, minHeight: 48, borderRadius: 11, backgroundColor: "#b3261e", alignItems: "center", justifyContent: "center" },
  btnPeligroTxt: { color: "#fff", fontSize: 14.5, fontWeight: "800" },
});
