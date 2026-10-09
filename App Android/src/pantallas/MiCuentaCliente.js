import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, TextInput, Pressable, RefreshControl } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "../tema";
import { Tarjeta, TituloTarjeta, Boton } from "../ui";
import AvisoResultado from "../AvisoResultado";
import TarjetaSoporte, { AvisoSuspendido, TELEFONO_SOPORTE } from "../TarjetaSoporte";
import { DatosYContrasena, estilosMiCuenta } from "./comun/MiCuenta";
import { cuentaCliente, guardarDatosCliente } from "../datos-cliente-100";
import { useEstadoCliente } from "../estado-cliente-app";
import { mensajeCambioFiscal } from "../web/cuenta-cliente.mjs";
import { lineaDePunto } from "../cliente-app.mjs";
import { abrirWhatsApp } from "../whatsapp";

/**
 * MI CUENTA DEL CLIENTE (apps al 100%, fase B), como /portal/cuenta:
 *
 *   · mis datos y mi contraseña (lo mismo que el personal);
 *   · el contacto, el teléfono y el CORREO DE AVISOS de la empresa — ahí le
 *     llegan las confirmaciones y los avisos de Morcast;
 *   · sus puntos, solo para verlos;
 *   · razón social y RFC: son datos fiscales y se PIDEN a Morcast por
 *     WhatsApp (la base tampoco le deja editar su ficha);
 *   · "¿Necesitas ayuda?".
 *
 * "Eliminar mi cuenta" se quedó en Más, donde ya estaba (Apple 5.1.1(v)).
 * Suspendida: lo de la empresa queda de solo lectura, con el motivo.
 */
