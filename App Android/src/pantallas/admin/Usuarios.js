import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, RefreshControl, Alert, Switch } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "../../tema";
import { Tarjeta, TituloTarjeta, Badge } from "../../ui";
import AvisoResultado from "../../AvisoResultado";
import {
  cambiarActivoUsuario,
  quienSoy,
  ROLES_INVITABLES,
  puedeDarRol,
  puedeCambiarActivo,
  pareceCorreo,
} from "../../datos-cuentas";
import {
  listarEquipoCompleto, detalleEquipo, listarRoles, invitarConRol, editarUsuario, mandarEnlaceUsuario,
  eliminarUsuario, cambiarPermisoSuelto,
} from "../../datos-equipo";
import {
  textoPermiso, etiquetaRolDe, puedoTocarUsuario, datosEdicionUsuario, rolInicialInvitado,
} from "../../equipo-app.mjs";
import { PERMISOS_ASIGNABLES, aplicarPermiso } from "../../web/estado-cliente.mjs";
import { fechaLarga } from "../../datos-admin";
import { useLista, atenderSegundoPaso, Chip, Aviso, ErrorCarga, Campo, Accion, Hoja, Seccion, estilosCuentas as e } from "./piezas-cuentas";

const CLASE_ROL = { dueno: "ruta", admin: "prog", operador: "ok" };
const VACIO = { nombre: "", correo: "", rol: "operador", rolId: "" };

/**
 * USUARIOS Y ROLES (6-oct-2026; al 100% el 9-oct-2026, como /admin/usuarios).
 *
 * El equipo con su correo y su último acceso (viven en Auth: los trae el
 * servidor), "Invitar" (el dueño escoge el ROL de un administrador), y por
 * persona: editar nombre, teléfono y rol, mandar el enlace de contraseña,
 * desactivar, eliminar (solo el dueño) y los permisos sueltos que el dueño
 * da a un administrador ("Puede cambiar precios", "Puede eliminar clientes").
 * Los ROLES (qué secciones abre cada uno) están en su propia pantalla.
 *
 * Las reglas son las del panel: el dueño toca a todo el equipo, un
 * administrador solo a choferes, nadie a sí mismo (eso va en Mi cuenta). El
 * servidor las vuelve a aplicar.
 */
