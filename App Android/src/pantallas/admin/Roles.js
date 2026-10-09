import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, RefreshControl, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "../../tema";
import { Tarjeta, TituloTarjeta, Badge } from "../../ui";
import AvisoResultado from "../../AvisoResultado";
import { quienSoy } from "../../datos-cuentas";
import { listarRoles, listarEquipoCompleto, crearRol, editarRol, borrarRol } from "../../datos-equipo";
import { SECCIONES, PERMISOS_SUELTOS, ROL_COMPLETO, rolProtegido } from "../../web/permisos.mjs";
import { textoPermiso, alternarPermisoRol, personasConRol } from "../../equipo-app.mjs";
import { Aviso, Campo, Accion, Hoja, Seccion, estilosCuentas as e } from "./piezas-cuentas";

const TODAS = [...SECCIONES, ...PERMISOS_SUELTOS];
const ROL_VACIO = { id: null, nombre: "", descripcion: "", permisos: [] };

/**
 * ROLES (apps al 100%, fase C; la pestaña "Roles" de /admin/usuarios).
 *
 * Un rol es una lista de secciones del panel ("Caja: Saldos y Clientes").
 * Todo el personal ve los roles; solo el DUEÑO los crea, cambia y borra, con
 * casillas. Se escribe directo con la sesión: la base (db/029) tampoco deja a
 * nadie más, así que hay dos candados. "Administrador completo" no se
 * renombra ni se borra: con él entran los administradores invitados desde la
 * app 1.1.1, que no sabe de roles.
 */
