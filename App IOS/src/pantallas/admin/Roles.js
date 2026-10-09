import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, RefreshControl, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "../../tema";
import { Tarjeta, TituloTarjeta, Badge, Boton } from "../../ui";
import { listarRoles, guardarRol, borrarRol, listarEquipoConRoles } from "../../datos-equipo";
import { CASILLAS_ROL, textoPermiso, alternarPermiso, personasConRol } from "../../apps-admin.mjs";
import { rolProtegido, ROL_COMPLETO } from "../../web/permisos.mjs";
import { useMisPermisos } from "../../mis-permisos";
import { Fallo, Listo } from "../../piezas-100";
import { Hoja, Campo } from "./piezas-cuentas";

const ROL_VACIO = { id: null, nombre: "", descripcion: "", permisos: [] };

/**
 * ROLES POR SECCIÓN (9-oct-2026, apps al 100%; como la pestaña Roles de
 * /admin/usuarios).
 *
 * El dueño arma roles con casillas ("Caja: Saldos y Clientes") y se los
 * asigna a cada administrador en Usuarios. Todo el personal VE los roles;
 * solo el dueño los crea, cambia o borra (la base lo exige: `roles_dueno`,
 * db/029). "Administrador completo" no se renombra ni se borra: con él
 * entran los administradores invitados desde la app 1.1.1.
 */
