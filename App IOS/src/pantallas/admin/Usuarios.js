import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, RefreshControl, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "../../tema";
import { Tarjeta, TituloTarjeta, Badge } from "../../ui";
import {
  listarEquipo,
  invitarUsuario,
  cambiarActivoUsuario,
  quienSoy,
  ROLES_INVITABLES,
  ROLES_LEGIBLES,
  puedeDarRol,
  puedeCambiarActivo,
  pareceCorreo,
} from "../../datos-cuentas";
import { useLista, atenderSegundoPaso, Chip, Aviso, ErrorCarga, Campo, Accion, estilosCuentas as e } from "./piezas-cuentas";

// Los roles que EXISTEN en la base: dueno, admin, operador.
const ROLES_REALES = [
  { id: "dueno", detalle: "Acceso total al panel, la app y la administración de usuarios. No se invita." },
  { id: "admin", detalle: "Solicitudes, clientes, servicios, saldos y reportes. Sólo el dueño da o quita este acceso." },
  { id: "operador", detalle: "App del chofer: su ruta, el QR del contenedor y la evidencia de cada recolección." },
];
const CLASE_ROL = { dueno: "ruta", admin: "prog", operador: "ok" };
const VACIO = { nombre: "", correo: "", rol: "operador" };

/**
 * USUARIOS Y ROLES (6-oct-2026, paridad con /admin/usuarios): el equipo,
 * "Invitar usuario" (le llega un correo para escoger su contraseña) y
 * desactivar o reactivar. Las reglas son las del panel: el dueño invita
 * administradores y choferes, un administrador sólo choferes; al dueño y a
 * uno mismo no se les desactiva. El servidor las vuelve a aplicar.
 */
export default function Usuarios({ navigation }) {
  const { lista, setLista, cargando, refrescando, errorCarga, recargar } = useLista(listarEquipo);
  const [yo, setYo] = useState(null);
  const [alta, setAlta] = useState(false);
  const [form, setForm] = useState(VACIO);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState(null); // { tipo, texto }
  const [cambiando, setCambiando] = useState("");
  const [errorFila, setErrorFila] = useState({}); // { [id]: motivo }

  useEffect(() => {
    let vivo = true;
    quienSoy().then((q) => { if (vivo) setYo(q); });
    return () => { vivo = false; };
  }, []);

  // El administrador no ve "Administrador" entre los roles que puede dar.
  const rolesQuePuedo = Object.keys(ROLES_INVITABLES).filter((r) => puedeDarRol(yo, r));

  const invitar = async () => {
    setAviso(null);
    if (!form.nombre.trim()) { setAviso({ tipo: "error", texto: "Escribe el nombre completo." }); return; }
    if (!pareceCorreo(form.correo)) { setAviso({ tipo: "error", texto: "Ese correo no parece válido." }); return; }
    setEnviando(true);
    const r = await invitarUsuario(form);
    setEnviando(false);
    if (atenderSegundoPaso(r, navigation)) return;
    if (!r.ok) { setAviso({ tipo: "error", texto: r.motivo || "No se pudo mandar la invitación." }); return; }
    setAviso({
      tipo: "ok",
      texto: `Listo: a ${r.correo || form.correo} le llegó la invitación como ${ROLES_INVITABLES[form.rol]}. Escoge su contraseña con el enlace del correo.`,
    });
    setForm(VACIO);
    setAlta(false);
    recargar();
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
          <Text style={e.h1}>Usuarios y roles</Text>
          <Text style={[e.sub, { marginBottom: 0 }]}>Tu equipo y sus permisos.</Text>
        </View>
        {rolesQuePuedo.length > 0 && (
          <Pressable
            onPress={() => { setAlta((v) => !v); setAviso(null); }}
            style={s.btnAlta}
            accessibilityRole="button"
            accessibilityLabel={alta ? "Cerrar la invitación" : "Invitar usuario"}
          >
            <Feather name={alta ? "x" : "user-plus"} size={16} color="#fff" />
            <Text style={s.btnAltaTxt}>{alta ? "Cerrar" : "Invitar"}</Text>
          </Pressable>
        )}
      </View>

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
          <Text style={s.label}>Rol</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {rolesQuePuedo.map((r) => (
              <Chip key={r} on={form.rol === r} onPress={() => setForm({ ...form, rol: r })}>{ROLES_INVITABLES[r]}</Chip>
            ))}
          </View>
          {!rolesQuePuedo.includes("admin") && (
            <Text style={s.nota}>Sólo el dueño puede dar acceso de administrador.</Text>
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
        {!cargando && errorCarga && <ErrorCarga que="el equipo" onReintentar={() => recargar()} />}
        {lista.map((u, i) => {
          const evaluado = puedeCambiarActivo({ quien: yo, objetivo: u });
          return (
            <View key={u.id} style={[s.uFila, i < lista.length - 1 && s.borde]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.uNom}>{u.nombre}{yo?.id === u.id ? " (tú)" : ""}</Text>
                  <Text style={s.uLinea}>{u.telefono || "Sin teléfono registrado"}</Text>
                  <View style={{ flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    <Badge clase={CLASE_ROL[u.rol] || "none"}>{ROLES_LEGIBLES[u.rol] || u.rol}</Badge>
                    <Badge clase={u.activo ? "ok" : "none"}>{u.activo ? "Activo" : "Inactivo"}</Badge>
                  </View>
                </View>
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
              {!!errorFila[u.id] && <Aviso tipo="error">{errorFila[u.id]}</Aviso>}
            </View>
          );
        })}
      </Tarjeta>

      <Tarjeta>
        <TituloTarjeta>Roles</TituloTarjeta>
        {ROLES_REALES.map((r) => (
          <View key={r.id} style={s.rFila}>
            <View style={s.rIco}><Feather name="shield" size={15} color={T.tealClaro} /></View>
            <View style={{ flex: 1 }}><Text style={s.rNom}>{ROLES_LEGIBLES[r.id]}</Text><Text style={s.rDet}>{r.detalle}</Text></View>
          </View>
        ))}
      </Tarjeta>
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
  btnFila: { borderWidth: 1, borderColor: T.linea, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, minHeight: 44, justifyContent: "center" },
  btnFilaTxt: { fontSize: 13, fontWeight: "700" },
  rFila: { flexDirection: "row", gap: 10, paddingVertical: 8 },
  rIco: { width: 32, height: 32, borderRadius: 9, backgroundColor: "rgba(79,192,197,0.14)", alignItems: "center", justifyContent: "center" },
  rNom: { color: T.tinta, fontSize: 13.5, fontWeight: "700" },
  rDet: { color: T.gris, fontSize: 12, marginTop: 2, lineHeight: 17 },
});
