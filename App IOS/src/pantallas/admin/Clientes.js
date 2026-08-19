import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput } from "react-native";
import { Feather } from "@expo/vector-icons";
import { listarClientes } from "../../datos-remoto";
import { T } from "../../tema";
import { Tarjeta, TituloTarjeta, Badge, Boton } from "../../ui";
import { CLIENTES_ADMIN, pesos } from "../../datos-admin";

export default function Clientes() {
  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;
    listarClientes().then((l) => {
      if (!vivo) return;
      setLista(l);
      setCargando(false);
    });
    return () => { vivo = false; };
  }, []);
  const [alta, setAlta] = useState(false);
  const [form, setForm] = useState({ empresa: "", contacto: "", correo: "", telefono: "" });

  const crear = () => {
    if (!form.empresa) return;
    const nuevo = {
      id: `MOR-2026-${String(1000 + lista.length).slice(-4)}`,
      empresa: form.empresa, contacto: form.contacto, correo: form.correo, telefono: form.telefono,
      plan: "Por evento", saldo: 0, porPagar: 0, estatus: "activo",
    };
    setLista((l) => [nuevo, ...l]);
    setForm({ empresa: "", contacto: "", correo: "", telefono: "" });
    setAlta(false);
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
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flex: 1 }}>
          <Text style={s.h1}>Clientes</Text>
          <Text style={s.sub}>{lista.length} cuentas registradas.</Text>
        </View>
        <Pressable onPress={() => setAlta((v) => !v)} style={s.btnAlta}>
          <Feather name={alta ? "x" : "user-plus"} size={16} color="#0d1211" />
          <Text style={s.btnAltaTxt}>{alta ? "Cerrar" : "Alta"}</Text>
        </Pressable>
      </View>

      {alta && (
        <Tarjeta style={{ marginTop: 14 }}>
          <TituloTarjeta>Alta de cliente</TituloTarjeta>
          <Campo label="Empresa" v={form.empresa} on={(v) => setForm({ ...form, empresa: v })} />
          <Campo label="Contacto" v={form.contacto} on={(v) => setForm({ ...form, contacto: v })} />
          <Campo label="Correo" v={form.correo} on={(v) => setForm({ ...form, correo: v })} kb="email-address" />
          <Campo label="Teléfono" v={form.telefono} on={(v) => setForm({ ...form, telefono: v })} kb="phone-pad" />
          <Boton onPress={crear} disabled={!form.empresa} style={{ marginTop: 12 }}>Registrar cliente</Boton>
        </Tarjeta>
      )}

      <View style={{ marginTop: 14 }}>
        {lista.map((c) => (
          <Tarjeta key={c.id} style={{ padding: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <Text style={s.empresa}>{c.empresa}</Text>
                <Text style={s.contacto}>{c.contacto} · {c.plan}</Text>
                <Text style={s.saldos}>Saldo {pesos(c.saldo)} · Por pagar {c.porPagar ? pesos(c.porPagar) : "—"}</Text>
              </View>
              <Badge clase={c.estatus === "activo" ? "ok" : "none"}>{c.estatus === "activo" ? "Activo" : "Moroso"}</Badge>
            </View>
          </Tarjeta>
        ))}
      </View>
    </ScrollView>
  );
}

function Campo({ label, v, on, kb }) {
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput style={s.input} value={v} onChangeText={on} keyboardType={kb || "default"} autoCapitalize={kb === "email-address" ? "none" : "sentences"} placeholderTextColor={T.grisClaro} />
    </View>
  );
}

const s = StyleSheet.create({
  h1: { color: T.tinta, fontSize: 22, fontWeight: "800" },
  sub: { color: T.gris, fontSize: 13.5, marginTop: 3 },
  btnAlta: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: T.verde, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  btnAltaTxt: { color: "#0d1211", fontWeight: "700", fontSize: 13.5 },
  label: { color: T.tinta, fontSize: 12.5, fontWeight: "700", marginBottom: 6 },
  input: { backgroundColor: T.panel2, borderWidth: 1, borderColor: T.linea, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, color: T.tinta, fontSize: 14 },
  empresa: { color: T.tinta, fontSize: 14.5, fontWeight: "700" },
  contacto: { color: T.gris, fontSize: 12.5, marginTop: 2 },
  saldos: { color: T.grisClaro, fontSize: 12, marginTop: 4 },
});