export default function Roles() {
  const { yo } = useMisPermisos();
  const soyDueno = yo?.rol === "dueno";
  const [roles, setRoles] = useState(null);
  const [equipo, setEquipo] = useState([]);
  const [fallo, setFallo] = useState(null);
  const [refrescando, setRefrescando] = useState(false);
  const [form, setForm] = useState(null); // ROL_VACIO o una copia del rol
  const [guardando, setGuardando] = useState(false);
  const [falloForm, setFalloForm] = useState(null);
  const [hecho, setHecho] = useState("");

  const cargar = useCallback(async () => {
    const [r, e] = await Promise.all([listarRoles(), listarEquipoConRoles()]);
    if (r === null) setFallo({ sinRed: true, motivo: "No se pudieron leer los roles." });
    else { setFallo(null); setRoles(r); }
    if (e) setEquipo(e);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const refrescar = async () => {
    setRefrescando(true);
    try { await cargar(); } finally { setRefrescando(false); }
  };

  const abrir = (rol) => {
    setFalloForm(null);
    setForm(rol ? { ...rol, descripcion: rol.descripcion || "", nombreActual: rol.nombre } : ROL_VACIO);
  };

  const guardar = async () => {
    if (!form || guardando) return;
    setGuardando(true);
    setFalloForm(null);
    const r = await guardarRol(form, { nombreActual: form.nombreActual });
    setGuardando(false);
    if (!r.ok) { setFalloForm({ sinRed: r.sinRed, motivo: r.motivo }); return; }
    setHecho(form.id ? `Rol «${form.nombre.trim()}» actualizado.` : `Rol «${form.nombre.trim()}» creado. Asígnalo en Usuarios.`);
    setForm(null);
    cargar();
  };

  const borrar = (rol) => {
    const personas = personasConRol(rol.id, equipo);
    Alert.alert(
      `¿Borrar el rol «${rol.nombre}»?`,
      personas
        ? `${personas} persona${personas === 1 ? "" : "s"} se quedará${personas === 1 ? "" : "n"} sin rol: solo verán el Panel hasta que les pongas otro.`
        : "Nadie lo tiene asignado.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Borrar",
          style: "destructive",
          onPress: async () => {
            const r = await borrarRol(rol);
            if (!r.ok) { setFallo({ sinRed: r.sinRed, motivo: r.motivo }); return; }
            setHecho(`Rol «${rol.nombre}» borrado.`);
            cargar();
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: T.fondo }}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={T.gris} />}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={s.h1}>Roles</Text>
          <Text style={[s.sub, { marginBottom: 0 }]}>Qué secciones abre cada administrador.</Text>
        </View>
        {soyDueno ? (
          <Pressable onPress={() => abrir(null)} style={s.btnNuevo} accessibilityRole="button" accessibilityLabel="Nuevo rol">
            <Feather name="plus" size={16} color="#fff" />
            <Text style={s.btnNuevoTxt}>Nuevo</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={{ height: 14 }} />

      <Listo onCerrar={() => setHecho("")}>{hecho}</Listo>
      <Fallo fallo={fallo} onReintentar={cargar} style={{ marginTop: 0, marginBottom: 12 }} />
      {roles === null && !fallo ? <Text style={s.nota}>Leyendo los roles…</Text> : null}
      {roles && !roles.length ? <Text style={s.nota}>Todavía no hay roles.</Text> : null}

      {(roles || []).map((r) => {
        const personas = personasConRol(r.id, equipo);
        return (
          <Tarjeta key={r.id}>
            <TituloTarjeta derecha={<Text style={s.nota}>{personas} persona{personas === 1 ? "" : "s"}</Text>}>{r.nombre}</TituloTarjeta>
            {r.descripcion ? <Text style={[s.nota, { marginTop: -6, marginBottom: 8 }]}>{r.descripcion}</Text> : null}
            <View style={s.insignias}>
              {r.permisos.length
                ? r.permisos.map((p) => <Badge key={p} clase="ruta">{textoPermiso(p)}</Badge>)
                : <Text style={s.nota}>Solo el Panel</Text>}
            </View>
            {soyDueno ? (
              <View style={s.acciones}>
                <Pressable onPress={() => abrir(r)} style={s.accion} accessibilityRole="button" accessibilityLabel={`Editar el rol ${r.nombre}`}>
                  <Feather name="edit-2" size={14} color={T.tinta} />
                  <Text style={s.accionTxt}>Editar</Text>
                </Pressable>
                {!rolProtegido(r) ? (
                  <Pressable onPress={() => borrar(r)} style={s.accion} accessibilityRole="button" accessibilityLabel={`Borrar el rol ${r.nombre}`}>
                    <Feather name="trash-2" size={14} color={T.error} />
                    <Text style={[s.accionTxt, { color: T.error }]}>Borrar</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </Tarjeta>
        );
      })}

      <Tarjeta>
        <TituloTarjeta>Cómo funciona</TituloTarjeta>
        <Text style={s.nota}>• El dueño puede todo y es el único que crea roles y se los asigna a los administradores.</Text>
        <Text style={s.nota}>• Un administrador solo abre las secciones que marque su rol; sin rol, solo ve el Panel y Mi cuenta.</Text>
        <Text style={s.nota}>• Los choferes no llevan rol: entran al modo chofer y ven solo sus paradas.</Text>
        <Text style={s.nota}>• «Cambiar precios» y «Eliminar clientes» también se pueden dar a una sola persona desde Usuarios.</Text>
        <Text style={s.nota}>• «{ROL_COMPLETO}» no se renombra ni se borra.</Text>
      </Tarjeta>

      <Hoja visible={!!form} onClose={() => setForm(null)} titulo={form?.id ? "Editar rol" : "Nuevo rol"}>
        {form ? (
          <>
            <Campo
              etiqueta={'Nombre (p. ej. "Caja", "Operaciones")'}
              valor={form.nombre}
              onCambio={(v) => setForm((f) => ({ ...f, nombre: v }))}
              maxLength={60}
              editable={!rolProtegido({ nombre: form.nombreActual })}
              ayuda={rolProtegido({ nombre: form.nombreActual }) ? "Este rol no se renombra; sus casillas sí cambian." : undefined}
            />
            <Campo etiqueta="Descripción (opcional)" valor={form.descripcion} onCambio={(v) => setForm((f) => ({ ...f, descripcion: v }))} />
            <Text style={s.label}>Las secciones que puede abrir y usar</Text>
            {CASILLAS_ROL.map((c) => {
              const on = form.permisos.includes(c.id);
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setForm((f) => ({ ...f, permisos: alternarPermiso(f.permisos, c.id) }))}
                  style={s.casilla}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                >
                  <Feather name={on ? "check-square" : "square"} size={20} color={on ? T.accionTxt : T.gris} />
                  <Text style={s.casillaTxt}>{c.texto}</Text>
                </Pressable>
              );
            })}
            <Fallo fallo={falloForm} onReintentar={guardar} />
            <Boton onPress={guardar} disabled={guardando} style={{ marginTop: 14 }}>
              {guardando ? "Guardando…" : form.id ? "Guardar cambios" : "Crear rol"}
            </Boton>
          </>
        ) : null}
      </Hoja>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  h1: { color: T.tinta, fontSize: 22, fontWeight: "800" },
  sub: { color: T.gris, fontSize: 13.5, marginTop: 3, marginBottom: 14, lineHeight: 19 },
  nota: { color: T.gris, fontSize: 12.5, lineHeight: 19 },
  label: { color: T.tinta, fontSize: 12.5, fontWeight: "700", marginTop: 16, marginBottom: 6 },
  insignias: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  acciones: { flexDirection: "row", gap: 8, marginTop: 12 },
  accion: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: T.linea, borderRadius: 9, paddingHorizontal: 12, minHeight: 40, backgroundColor: T.panel2 },
  accionTxt: { color: T.tinta, fontSize: 13, fontWeight: "700" },
  btnNuevo: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: T.accion, borderRadius: 10, paddingHorizontal: 14, minHeight: 44 },
  btnNuevoTxt: { color: "#fff", fontWeight: "700", fontSize: 13.5 },
  casilla: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 },
  casillaTxt: { color: T.tinta, fontSize: 14, flex: 1 },
});
