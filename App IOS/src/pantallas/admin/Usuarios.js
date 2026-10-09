import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, RefreshControl, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "../../tema";
import { Tarjeta, TituloTarjeta, Badge } from "../../ui";
import {
  cambiarActivoUsuario,
  quienSoy,
  ROLES_INVITABLES,
  puedeDarRol,
  puedeCambiarActivo,
  pareceCorreo,
} from "../../datos-cuentas";
import {
  listarEquipoConRoles, listarRoles, detalleEquipo, invitarConRol, editarUsuario, mandarEnlaceUsuario,
  eliminarUsuario, cambiarPermisoUsuario,
} from "../../datos-equipo";
import { etiquetaRolUsuario, puedeTocarUsuario, textoPermiso } from "../../apps-admin.mjs";
import { PERMISOS_ASIGNABLES, aplicarPermiso } from "../../web/estado-cliente.mjs";
import { ROL_COMPLETO } from "../../web/permisos.mjs";
import { fechaLarga } from "../../datos-admin";
import { useLista, atenderSegundoPaso, Chip, Aviso, ErrorCarga, Campo, Accion, Hoja, Seccion, estilosCuentas as e } from "./piezas-cuentas";

const CLASE_ROL = { dueno: "ruta", admin: "prog", operador: "ok" };
const VACIO = { nombre: "", correo: "", rol: "operador", rolId: "" };

/**
 * USUARIOS Y ROLES (6-oct-2026, paridad con /admin/usuarios): el equipo,
 * "Invitar usuario" (le llega un correo para escoger su contraseña) y
 * desactivar o reactivar. Las reglas son las del panel: el dueño invita
 * administradores y choferes, un administrador sólo choferes; al dueño y a
 * uno mismo no se les desactiva. El servidor las vuelve a aplicar.
 *
 * 9-oct-2026 (apps al 100%): como la web desde la Entrega 2 —
 *   · al invitar un administrador, el dueño escoge su ROL de secciones;
 *   · cada quien con su correo y su último acceso (los da el servidor:
 *     viven en Auth, que la app no puede leer);
 *   · "Editar": nombre, teléfono y rol (el rol, solo el dueño), mandar el
 *     enlace de contraseña, eliminar la cuenta (solo el dueño) y los
 *     permisos sueltos "cambiar precios" / "eliminar clientes" (solo el dueño);
 *   · los Roles, en su propia pantalla.
 */