export default function MiCuentaCliente() {
  const est = useEstadoCliente();
  const [datos, setDatos] = useState(null);
  const [carga, setCarga] = useState(null);
  const [form, setForm] = useState({ contacto: "", telefono: "", correo: "" });
  const [guardando, setGuardando] = useState(false);
  const [res, setRes] = useState(null);
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    setCarga(null);
    const r = await cuentaCliente();
    if (!r?.ok) { setCarga(r || { ok: false }); return; }
    setDatos(r);
    setForm({ contacto: r.empresa?.contacto || "", telefono: r.empresa?.telefono || "", correo: r.empresa?.correo || "" });
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const refrescar = async () => {
    setRefrescando(true);
    try { await cargar(); } finally { setRefrescando(false); }
  };

  const guardar = async () => {
    if (guardando) return;
    setGuardando(true);
    setRes(null);
    const r = await guardarDatosCliente(form);
    setGuardando(false);
    setRes(r);
  };

  const empresa = datos?.empresa;
  // El estado de la ficha manda; si todavía no llega, el de la sesión.
  const suspendida = (empresa?.estado || est.estado) === "suspendido";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: T.fondo }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={T.gris} />}
    >
      {est.suspendido && <AvisoSuspendido empresa={est.empresa} folio={est.folio} />}
      <Text style={s.h1}>Mi cuenta</Text>
      <Text style={s.sub}>Tus datos, los de tu empresa y tus puntos de recolección.</Text>

      <DatosYContrasena modo="cliente" />

      {!empresa ? (
        <Tarjeta>
          <TituloTarjeta>Tu empresa</TituloTarjeta>
          {carga ? (
            <>
              <AvisoResultado r={carga} onReintentar={cargar} style={{ marginTop: 0 }} />
              {!carga.sinRed && <Boton variante="linea" onPress={cargar} style={{ marginTop: 10 }}>Reintentar</Boton>}
            </>
          ) : (
            <Text style={s.nota}>Leyendo los datos de tu empresa…</Text>
          )}
        </Tarjeta>
      ) : (
        <>
          <Tarjeta>
            <TituloTarjeta>Datos de contacto de {empresa.empresa}</TituloTarjeta>
            {suspendida ? (
              <>
                <Text style={s.nota}>Tu cuenta está suspendida: por ahora no puedes cambiar estos datos. Contáctanos al {TELEFONO_SOPORTE}.</Text>
                <Dato k="Persona de contacto" v={empresa.contacto} />
                <Dato k="Teléfono" v={empresa.telefono} />
                <Dato k="Correo para avisos" v={empresa.correo} />
              </>
            ) : (
              <>
                <Text style={s.label}>Persona de contacto</Text>
                <TextInput style={s.input} value={form.contacto} onChangeText={(v) => { setForm((f) => ({ ...f, contacto: v })); setRes(null); }} accessibilityLabel="Persona de contacto" />
                <Text style={s.label}>Teléfono (10 dígitos)</Text>
                <TextInput style={s.input} value={form.telefono} keyboardType="phone-pad" onChangeText={(v) => { setForm((f) => ({ ...f, telefono: v })); setRes(null); }} accessibilityLabel="Teléfono de la empresa" />
                <Text style={s.label}>Correo para avisos</Text>
                <TextInput
                  style={s.input}
                  value={form.correo}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onChangeText={(v) => { setForm((f) => ({ ...f, correo: v })); setRes(null); }}
                  accessibilityLabel="Correo para avisos"
                />
                <Boton onPress={guardar} disabled={guardando} style={{ marginTop: 14 }}>{guardando ? "Guardando…" : "Guardar"}</Boton>
                {res?.ok ? <Text style={s.ok}>{res.demo ? "Listo (en la demostración no se guarda)." : "Guardado. Los avisos te llegarán a ese correo."}</Text> : null}
                <AvisoResultado r={res} onReintentar={guardar} />
              </>
            )}

            <View style={s.fiscal}>
              <Text style={s.nota}>
                Razón social: <Text style={s.fuerte}>{empresa.empresa}</Text>{"  ·  "}RFC: <Text style={s.fuerte}>{empresa.rfc || "—"}</Text>
              </Text>
              <Pressable
                onPress={() => abrirWhatsApp(TELEFONO_SOPORTE, mensajeCambioFiscal(empresa))}
                style={({ pressed }) => [s.btnLinea, { opacity: pressed ? 0.85 : 1 }]}
                accessibilityRole="button"
              >
                <Feather name="message-circle" size={15} color={T.tinta} />
                <Text style={s.btnLineaTxt}>Pedir un cambio de razón social o RFC</Text>
              </Pressable>
            </View>
          </Tarjeta>

          <Tarjeta>
            <TituloTarjeta>Mis puntos de recolección</TituloTarjeta>
            {(datos.puntos || []).length === 0 ? (
              <Text style={s.nota}>Todavía no tienes puntos registrados.</Text>
            ) : (
              datos.puntos.map((p, i) => (
                <View key={p.id} style={[s.punto, i > 0 && s.borde]}>
                  <Feather name="map-pin" size={16} color={T.gris} style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.fuerte}>{p.alias}</Text>
                    <Text style={s.nota}>{p.direccion || "Sin dirección"}</Text>
                    <Text style={s.nota}>{lineaDePunto(p)}</Text>
                  </View>
                </View>
              ))
            )}
          </Tarjeta>
        </>
      )}

      <TarjetaSoporte empresa={empresa?.empresa || est.empresa} folio={empresa?.folio || est.folio} />
    </ScrollView>
  );
}

function Dato({ k, v }) {
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={s.nota}>{k}</Text>
      <Text style={[s.fuerte, { marginTop: 2 }]}>{v || "—"}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  ...estilosMiCuenta,
  h1: { color: T.tinta, fontSize: 22, fontWeight: "800" },
  sub: { color: T.gris, fontSize: 13.5, marginTop: 3, marginBottom: 14 },
  fuerte: { color: T.tinta, fontWeight: "700", fontSize: 13.5 },
  ok: { color: T.ok, fontSize: 13, marginTop: 10, lineHeight: 18 },
  fiscal: { borderTopWidth: 1, borderTopColor: T.linea, marginTop: 16, paddingTop: 12 },
  btnLinea: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", marginTop: 10, minHeight: 42, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: T.linea },
  btnLineaTxt: { color: T.tinta, fontSize: 13, fontWeight: "700" },
  punto: { flexDirection: "row", gap: 10, paddingVertical: 10 },
  borde: { borderTopWidth: 1, borderTopColor: T.linea },
});
