import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, TextInput } from "react-native";
import { T } from "../../tema";
import { Tarjeta, TituloTarjeta, Boton } from "../../ui";
import CampoClave from "../../CampoClave";
import AvisoResultado from "../../AvisoResultado";
import { miPerfil, guardarMiPerfil, cambiarMiContrasena } from "../../datos-cliente-100";
import { ADMIN_PERFIL } from "../../datos-admin";
import { CHOFER_PERFIL } from "../../datos-chofer";
import { CLIENTE } from "../../datos";

const DEMO = {
  admin: { nombre: ADMIN_PERFIL.nombre, telefono: "", correo: ADMIN_PERFIL.correo },
  chofer: { nombre: CHOFER_PERFIL.nombre, telefono: CHOFER_PERFIL.telefono, correo: CHOFER_PERFIL.correo },
  cliente: { nombre: CLIENTE.contacto, telefono: CLIENTE.telefono, correo: CLIENTE.correo },
};

/**
 * MIS DATOS Y MI CONTRASEÑA (apps al 100%, fases B y C) — lo mismo que
 * `components/cuenta/MiCuenta` de la web, para el cliente, el personal y el
 * chofer. Cada quien cambia SU nombre, SU teléfono y SU contraseña sin
 * pedírselo a nadie.
 *
 *  · Nombre y teléfono: directo con la sesión (`perfiles_edita_el_suyo`).
 *  · Contraseña: con la ACTUAL, por la web (`cuenta-contrasena`; el dueño y
 *    los administradores, con el pase del segundo paso). Al cambiarla se
 *    cierran las sesiones de los OTROS aparatos; esta sigue.
 *  · Quien entra solo con Google o Apple no tiene contraseña: no se ofrece.
 *
 * `modo`: "cliente" | "admin" | "chofer".
 */