export default function Usuarios({ navigation }) {
  const { lista, setLista, cargando, refrescando, errorCarga, recargar } = useLista(listarEquipoConRoles);
  const [yo, setYo] = useState(null);
  const [roles, setRoles] = useState([]);
  const [detalle, setDetalle] = useState({});
  const [alta, setAlta] = useState(false);
  const [form, setForm] = useState(VACIO);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState(null); // { tipo, texto }
  const [cambiando, setCambiando] = useState("");
  const [errorFila, setErrorFila] = useState({}); // { [id]: motivo }
  const [editando, setEditando] = useState(null); // copia editable
  const [avisoHoja, setAvisoHoja] = useState(null);
  const soyDueno = yo?.rol === "dueno";

  const leerExtras = () => {
    listarRoles().then((r) => { if (r) setRoles(r); });
    detalleEquipo().then((d) => { if (d?.ok) setDetalle(d.porId || {}); });
  };

  useEffect(() => {
    let vivo = true;
    quienSoy().then((q) => { if (vivo) setYo(q); });
    leerExtras();
    return () => { vivo = false; };
  }, []);

  const recargarTodo = (o) => { recargar(o); leerExtras(); };

  // El administrador no ve "Administrador" entre los roles que puede dar.
  const rolesQuePuedo = Object.keys(ROLES_INVITABLES).filter((r) => puedeDarRol(yo, r));
  const completoId = roles.find((r) => r.nombre === ROL_COMPLETO)?.id || "";

  const invitar = async () => {
    setAviso(null);
    if (!form.nombre.trim()) { setAviso({ tipo: "error", texto: "Escribe el nombre completo." }); return; }
    if (!pareceCorreo(form.correo)) { setAviso({ tipo: "error", texto: "Ese correo no parece válido." }); return; }
    setEnviando(true);
    // Sin rol escogido, el servidor le pone "Administrador completo".
    const r = await invitarConRol({ ...form, rolId: form.rol === "admin" && soyDueno ? form.rolId || completoId : undefined });
    setEnviando(false);
    if (atenderSegundoPaso(r, navigation)) return;
    if (!r.ok) { setAviso({ tipo: "error", texto: r.sinRed ? "Sin conexión. Revisa tu señal y vuelve a intentar." : r.motivo || "No se pudo mandar la invitación." }); return; }
    setAviso({
      tipo: "ok",
      texto: `Listo: a ${r.correo || form.correo} le llegó la invitación como ${ROLES_INVITABLES[form.rol]}. Escoge su contraseña con el enlace del correo.`,
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
    setAvisoHoja(null);
    setEditando({ ...u, nombreForm: u.nombreReal || "", telefonoForm: u.telefono || "", rolForm: u.rolId || "" });
  };

  const textoFallo = (r, porOmision) => (r.sinRed ? "Sin conexión. Revisa tu señal y vuelve a intentar." : r.motivo || porOmision);

  const guardarEdicion = async () => {
    const u = editando;
    setCambiando(u.id);
    setAvisoHoja(null);
    const datos = { id: u.id, nombre: u.nombreForm, telefono: u.telefonoForm };
    // El rol solo lo manda el dueño, y solo para administradores ("" = sin rol).
    if (soyDueno && u.rol === "admin") datos.rolId = u.rolForm || "";
    const r = await editarUsuario(datos);
    setCambiando("");
    if (atenderSegundoPaso(r, navigation)) return;
    if (!r.ok) { setAvisoHoja({ tipo: "error", texto: textoFallo(r, "No se guardó.") }); return; }
    setAviso({ tipo: "ok", texto: `Guardé los cambios de ${u.nombreForm.trim() || u.nombre}.` });
    setEditando(null);
    recargarTodo();
  };

  const mandarEnlace = async (u) => {
    setCambiando(u.id);
    setAvisoHoja(null);
    const r = await mandarEnlaceUsuario(u.id);
    setCambiando("");
    if (atenderSegundoPaso(r, navigation)) return;
    setAvisoHoja(r.ok
      ? { tipo: "ok", texto: r.demo ? "Demostración: no se mandó nada." : `Le mandé a ${r.correo || "su correo"} un enlace para escoger su contraseña.` }
      : { tipo: "error", texto: textoFallo(r, "No se pudo mandar el enlace.") });
  };

  const eliminar = (u) =>
    Alert.alert(
      "¿Eliminar la cuenta para siempre?",
      `${u.nombre} ya no podrá entrar y su cuenta se borra. Si tiene historial (recolecciones, rutas), mejor desactívala: no entra y su historial se conserva.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            setCambiando(u.id);
            const r = await eliminarUsuario(u.id);
            setCambiando("");
            if (atenderSegundoPaso(r, navigation)) return;
            if (!r.ok) { setAvisoHoja({ tipo: "error", texto: textoFallo(r, "No se pudo eliminar.") }); return; }
            setAviso({ tipo: "ok", texto: `${u.nombre} ya no tiene cuenta.` });
            setEditando(null);
            recargarTodo();
          },
        },
      ]
    );

  // Permisos sueltos que asigna el dueño: precios y eliminar clientes.
  const cambiarPermiso = async (u, permiso, valor) => {
    setCambiando(u.id);
    setAvisoHoja(null);
    const r = await cambiarPermisoUsuario(u.id, permiso, valor);
    setCambiando("");
    if (atenderSegundoPaso(r, navigation)) return;
    if (!r.ok) { setAvisoHoja({ tipo: "error", texto: textoFallo(r, "No se guardó el permiso.") }); return; }
    const nuevos = Array.isArray(r.permisos) ? r.permisos : aplicarPermiso(u.permisos, permiso, valor);
    setLista((l) => l.map((x) => (x.id === u.id ? { ...x, permisos: nuevos } : x)));
    setEditando((ed) => (ed && ed.id === u.id ? { ...ed, permisos: nuevos } : ed));
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: T.fondo }}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      // Propiedad de iOS: deja que el sistema recorra el contenido cuando sale
      // el teclado. En Android se ignora (allí lo resuelve el resize).
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => recargarTodo({ jalando: true })} tintColor={T.gris} />}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={e.h1}>Usuarios y roles</Text>
          <Text style={[e.sub, { marginBottom: 0 }]}>Tu equipo y sus permisos.</Text>
        </View>
        {rolesQuePuedo.length > 0 && (
          <Pressable
            onPress={() => { setAlta((v) => !v); setAviso(null); setForm({ ...VACIO, rolId: completoId }); }}
            style={s.btnAlta}
            accessibilityRole="button"
            accessibilityLabel={alta ? "Cerrar la invitación" : "Invitar usuario"}
          >
            <Feather name={alta ? "x" : "user-plus"} size={16} color="#fff" />
            <Text style={s.btnAltaTxt}>{alta ? "Cerrar" : "Invitar"}</Text>
          </Pressable>
        )}
      </View>

      {/* Los roles de secciones viven en su propia pantalla. */}
      <Pressable onPress={() => navigation.navigate("Roles")} style={s.enlaceRoles} accessibilityRole="button">
        <Feather name="shield" size={16} color={T.accionTxt} />
        <Text style={s.enlaceRolesTxt}>Roles ({roles.length}){soyDueno ? " · crear y editar" : ""}</Text>
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
          {form.rol === "admin" && soyDueno && roles.length > 0 && (
            <>
              <Text style={s.label}>Rol (qué secciones abre)</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {roles.map((r) => (
                  <Chip key={r.id} on={(form.rolId || completoId) === r.id} onPress={() => setForm({ ...form, rolId: r.id })}>{r.nombre}</Chip>
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
          const d = detalle[u.id] || {};
          const tocable = puedeTocarUsuario({ yo, u });
          return (
            <View key={u.id} style={[s.uFila, i < lista.length - 1 && s.borde]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.uNom}>{u.nombre}{yo?.id === u.id ? " (tú)" : ""}</Text>
                  {d.correo ? <Text style={s.uLinea} selectable>{d.correo}</Text> : null}
                  <Text style={s.uLinea}>
                    {u.telefono || "Sin teléfono"} · {d.ultimoAcceso ? `último acceso ${fechaLarga(String(d.ultimoAcceso).slice(0, 10))}` : "nunca ha entrado"}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    <Badge clase={CLASE_ROL[u.rol] || "none"}>{etiquetaRolUsuario(u, roles)}</Badge>
                    <Badge clase={u.activo ? "ok" : "none"}>{u.activo ? "Activo" : "Inactivo"}</Badge>
                  </View>
                  {u.permisos?.length ? <Text style={s.uLinea}>+ {u.permisos.map(textoPermiso).join(", ").toLowerCase()}</Text> : null}
                </View>
                <View style={{ gap: 6 }}>
                  {tocable && (
                    <Pressable onPress={() => abrirEdicion(u)} style={s.btnFila} accessibilityRole="button" accessibilityLabel={`Editar a ${u.nombre}`}>
                      <Text style={s.btnFilaTxt}>Editar</Text>
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

      <Hoja visible={!!editando} onClose={() => setEditando(null)} titulo={editando ? `Editar a ${editando.nombre}` : ""}>
        {editando ? (
          <>
            <Campo etiqueta="Nombre" valor={editando.nombreForm} onCambio={(v) => setEditando({ ...editando, nombreForm: v })} />
            <Campo etiqueta="Teléfono (10 dígitos)" valor={editando.telefonoForm} keyboardType="phone-pad" onCambio={(v) => setEditando({ ...editando, telefonoForm: v })} />
            {editando.rol === "admin" ? (
              <>
                <Text style={s.label}>Rol {soyDueno ? "" : "(solo el dueño lo cambia)"}</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  <Chip on={!editando.rolForm} onPress={() => soyDueno && setEditando({ ...editando, rolForm: "" })}>Sin rol (solo el Panel)</Chip>
                  {roles.map((r) => (
                    <Chip key={r.id} on={editando.rolForm === r.id} onPress={() => soyDueno && setEditando({ ...editando, rolForm: r.id })}>{r.nombre}</Chip>
                  ))}
                </View>
              </>
            ) : null}
            <Accion icono="save" onPress={guardarEdicion} disabled={cambiando === editando.id} style={{ marginTop: 14 }}>
              {cambiando === editando.id ? "Guardando…" : "Guardar"}
            </Accion>

            {editando.rol === "admin" && soyDueno ? (
              <>
                <Seccion>Además de su rol</Seccion>
                {PERMISOS_ASIGNABLES.map((p) => {
                  const on = (editando.permisos || []).includes(p.clave);
                  return (
                    <Pressable
                      key={p.clave}
                      onPress={() => cambiarPermiso(editando, p.clave, !on)}
                      disabled={cambiando === editando.id}
                      style={s.casilla}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                    >
                      <Feather name={on ? "check-square" : "square"} size={20} color={on ? T.accionTxt : T.gris} />
                      <Text style={s.casillaTxt}>{p.texto}</Text>
                    </Pressable>
                  );
                })}
              </>
            ) : null}

            <Seccion>Acceso</Seccion>
            <Accion icono="mail" variante="linea" onPress={() => mandarEnlace(editando)} disabled={cambiando === editando.id}>
              Mandar enlace de contraseña
            </Accion>
            <Text style={s.nota}>Sirve para reenviar la invitación o para que restablezca su contraseña.</Text>
            {soyDueno ? (
              <Pressable onPress={() => eliminar(editando)} disabled={cambiando === editando.id} style={s.eliminar} accessibilityRole="button">
                <Feather name="trash-2" size={15} color={T.error} />
                <Text style={s.eliminarTxt}>Eliminar cuenta</Text>
              </Pressable>
            ) : null}
            {avisoHoja && <Aviso tipo={avisoHoja.tipo}>{avisoHoja.texto}</Aviso>}
          </>
        ) : null}
      </Hoja>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  btnAlta: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: T.accion, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, minHeight: 44 },
  btnAltaTxt: { color: "#fff", fontWeight: "700", fontSize: 13.5 },
  nota: { color: T.grisClaro, fontSize: 12, marginTop: 6, lineHeight: 17 },
  label: { color: T.tinta, fontSize: 12.5, fontWeight: "700", marginBottom: 6, marginTop: 12 },
  uFila: { paddingVertical: 11 },
  borde: { borderBottomWidth: 1, borderBottomColor: T.linea },
  uNom: { color: T.tinta, fontSize: 14.5, fontWeight: "700" },
  uLinea: { color: T.gris, fontSize: 12.5, marginTop: 2 },
  btnFila: { borderWidth: 1, borderColor: T.linea, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, minHeight: 40, justifyContent: "center", alignItems: "center" },
  btnFilaTxt: { color: T.tinta, fontSize: 13, fontWeight: "700" },
  enlaceRoles: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14, backgroundColor: T.panel, borderWidth: 1, borderColor: T.linea, borderRadius: 12, paddingHorizontal: 14, minHeight: 48 },
  enlaceRolesTxt: { color: T.tinta, fontSize: 14, fontWeight: "700", flex: 1 },
  casilla: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 },
  casillaTxt: { color: T.tinta, fontSize: 14, flex: 1 },
  eliminar: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 46, marginTop: 14, borderWidth: 1, borderColor: "rgba(217,119,107,0.6)", borderRadius: 11 },
  eliminarTxt: { color: T.error, fontSize: 14, fontWeight: "700" },
});