export default function Usuarios({ navigation }) {
  const { lista, setLista, cargando, refrescando, errorCarga, recargar } = useLista(listarEquipoCompleto);
  const [yo, setYo] = useState(null);
  const [roles, setRoles] = useState([]);
  const [detalle, setDetalle] = useState({});
  const [alta, setAlta] = useState(false);
  const [form, setForm] = useState(VACIO);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState(null); // { tipo, texto }
  const [cambiando, setCambiando] = useState("");
  const [errorFila, setErrorFila] = useState({}); // { [id]: motivo }
  const [editando, setEditando] = useState(null); // { u, nombre, telefono, rolId }
  const [resEdicion, setResEdicion] = useState(null);
  const [okEdicion, setOkEdicion] = useState("");
  const [borrarListo, setBorrarListo] = useState(false);

  const soyDueno = yo?.rol === "dueno";

  const cargarExtras = useCallback(async () => {
    const [r, d] = await Promise.all([listarRoles(), detalleEquipo()]);
    if (r) setRoles(r);
    setDetalle(d || {});
  }, []);

  useEffect(() => {
    let vivo = true;
    quienSoy().then((q) => { if (vivo) setYo(q); });
    cargarExtras();
    return () => { vivo = false; };
  }, [cargarExtras]);

  const recargarTodo = (op) => Promise.all([recargar(op), cargarExtras()]);

  // El administrador no ve "Administrador" entre los roles que puede dar.
  const rolesQuePuedo = Object.keys(ROLES_INVITABLES).filter((r) => puedeDarRol(yo, r));

  const invitar = async () => {
    setAviso(null);
    if (!form.nombre.trim()) { setAviso({ tipo: "error", texto: "Escribe el nombre completo." }); return; }
    if (!pareceCorreo(form.correo)) { setAviso({ tipo: "error", texto: "Ese correo no parece válido." }); return; }
    setEnviando(true);
    const r = await invitarConRol({ ...form, rolId: soyDueno ? form.rolId : "" });
    setEnviando(false);
    if (atenderSegundoPaso(r, navigation)) return;
    if (!r.ok) {
      setAviso({ tipo: "error", texto: r.red || r.sinRed ? "Sin conexión. No se mandó la invitación; vuelve a intentarlo." : r.motivo || "No se pudo mandar la invitación." });
      return;
    }
    setAviso({
      tipo: "ok",
      texto: r.demo
        ? "Modo de demostración: no se creó ninguna cuenta."
        : `Listo: a ${r.correo || form.correo} le llegó la invitación como ${ROLES_INVITABLES[form.rol]}. Escoge su contraseña con el enlace del correo.`,
    });
    setForm(VACIO);
    setAlta(false);
    recargarTodo();
  };

  const alternar = (u) => {
    const quiere = !u.activo;
    const hacer = async () => {
      setCambiando(u.id);
      setErrorFila((x) => ({ ...x, [u.id]: "" }));
      const r = await cambiarActivoUsuario(u.id, quiere);
      setCambiando("");
      if (atenderSegundoPaso(r, navigation)) return;
      if (!r.ok) { setErrorFila((x) => ({ ...x, [u.id]: r.motivo || "No se pudo cambiar." })); return; }
      setLista((l) => l.map((x) => (x.id === u.id ? { ...x, activo: quiere } : x)));
    };
    if (quiere) { hacer(); return; }
    // Desactivar cierra su acceso de inmediato: se confirma.
    Alert.alert(
      "Desactivar cuenta",
      `${u.nombre} ya no podrá entrar a Morcast hasta que lo reactives. ¿Desactivar?`,
      [{ text: "Cancelar", style: "cancel" }, { text: "Desactivar", style: "destructive", onPress: hacer }]
    );
  };

  /* ---------------------------------------------------------- editar */
  const abrirEdicion = (u) => {
    setResEdicion(null);
    setOkEdicion("");
    setBorrarListo(false);
    setEditando({ u, nombre: u.nombreReal || "", telefono: u.telefono || "", rolId: u.rolId || "" });
  };

  const correrEdicion = async (hacer, okTexto) => {
    setCambiando(editando.u.id);
    setResEdicion(null);
    setOkEdicion("");
    const r = await hacer();
    setCambiando("");
    if (atenderSegundoPaso(r, navigation)) return null;
    if (!r?.ok) { setResEdicion(r || { ok: false }); return null; }
    if (okTexto) setOkEdicion(typeof okTexto === "function" ? okTexto(r) : okTexto);
    return r;
  };

  const guardarEdicion = async () => {
    const { u, nombre, telefono, rolId } = editando;
    const r = await correrEdicion(() => editarUsuario(datosEdicionUsuario({ u, nombre, telefono, rolId, soyDueno })));
    if (!r) return;
    setAviso({ tipo: "ok", texto: `Guardé los cambios de ${nombre.trim() || u.nombre}.` });
    setEditando(null);
    recargarTodo();
  };

  const mandarEnlace = () =>
    correrEdicion(
      () => mandarEnlaceUsuario(editando.u.id),
      (r) => (r.demo ? "Modo de demostración: no se mandó nada." : `Le mandé a ${r.correo || "su correo"} un enlace para escoger su contraseña.`)
    );

  const eliminar = async () => {
    if (!borrarListo) { setBorrarListo(true); return; }
    const u = editando.u;
    const r = await correrEdicion(() => eliminarUsuario(u.id));
    setBorrarListo(false);
    if (!r) return;
    setAviso({ tipo: "ok", texto: `${u.nombre} ya no tiene cuenta.` });
    setEditando(null);
    recargarTodo();
  };

  const cambiarPermiso = async (permiso, valor) => {
    const u = editando.u;
    const r = await correrEdicion(() => cambiarPermisoSuelto({ perfilId: u.id, permiso, valor }));
    if (!r) return;
    const nuevos = Array.isArray(r.permisos) ? r.permisos : aplicarPermiso(u.permisos, permiso, valor);
    setLista((l) => l.map((x) => (x.id === u.id ? { ...x, permisos: nuevos } : x)));
    setEditando((ed) => (ed ? { ...ed, u: { ...ed.u, permisos: nuevos } } : ed));
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: T.fondo }}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => recargarTodo({ jalando: true })} tintColor={T.gris} />}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={e.h1}>Usuarios y roles</Text>
          <Text style={[e.sub, { marginBottom: 0 }]}>Tu equipo y qué puede hacer cada quien.</Text>
        </View>
        {rolesQuePuedo.length > 0 && (
          <Pressable
            onPress={() => { setAlta((v) => !v); setAviso(null); setForm({ ...VACIO, rolId: rolInicialInvitado(roles) }); }}
            style={s.btnAlta}
            accessibilityRole="button"
            accessibilityLabel={alta ? "Cerrar la invitación" : "Invitar usuario"}
          >
            <Feather name={alta ? "x" : "user-plus"} size={16} color="#fff" />
            <Text style={s.btnAltaTxt}>{alta ? "Cerrar" : "Invitar"}</Text>
          </Pressable>
        )}
      </View>

      <Pressable onPress={() => navigation.navigate("Roles")} style={s.btnRoles} accessibilityRole="button">
        <Feather name="shield" size={16} color={T.accionTxt} />
        <View style={{ flex: 1 }}>
          <Text style={s.rolesTit}>Roles ({roles.length})</Text>
          <Text style={s.rolesSub}>{soyDueno ? "Crea y cambia qué secciones abre cada rol" : "Qué secciones abre cada rol"}</Text>
        </View>
        <Feather name="chevron-right" size={18} color={T.gris} />
      </Pressable>

      {alta && (
        <Tarjeta style={{ marginTop: 14 }}>
          <TituloTarjeta>Invitar usuario</TituloTarjeta>
          <Text style={s.nota}>Le llega un correo con un enlace para escoger su contraseña. Nadie más la ve.</Text>
          <Campo etiqueta="Nombre completo" valor={form.nombre} onCambio={(v) => setForm({ ...form, nombre: v })} />
          <Campo
            etiqueta="Correo"
            valor={form.correo}
            onCambio={(v) => setForm({ ...form, correo: v })}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={s.label}>Tipo de cuenta</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {rolesQuePuedo.map((r) => (
              <Chip key={r} on={form.rol === r} onPress={() => setForm({ ...form, rol: r })}>{ROLES_INVITABLES[r]}</Chip>
            ))}
          </View>
          {!rolesQuePuedo.includes("admin") && (
            <Text style={s.nota}>Sólo el dueño puede dar acceso de administrador.</Text>
          )}
          {/* El rol (qué secciones abre) lo escoge el dueño, solo para administradores. */}
          {form.rol === "admin" && soyDueno && (
            <>
              <Text style={s.label}>Rol (qué puede hacer)</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {roles.map((r) => (
                  <Chip key={r.id} on={form.rolId === r.id} onPress={() => setForm({ ...form, rolId: r.id })}>{r.nombre}</Chip>
                ))}
              </View>
            </>
          )}
          <Accion icono="send" onPress={invitar} disabled={enviando || !form.nombre.trim() || !form.correo.trim()} style={{ marginTop: 14 }}>
            {enviando ? "Enviando…" : "Enviar invitación"}
          </Accion>
        </Tarjeta>
      )}

      {aviso && <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>}

      <Tarjeta style={{ marginTop: 14 }}>
        <TituloTarjeta>Equipo ({lista.length})</TituloTarjeta>
        {cargando && <Text style={e.vacio}>Leyendo el equipo…</Text>}
        {!cargando && errorCarga && <ErrorCarga que="el equipo" onReintentar={() => recargarTodo()} />}
        {lista.map((u, i) => {
          const evaluado = puedeCambiarActivo({ quien: yo, objetivo: u });
          const tocable = puedoTocarUsuario(yo, u);
          const d = detalle[u.id] || {};
          return (
            <View key={u.id} style={[s.uFila, i < lista.length - 1 && s.borde]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.uNom}>{u.nombre}{yo?.id === u.id ? " (tú)" : ""}</Text>
                  {!!d.correo && <Text style={s.uLinea} selectable>{d.correo}</Text>}
                  <Text style={s.uLinea}>{u.telefono || "Sin teléfono registrado"}</Text>
                  <Text style={s.uLinea}>Último acceso: {d.ultimoAcceso ? fechaLarga(String(d.ultimoAcceso).slice(0, 10)) : "nunca"}</Text>
                  <View style={{ flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    <Badge clase={CLASE_ROL[u.rol] || "none"}>{etiquetaRolDe(u, roles)}</Badge>
                    <Badge clase={u.activo ? "ok" : "none"}>{u.activo ? "Activo" : "Inactivo"}</Badge>
                  </View>
                  {(u.permisos || []).length > 0 && (
                    <Text style={s.uLinea}>+ {u.permisos.map(textoPermiso).join(", ").toLowerCase()}</Text>
                  )}
                </View>
                <View style={{ gap: 6 }}>
                  {tocable && (
                    <Pressable onPress={() => abrirEdicion(u)} style={s.btnFila} accessibilityRole="button" accessibilityLabel={`Editar a ${u.nombre}`}>
                      <Text style={[s.btnFilaTxt, { color: T.tinta }]}>Editar</Text>
                    </Pressable>
                  )}
                  {evaluado.puede && (
                    <Pressable
                      onPress={() => alternar(u)}
                      disabled={cambiando === u.id}
                      style={[s.btnFila, { opacity: cambiando === u.id ? 0.5 : 1 }]}
                      accessibilityRole="button"
                      accessibilityLabel={u.activo ? `Desactivar a ${u.nombre}` : `Reactivar a ${u.nombre}`}
                    >
                      <Text style={[s.btnFilaTxt, { color: u.activo ? T.error : T.ok }]}>
                        {cambiando === u.id ? "…" : u.activo ? "Desactivar" : "Reactivar"}
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
              {!!errorFila[u.id] && <Aviso tipo="error">{errorFila[u.id]}</Aviso>}
            </View>
          );
        })}
      </Tarjeta>

      <Hoja visible={!!editando} onClose={() => setEditando(null)} titulo={editando ? `Editar a ${editando.u.nombre}` : ""}>
        {editando && (
          <>
            <Campo etiqueta="Nombre" valor={editando.nombre} onCambio={(v) => setEditando((x) => ({ ...x, nombre: v }))} />
            <Campo etiqueta="Teléfono (10 dígitos)" valor={editando.telefono} onCambio={(v) => setEditando((x) => ({ ...x, telefono: v }))} keyboardType="phone-pad" />
            {editando.u.rol === "admin" && (
              <>
                <Text style={s.label}>Rol</Text>
                {soyDueno ? (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    <Chip on={!editando.rolId} onPress={() => setEditando((x) => ({ ...x, rolId: "" }))}>Sin rol (solo el Panel)</Chip>
                    {roles.map((r) => (
                      <Chip key={r.id} on={editando.rolId === r.id} onPress={() => setEditando((x) => ({ ...x, rolId: r.id }))}>{r.nombre}</Chip>
                    ))}
                  </View>
                ) : (
                  <Text style={s.nota}>{etiquetaRolDe(editando.u, roles)} · solo el dueño asigna roles.</Text>
                )}
              </>
            )}
            {editando.u.rol === "admin" && soyDueno && (
              <>
                <Seccion>Además de su rol</Seccion>
                {PERMISOS_ASIGNABLES.map((p) => (
                  <View key={p.clave} style={s.permiso}>
                    <Text style={s.permisoTxt}>{p.texto}</Text>
                    <Switch
                      value={(editando.u.permisos || []).includes(p.clave)}
                      onValueChange={(v) => cambiarPermiso(p.clave, v)}
                      disabled={cambiando === editando.u.id}
                      trackColor={{ true: T.accion, false: T.linea }}
                      accessibilityLabel={p.texto}
                    />
                  </View>
                ))}
              </>
            )}

            <Accion icono="save" onPress={guardarEdicion} disabled={cambiando === editando.u.id} style={{ marginTop: 16 }}>
              {cambiando === editando.u.id ? "Guardando…" : "Guardar"}
            </Accion>
            <Accion icono="mail" variante="linea" onPress={mandarEnlace} disabled={cambiando === editando.u.id}>
              Mandar enlace de contraseña
            </Accion>
            <Text style={s.nota}>Sirve para reenviar la invitación o para que restablezca su contraseña.</Text>
            {soyDueno && (
              <>
                <Pressable
                  onPress={eliminar}
                  disabled={cambiando === editando.u.id}
                  style={[s.btnEliminar, borrarListo && { borderColor: T.error, backgroundColor: "rgba(217,119,107,0.12)" }]}
                  accessibilityRole="button"
                >
                  <Feather name="trash-2" size={15} color={T.error} />
                  <Text style={s.btnEliminarTxt}>{borrarListo ? "¿Seguro? Toca otra vez para eliminar" : "Eliminar cuenta"}</Text>
                </Pressable>
                {borrarListo && (
                  <Text style={s.nota}>
                    Eliminar es para siempre. Si tiene historial (recolecciones, rutas), mejor desactívala: no entra y su historial se conserva.
                  </Text>
                )}
              </>
            )}
            {!!okEdicion && <Aviso tipo="ok">{okEdicion}</Aviso>}
            <AvisoResultado r={resEdicion} onReintentar={guardarEdicion} />
          </>
        )}
      </Hoja>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  btnAlta: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: T.accion, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, minHeight: 44 },
  btnAltaTxt: { color: "#fff", fontWeight: "700", fontSize: 13.5 },
  btnRoles: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: T.linea, backgroundColor: T.panel },
  rolesTit: { color: T.tinta, fontSize: 14.5, fontWeight: "700" },
  rolesSub: { color: T.gris, fontSize: 12, marginTop: 2 },
  nota: { color: T.grisClaro, fontSize: 12, marginTop: 6, lineHeight: 17 },
  label: { color: T.tinta, fontSize: 12.5, fontWeight: "700", marginBottom: 6, marginTop: 12 },
  uFila: { paddingVertical: 11 },
  borde: { borderBottomWidth: 1, borderBottomColor: T.linea },
  uNom: { color: T.tinta, fontSize: 14.5, fontWeight: "700" },
  uLinea: { color: T.gris, fontSize: 12.5, marginTop: 2 },
  btnFila: { borderWidth: 1, borderColor: T.linea, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, minHeight: 44, justifyContent: "center", alignItems: "center" },
  btnFilaTxt: { fontSize: 13, fontWeight: "700" },
  permiso: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingVertical: 8 },
  permisoTxt: { color: T.tinta, fontSize: 14, flex: 1 },
  btnEliminar: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 46, borderRadius: 11, borderWidth: 1, borderColor: "rgba(217,119,107,0.5)", marginTop: 16 },
  btnEliminarTxt: { color: T.error, fontSize: 14, fontWeight: "700" },
});