export default function Roles() {
  const [roles, setRoles] = useState(null);
  const [equipo, setEquipo] = useState([]);
  const [yo, setYo] = useState(null);
  const [carga, setCarga] = useState(null);
  const [refrescando, setRefrescando] = useState(false);
  const [form, setForm] = useState(null); // ROL_VACIO o una copia del rol
  const [guardando, setGuardando] = useState(false);
  const [res, setRes] = useState(null);
  const [aviso, setAviso] = useState("");
  const soyDueno = yo?.rol === "dueno";

  const cargar = useCallback(async () => {
    const [r, l] = await Promise.all([listarRoles(), listarEquipoCompleto()]);
    if (r === null) { setCarga({ ok: false, sinRed: true }); return; }
    setCarga(null);
    setRoles(r);
    setEquipo(l || []);
  }, []);

  useEffect(() => {
    quienSoy().then(setYo);
    cargar();
  }, [cargar]);

  const refrescar = async () => {
    setRefrescando(true);
    try { await cargar(); } finally { setRefrescando(false); }
  };

  const guardar = async () => {
    if (guardando) return;
    setGuardando(true);
    setRes(null);
    const { id, ...datos } = form;
    const actual = id ? (roles || []).find((r) => r.id === id) : null;
    const r = id ? await editarRol({ id, ...datos }, actual) : await crearRol(datos);
    setGuardando(false);
    if (!r.ok) { setRes(r); return; }
    setAviso(id ? `Rol "${datos.nombre.trim()}" actualizado.` : `Rol "${datos.nombre.trim()}" creado.`);
    setForm(null);
    cargar();
  };

  const borrar = (rol) => {
    const personas = personasConRol(equipo, rol.id);
    Alert.alert(
      "Borrar el rol",
      personas
        ? `¿Borrar el rol "${rol.nombre}"? ${personas} persona(s) se quedarán sin rol: solo verán el Panel hasta que les pongas otro.`
        : `¿Borrar el rol "${rol.nombre}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Borrar",
          style: "destructive",
          onPress: async () => {
            setRes(null);
            const r = await borrarRol(rol);
            if (!r.ok) { setRes(r); return; }
            setAviso(`Rol "${rol.nombre}" borrado.`);
            cargar();
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: T.fondo }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={T.gris} />}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={e.h1}>Roles</Text>
          <Text style={[e.sub, { marginBottom: 0 }]}>Qué secciones abre y usa cada administrador.</Text>
        </View>
        {soyDueno && (
          <Pressable onPress={() => { setForm(ROL_VACIO); setRes(null); setAviso(""); }} style={s.btnNuevo} accessibilityRole="button">
            <Feather name="plus" size={16} color="#fff" />
            <Text style={s.btnNuevoTxt}>Nuevo rol</Text>
          </Pressable>
        )}
      </View>

      {!!aviso && <Aviso tipo="ok">{aviso}</Aviso>}
      {!form && <AvisoResultado r={res} />}
      <AvisoResultado r={carga} onReintentar={cargar} />

      {roles === null && !carga && <Text style={[e.vacio, { marginTop: 12 }]}>Leyendo los roles…</Text>}
      {roles && roles.length === 0 && <Text style={[e.vacio, { marginTop: 12 }]}>Todavía no hay roles.</Text>}

      {(roles || []).map((r) => (
        <Tarjeta key={r.id} style={{ marginTop: 14, marginBottom: 0 }}>
          <TituloTarjeta derecha={<Text style={s.personas}>{personasConRol(equipo, r.id)} persona(s)</Text>}>{r.nombre}</TituloTarjeta>
          {!!r.descripcion && <Text style={s.nota}>{r.descripcion}</Text>}
          <View style={s.insignias}>
            {r.permisos.length
              ? r.permisos.map((p) => <Badge key={p} clase="ruta">{textoPermiso(p)}</Badge>)
              : <Text style={s.nota}>Solo el Panel</Text>}
          </View>
          {soyDueno && (
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              <Pressable onPress={() => { setForm({ ...r, descripcion: r.descripcion || "" }); setRes(null); setAviso(""); }} style={s.btn} accessibilityRole="button">
                <Feather name="edit-2" size={14} color={T.tinta} />
                <Text style={s.btnTxt}>Editar</Text>
              </Pressable>
              {!rolProtegido(r) && (
                <Pressable onPress={() => borrar(r)} style={[s.btn, { borderColor: "rgba(217,119,107,0.5)" }]} accessibilityRole="button">
                  <Feather name="trash-2" size={14} color={T.error} />
                  <Text style={[s.btnTxt, { color: T.error }]}>Borrar</Text>
                </Pressable>
              )}
            </View>
          )}
        </Tarjeta>
      ))}

      <Tarjeta style={{ marginTop: 14 }}>
        <TituloTarjeta>Cómo funciona</TituloTarjeta>
        <Text style={s.nota}>· El dueño puede todo y es el único que crea roles y se los asigna a los administradores.</Text>
        <Text style={s.nota}>· Un administrador solo abre y usa las secciones que marque su rol; sin rol, solo ve el Panel y Mi cuenta.</Text>
        <Text style={s.nota}>· Los choferes no llevan rol: entran al modo chofer y ven solo sus paradas.</Text>
        <Text style={s.nota}>· "Cambiar precios" y "Eliminar clientes" también se pueden dar a una sola persona desde Usuarios → Editar.</Text>
        <Text style={s.nota}>· {ROL_COMPLETO} no se renombra ni se borra: con él entran los administradores invitados desde la app.</Text>
      </Tarjeta>

      <Hoja visible={!!form} onClose={() => setForm(null)} titulo={form?.id ? `Editar rol "${form.nombre}"` : "Nuevo rol"}>
        {form && (
          <>
            <Campo
              etiqueta={'Nombre (p. ej. "Caja", "Operaciones")'}
              valor={form.nombre}
              onCambio={(v) => setForm((f) => ({ ...f, nombre: v }))}
              maxLength={60}
              editable={!rolProtegido(form)}
              ayuda={rolProtegido(form) ? "Este nombre no se cambia; sus casillas sí." : undefined}
            />
            <Campo etiqueta="Descripción (opcional)" valor={form.descripcion} onCambio={(v) => setForm((f) => ({ ...f, descripcion: v }))} />
            <Seccion>Lo que puede abrir y usar</Seccion>
            <Text style={s.nota}>Las demás secciones no le salen en el menú; sin ninguna, solo ve el Panel y Mi cuenta.</Text>
            {TODAS.map((x) => {
              const on = form.permisos.includes(x.id);
              return (
                <Pressable
                  key={x.id}
                  onPress={() => setForm((f) => ({ ...f, permisos: alternarPermisoRol(f.permisos, x.id) }))}
                  style={s.casilla}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                >
                  <Feather name={on ? "check-square" : "square"} size={20} color={on ? T.accionTxt : T.grisClaro} />
                  <Text style={[s.casillaTxt, on && { fontWeight: "700" }]}>{x.texto}</Text>
                </Pressable>
              );
            })}
            <Accion icono="save" onPress={guardar} disabled={guardando} style={{ marginTop: 16 }}>
              {guardando ? "Guardando…" : form.id ? "Guardar cambios" : "Crear rol"}
            </Accion>
            <AvisoResultado r={res} onReintentar={guardar} />
          </>
        )}
      </Hoja>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  btnNuevo: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: T.accion, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, minHeight: 44 },
  btnNuevoTxt: { color: "#fff", fontWeight: "700", fontSize: 13.5 },
  personas: { color: T.gris, fontSize: 12 },
  nota: { color: T.gris, fontSize: 12.5, lineHeight: 18, marginTop: 4 },
  insignias: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  btn: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 40, paddingHorizontal: 12, borderRadius: 9, borderWidth: 1, borderColor: T.linea },
  btnTxt: { color: T.tinta, fontSize: 13, fontWeight: "700" },
  casilla: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44, paddingVertical: 6 },
  casillaTxt: { color: T.tinta, fontSize: 14, flex: 1 },
});