export function DatosYContrasena({ modo }) {
  const [perfil, setPerfil] = useState(null);
  const [carga, setCarga] = useState(null); // respuesta fallida al leer
  const [form, setForm] = useState({ nombre: "", telefono: "" });
  const [guardando, setGuardando] = useState(false);
  const [resDatos, setResDatos] = useState(null); // { ok, motivo, sinRed }
  const [clave, setClave] = useState({ actual: "", nueva: "", repetir: "" });
  const [cambiando, setCambiando] = useState(false);
  const [resClave, setResClave] = useState(null);

  const cargar = useCallback(async () => {
    setCarga(null);
    const r = await miPerfil(DEMO[modo]);
    if (!r.ok) { setCarga(r); return; }
    setPerfil(r);
    setForm({ nombre: r.nombre || "", telefono: r.telefono || "" });
  }, [modo]);
  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async () => {
    if (guardando) return;
    setGuardando(true);
    setResDatos(null);
    const r = await guardarMiPerfil(form);
    setGuardando(false);
    setResDatos(r);
    if (r.ok && r.limpio) setForm({ nombre: r.limpio.nombre, telefono: r.limpio.telefono || "" });
  };

  const cambiarClave = async () => {
    if (cambiando) return;
    setCambiando(true);
    setResClave(null);
    const r = await cambiarMiContrasena({ modo, ...clave });
    setCambiando(false);
    setResClave(r);
    if (r.ok) setClave({ actual: "", nueva: "", repetir: "" });
  };

  if (!perfil) {
    return (
      <Tarjeta>
        <TituloTarjeta>Mis datos</TituloTarjeta>
        {carga ? <AvisoResultado r={carga} onReintentar={cargar} style={{ marginTop: 0 }} /> : <Text style={s.nota}>Leyendo tus datos…</Text>}
        {carga && !carga.sinRed ? <Boton variante="linea" onPress={cargar} style={{ marginTop: 10 }}>Reintentar</Boton> : null}
      </Tarjeta>
    );
  }

  return (
    <>
      <Tarjeta>
        <TituloTarjeta>Mis datos</TituloTarjeta>
        {!!perfil.correo && <Text style={s.nota}>Entras con <Text style={s.fuerte}>{perfil.correo}</Text></Text>}
        <Text style={s.label}>Nombre</Text>
        <TextInput
          style={s.input}
          value={form.nombre}
          onChangeText={(v) => { setForm((f) => ({ ...f, nombre: v })); setResDatos(null); }}
          placeholderTextColor={T.grisClaro}
          accessibilityLabel="Nombre"
        />
        <Text style={s.label}>Teléfono (10 dígitos)</Text>
        <TextInput
          style={s.input}
          value={form.telefono}
          onChangeText={(v) => { setForm((f) => ({ ...f, telefono: v })); setResDatos(null); }}
          keyboardType="phone-pad"
          placeholder="868 000 0000"
          placeholderTextColor={T.grisClaro}
          accessibilityLabel="Teléfono"
        />
        <Boton onPress={guardar} disabled={guardando} style={{ marginTop: 14 }}>{guardando ? "Guardando…" : "Guardar mis datos"}</Boton>
        {resDatos?.ok ? <Text style={s.ok}>{resDatos.demo ? "Listo (en la demostración no se guarda)." : "Guardado."}</Text> : null}
        <AvisoResultado r={resDatos} onReintentar={guardar} />
      </Tarjeta>

      {perfil.tieneContrasena ? (
        <Tarjeta>
          <TituloTarjeta>Cambiar mi contraseña</TituloTarjeta>
          <Text style={s.nota}>Te pedimos la actual para que nadie más la cambie con tu teléfono abierto. Al cambiarla se cierran tus sesiones en otros aparatos.</Text>
          <Text style={s.label}>Contraseña actual</Text>
          <CampoClave style={s.input} value={clave.actual} onChangeText={(v) => { setClave((c) => ({ ...c, actual: v })); setResClave(null); }} placeholder="Tu contraseña de hoy" />
          <Text style={s.label}>Contraseña nueva (mínimo 8)</Text>
          <CampoClave style={s.input} value={clave.nueva} onChangeText={(v) => { setClave((c) => ({ ...c, nueva: v })); setResClave(null); }} placeholder="Nueva contraseña" />
          <Text style={s.label}>Repite la nueva</Text>
          <CampoClave style={s.input} value={clave.repetir} onChangeText={(v) => { setClave((c) => ({ ...c, repetir: v })); setResClave(null); }} placeholder="Otra vez la nueva" onSubmitEditing={cambiarClave} />
          <Boton onPress={cambiarClave} disabled={cambiando || !clave.actual || !clave.nueva} style={{ marginTop: 14 }}>
            {cambiando ? "Cambiando…" : "Cambiar contraseña"}
          </Boton>
          {resClave?.ok ? <Text style={s.ok}>{resClave.demo ? "Listo (en la demostración no se cambia)." : "Listo: tu contraseña cambió. Te mandamos un correo de aviso."}</Text> : null}
          <AvisoResultado r={resClave} onReintentar={cambiarClave} />
        </Tarjeta>
      ) : (
        <Tarjeta>
          <TituloTarjeta>Contraseña</TituloTarjeta>
          <Text style={s.nota}>Entras con Google o Apple, así que no tienes contraseña de Morcast que cambiar.</Text>
        </Tarjeta>
      )}
    </>
  );
}

/** La pantalla "Mi cuenta" del personal y del chofer. */
export default function MiCuenta({ route }) {
  const modo = route?.params?.modo || "admin";
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: T.fondo }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
    >
      <Text style={s.h1}>Mi cuenta</Text>
      <Text style={s.sub}>Tu nombre, tu teléfono y tu contraseña.</Text>
      <View>
        <DatosYContrasena modo={modo} />
      </View>
    </ScrollView>
  );
}

export const estilosMiCuenta = StyleSheet.create({
  label: { color: T.tinta, fontSize: 12.5, fontWeight: "700", marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: T.panel2, borderWidth: 1, borderColor: T.linea, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, color: T.tinta, fontSize: 14.5, minHeight: 46 },
  nota: { color: T.gris, fontSize: 12.5, lineHeight: 18 },
});

const s = StyleSheet.create({
  ...estilosMiCuenta,
  h1: { color: T.tinta, fontSize: 22, fontWeight: "800" },
  sub: { color: T.gris, fontSize: 13.5, marginTop: 3, marginBottom: 14 },
  fuerte: { color: T.tinta, fontWeight: "700" },
  ok: { color: T.ok, fontSize: 13, marginTop: 10, lineHeight: 18 },
});
