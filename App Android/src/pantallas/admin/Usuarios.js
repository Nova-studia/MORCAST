import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput } from "react-native";
import { Feather } from "@expo/vector-icons";
import { listarUsuarios } from "../../datos-remoto";
import { T } from "../../tema";
import { Tarjeta, TituloTarjeta, Badge, Boton } from "../../ui";
import { USUARIOS_ADMIN, ROLES, fechaLarga } from "../../datos-admin";

export default function Usuarios() {
  const [lista, setLista] = useState([]);

  useEffect(() => {
    let vivo = true;
    listarUsuarios().then((l) => { if (vivo) setLista(l); });
    return () => { vivo = false; };
  }, []);
  const [alta, setAlta] = useState(false);
  const [form, setForm] = useState({ nombre: "", correo: "", rol: "Auxiliar de administrador" });

  const invitar = () => {
    if (!form.nombre || !form.correo) return;
    const maxN = Math.max(0, ...lista.map((u) => parseInt(u.id.split("-")[1], 10) || 0));
    const nuevo = { id: `U-${String(maxN + 1).padStart(3, "0")}`, nombre: form.nombre, correo: form.correo, rol: form.rol, estatus: "invitado", ultimo: "—" };
    setLista((l) => [...l, nuevo]);
    setForm({ nombre: "", correo: "", rol: "Auxiliar de administrador" });
    setAlta(false);
  };
  const quitar = (id) => setLista((l) => l.filter((u) => u.id !== id));

  const rolClase = (rol) => rol === "Administrador" ? "ruta" : rol === "Auxiliar de administrador" ? "prog" : rol === "Chofer / Operador" ? "ok" : "none";

  return (
    <ScrollView style={{ flex: 1, backgroundColor: T.fondo }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flex: 1 }}><Text style={s.h1}>Usuarios y roles</Text><Text style={s.sub}>Administra tu equipo y sus permisos.</Text></View>
        <Pressable onPress={() => setAlta((v) => !v)} style={s.btnAlta}>
          <Feather name={alta ? "x" : "user-plus"} size={16} color="#0d1211" />
          <Text style={s.btnAltaTxt}>{alta ? "Cerrar" : "Invitar"}</Text>
        </Pressable>
      </View>

      {alta && (
        <Tarjeta style={{ marginTop: 14 }}>
          <TituloTarjeta>Invitar usuario</TituloTarjeta>
          <Text style={s.label}>Nombre completo</Text>
          <TextInput style={s.input} value={form.nombre} onChangeText={(v) => setForm({ ...form, nombre: v })} placeholderTextColor={T.grisClaro} />
          <Text style={s.label}>Correo</Text>
          <TextInput style={s.input} value={form.correo} onChangeText={(v) => setForm({ ...form, correo: v })} keyboardType="email-address" autoCapitalize="none" placeholderTextColor={T.grisClaro} />
          <Text style={s.label}>Rol</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
            {ROLES.map((r) => (
              <Pressable key={r.id} onPress={() => setForm({ ...form, rol: r.id })} style={[s.rolChip, form.rol === r.id && s.rolChipOn]}>
                <Text style={[s.rolChipTxt, form.rol === r.id && { color: "#0d1211" }]}>{r.id}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={s.rolDet}><Feather name="shield" size={13} color={T.verdeClaro} /><Text style={s.rolDetTxt}>{ROLES.find((r) => r.id === form.rol)?.detalle}</Text></View>
          <Boton onPress={invitar} disabled={!form.nombre || !form.correo} style={{ marginTop: 12 }}>Enviar invitación</Boton>
        </Tarjeta>
      )}

      <Tarjeta style={{ marginTop: 14 }}>
        <TituloTarjeta>Equipo ({lista.length})</TituloTarjeta>
        {lista.map((u, i) => (
          <View key={u.id} style={[s.uFila, i < lista.length - 1 && s.borde]}>
            <View style={{ flex: 1 }}>
              <Text style={s.uNom}>{u.nombre}</Text>
              <Text style={s.uCorreo}>{u.correo}</Text>
              <View style={{ flexDirection: "row", gap: 6, marginTop: 5 }}>
                <Badge clase={rolClase(u.rol)}>{u.rol}</Badge>
                <Badge clase={u.estatus === "activo" ? "ok" : "none"}>{u.estatus === "activo" ? "Activo" : "Invitado"}</Badge>
              </View>
            </View>
            {u.rol !== "Administrador" ? (
              <Pressable onPress={() => quitar(u.id)} hitSlop={8} style={{ padding: 4 }}><Feather name="trash-2" size={17} color={T.gris} /></Pressable>
            ) : (
              <Text style={s.principal}>Principal</Text>
            )}
          </View>
        ))}
      </Tarjeta>

      <Tarjeta>
        <TituloTarjeta>Roles disponibles</TituloTarjeta>
        {ROLES.map((r) => (
          <View key={r.id} style={s.rFila}>
            <View style={s.rIco}><Feather name="shield" size={15} color={T.tealClaro} /></View>
            <View style={{ flex: 1 }}><Text style={s.rNom}>{r.id}</Text><Text style={s.rDet}>{r.detalle}</Text></View>
          </View>
        ))}
      </Tarjeta>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  h1: { color: T.tinta, fontSize: 22, fontWeight: "800" },
  sub: { color: T.gris, fontSize: 13.5, marginTop: 3 },
  btnAlta: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: T.verde, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  btnAltaTxt: { color: "#0d1211", fontWeight: "700", fontSize: 13.5 },
  label: { color: T.tinta, fontSize: 12.5, fontWeight: "700", marginBottom: 6, marginTop: 10 },
  input: { backgroundColor: T.panel2, borderWidth: 1, borderColor: T.linea, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, color: T.tinta, fontSize: 14 },
  rolChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: T.linea, backgroundColor: T.panel2 },
  rolChipOn: { backgroundColor: T.verde, borderColor: T.verde },
  rolChipTxt: { color: T.gris, fontSize: 12, fontWeight: "600" },
  rolDet: { flexDirection: "row", gap: 7, marginTop: 10, backgroundColor: T.panel2, borderRadius: 9, padding: 9 },
  rolDetTxt: { color: T.gris, fontSize: 12, flex: 1, lineHeight: 17 },
  uFila: { flexDirection: "row", alignItems: "center", paddingVertical: 11 },
  borde: { borderBottomWidth: 1, borderBottomColor: T.linea },
  uNom: { color: T.tinta, fontSize: 14.5, fontWeight: "700" },
  uCorreo: { color: T.gris, fontSize: 12.5, marginTop: 2 },
  principal: { color: T.grisClaro, fontSize: 11.5 },
  rFila: { flexDirection: "row", gap: 10, paddingVertical: 8 },
  rIco: { width: 32, height: 32, borderRadius: 9, backgroundColor: "rgba(79,192,197,0.14)", alignItems: "center", justifyContent: "center" },
  rNom: { color: T.tinta, fontSize: 13.5, fontWeight: "700" },
  rDet: { color: T.gris, fontSize: 12, marginTop: 2, lineHeight: 17 },
});
