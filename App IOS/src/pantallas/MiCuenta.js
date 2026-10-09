import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, TextInput, Pressable, RefreshControl } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "../tema";
import { Tarjeta, TituloTarjeta, Boton } from "../ui";
import CampoClave from "../CampoClave";
import { abrirWhatsApp } from "../whatsapp";
import { EMPRESA_COTIZACION } from "../cotizacion-datos";
import {
  miPerfilPropio, guardarMiPerfil, cambiarMiContrasena, cuentaCliente, guardarCuentaCliente,
} from "../datos-cuenta";
import { mensajeCambioFiscal } from "../web/cuenta-cliente.mjs";
import { useEstadoCliente } from "../estado-cliente-app";
import { TarjetaSoporte, Fallo, falloDe, Listo } from "../piezas-100";

/**
 * MI CUENTA (9-oct-2026, apps al 100%). La misma pantalla para los tres:
 *   · `modo="cliente"` (desde Más): sus datos, su contraseña, los datos de
 *     contacto de su empresa, sus puntos (de lectura) y "pedir cambio de
 *     razón social o RFC" — lo fiscal se PIDE, no se edita (db/002);
 *   · `modo="admin"` (Más de la administración) y `modo="chofer"` (botón de
 *     su ruta): nombre, teléfono y contraseña.
 *
 * Cada quien SOLO lo suyo: el perfil se escribe con la sesión
 * (`perfiles_edita_el_suyo`), la contraseña y la empresa por el servidor.
 * Quien entra solo con Google o Apple no ve "contraseña": no tiene una.
 */
export default function MiCuenta({ route, modo: modoProp }) {
  const modo = modoProp || route?.params?.modo || "cliente";
  const esCliente = modo === "cliente";

  /* ---------------------------------------------------------- mi perfil */
  const [perfil, setPerfil] = useState(null);
  const [falloPerfil, setFalloPerfil] = useState(null);
  const [form, setForm] = useState({ nombre: "", telefono: "" });
  const [guardando, setGuardando] = useState(false);
  const [avisoPerfil, setAvisoPerfil] = useState({ ok: "", fallo: null });
  const [refrescando, setRefrescando] = useState(false);

  /* --------------------------------------------------------- contraseña */
  const [clave, setClave] = useState({ actual: "", nueva: "", repetir: "" });
  const [cambiandoClave, setCambiandoClave] = useState(false);
  const [avisoClave, setAvisoClave] = useState({ ok: "", fallo: null });

  /* ---------------------------------------------------- empresa (cliente) */
  const [cuenta, setCuenta] = useState(null);
  const [falloCuenta, setFalloCuenta] = useState(null);
  const [empresaForm, setEmpresaForm] = useState(null);
  const [guardandoEmpresa, setGuardandoEmpresa] = useState(false);
  const [avisoEmpresa, setAvisoEmpresa] = useState({ ok: "", fallo: null });
  const { puedeOperar, motivoEstado } = useEstadoCliente();

  const leerPerfil = useCallback(async () => {
    const r = await miPerfilPropio();
    if (!r.ok) { setFalloPerfil(falloDe(r)); return; }
    setFalloPerfil(null);
    setPerfil(r);
    setForm({ nombre: r.nombre || "", telefono: r.telefono || "" });
  }, []);

  const leerCuenta = useCallback(async () => {
    if (!esCliente) return;
    const r = await cuentaCliente();
    if (!r.ok) { setFalloCuenta(falloDe(r)); return; }
    setFalloCuenta(null);
    setCuenta(r);
    setEmpresaForm({ contacto: r.empresa?.contacto || "", telefono: r.empresa?.telefono || "", correo: r.empresa?.correo || "" });
  }, [esCliente]);

  useEffect(() => { leerPerfil(); leerCuenta(); }, [leerPerfil, leerCuenta]);

  const refrescar = async () => {
    setRefrescando(true);
    try { await Promise.all([leerPerfil(), leerCuenta()]); } finally { setRefrescando(false); }
  };

  const guardarPerfil = async () => {
    if (guardando) return;
    setGuardando(true);
    setAvisoPerfil({ ok: "", fallo: null });
    const r = await guardarMiPerfil(form);
    setGuardando(false);
    if (!r.ok) { setAvisoPerfil({ ok: "", fallo: falloDe(r) }); return; }
    setAvisoPerfil({ ok: r.demo ? "Listo (demostración: no se guarda en la base)." : "Guardado.", fallo: null });
    if (r.limpio) setForm({ nombre: r.limpio.nombre, telefono: r.limpio.telefono || "" });
  };

  const guardarClave = async () => {
    if (cambiandoClave) return;
    setCambiandoClave(true);
    setAvisoClave({ ok: "", fallo: null });
    // El personal (dueño/admin) la cambia con el pase del segundo paso.
    const r = await cambiarMiContrasena(clave, { personal: modo === "admin" });
    setCambiandoClave(false);
    if (!r.ok) { setAvisoClave({ ok: "", fallo: falloDe(r) }); return; }
    setClave({ actual: "", nueva: "", repetir: "" });
    setAvisoClave({
      ok: r.demo ? "Listo (demostración: no se cambió nada)." : "Listo: tu contraseña cambió. Te mandamos un correo y se cerraron tus otras sesiones.",
      fallo: null,
    });
  };

  const guardarEmpresa = async () => {
    if (guardandoEmpresa || !empresaForm) return;
    setGuardandoEmpresa(true);
    setAvisoEmpresa({ ok: "", fallo: null });
    const r = await guardarCuentaCliente(empresaForm);
    setGuardandoEmpresa(false);
    if (!r.ok) { setAvisoEmpresa({ ok: "", fallo: falloDe(r) }); return; }
    setAvisoEmpresa({ ok: r.demo ? "Listo (demostración: no se guarda en la base)." : "Guardado. Los avisos te llegan a ese correo.", fallo: null });
    leerCuenta();
  };

  const empresa = cuenta?.empresa || null;
  const pedirCambioFiscal = () =>
    abrirWhatsApp(EMPRESA_COTIZACION.telefonos[0], mensajeCambioFiscal({ empresa: empresa?.empresa, folio: empresa?.folio }));

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: T.fondo }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={T.gris} />}
    >
      <Text style={s.h1}>Mi cuenta</Text>
      <Text style={s.sub}>{perfil?.correo ? `Entras con ${perfil.correo}.` : "Tus datos y tu contraseña."}</Text>

      {/* ------------------------------------------------ mis datos */}
      <Tarjeta>
        <TituloTarjeta>Mis datos</TituloTarjeta>
        <Fallo fallo={falloPerfil} onReintentar={leerPerfil} style={{ marginTop: 0, marginBottom: 8 }} />
        <Campo etiqueta="Nombre" valor={form.nombre} onCambio={(v) => setForm((f) => ({ ...f, nombre: v }))} autoCapitalize="words" />
        <Campo etiqueta="Teléfono (10 dígitos)" valor={form.telefono} onCambio={(v) => setForm((f) => ({ ...f, telefono: v }))} keyboardType="phone-pad" />
        <Fallo fallo={avisoPerfil.fallo} onReintentar={guardarPerfil} />
        <Boton onPress={guardarPerfil} disabled={guardando || !perfil} style={{ marginTop: 14 }}>
          {guardando ? "Guardando…" : "Guardar mis datos"}
        </Boton>
        {avisoPerfil.ok ? <View style={{ marginTop: 12 }}><Listo>{avisoPerfil.ok}</Listo></View> : null}
      </Tarjeta>

      {/* ------------------------------------------------ contraseña */}
      {perfil && perfil.tieneContrasena ? (
        <Tarjeta>
          <TituloTarjeta>Contraseña</TituloTarjeta>
          <Text style={s.nota}>Te pedimos la actual para que nadie con tu teléfono desbloqueado pueda cambiarla.</Text>
          <Text style={s.label}>Contraseña actual</Text>
          <CampoClave style={s.input} value={clave.actual} onChangeText={(v) => setClave((c) => ({ ...c, actual: v }))} />
          <Text style={s.label}>Nueva (mínimo 8 caracteres)</Text>
          <CampoClave style={s.input} value={clave.nueva} onChangeText={(v) => setClave((c) => ({ ...c, nueva: v }))} />
          <Text style={s.label}>Repite la nueva</Text>
          <CampoClave style={s.input} value={clave.repetir} onChangeText={(v) => setClave((c) => ({ ...c, repetir: v }))} onSubmitEditing={guardarClave} />
          <Fallo fallo={avisoClave.fallo} onReintentar={guardarClave} />
          <Boton onPress={guardarClave} disabled={cambiandoClave || !clave.actual || !clave.nueva} style={{ marginTop: 14 }}>
            {cambiandoClave ? "Cambiando…" : "Cambiar contraseña"}
          </Boton>
          {avisoClave.ok ? <View style={{ marginTop: 12 }}><Listo>{avisoClave.ok}</Listo></View> : null}
        </Tarjeta>
      ) : perfil ? (
        <Tarjeta>
          <TituloTarjeta>Contraseña</TituloTarjeta>
          <Text style={s.nota}>Entras con Google o con Apple: no tienes contraseña de Morcast que cambiar.</Text>
        </Tarjeta>
      ) : null}

      {/* ------------------------------------------------ la empresa (cliente) */}
      {esCliente ? (
        <>
          <Tarjeta>
            <TituloTarjeta>Datos de contacto de tu empresa</TituloTarjeta>
            <Fallo fallo={falloCuenta} onReintentar={leerCuenta} style={{ marginTop: 0, marginBottom: 8 }} />
            {empresa ? (
              <>
                <Dato k="Empresa" v={empresa.empresa} />
                <Dato k="Cliente" v={empresa.folio} />
                <Dato k="RFC" v={empresa.rfc || "—"} />
              </>
            ) : !falloCuenta ? <Text style={s.nota}>Leyendo los datos de tu empresa…</Text> : null}

            {empresa && !puedeOperar ? (
              // Suspendida: solo ver y agregar saldo (db/028).
              <View style={s.bloqueo}>
                <Feather name="lock" size={15} color={T.error} style={{ marginTop: 1 }} />
                <Text style={s.bloqueoTxt}>
                  Tu cuenta está suspendida: por ahora no puedes cambiar estos datos. Contáctanos.
                  {motivoEstado ? `\nMotivo: ${motivoEstado}` : ""}
                </Text>
              </View>
            ) : null}

            {empresaForm ? (
              <>
                <Campo etiqueta="Persona de contacto" valor={empresaForm.contacto} editable={puedeOperar} onCambio={(v) => setEmpresaForm((f) => ({ ...f, contacto: v }))} />
                <Campo etiqueta="Teléfono (10 dígitos)" valor={empresaForm.telefono} editable={puedeOperar} keyboardType="phone-pad" onCambio={(v) => setEmpresaForm((f) => ({ ...f, telefono: v }))} />
                <Campo etiqueta="Correo para avisos" valor={empresaForm.correo} editable={puedeOperar} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} onCambio={(v) => setEmpresaForm((f) => ({ ...f, correo: v }))} />
                <Fallo fallo={avisoEmpresa.fallo} onReintentar={guardarEmpresa} />
                {puedeOperar ? (
                  <Boton onPress={guardarEmpresa} disabled={guardandoEmpresa} style={{ marginTop: 14 }}>
                    {guardandoEmpresa ? "Guardando…" : "Guardar contacto"}
                  </Boton>
                ) : null}
                {avisoEmpresa.ok ? <View style={{ marginTop: 12 }}><Listo>{avisoEmpresa.ok}</Listo></View> : null}
              </>
            ) : null}

            {/* La razón social y el RFC son fiscales: se le piden a Morcast. */}
            {empresa ? (
              <Pressable onPress={pedirCambioFiscal} style={s.enlace} accessibilityRole="button">
                <Feather name="message-circle" size={15} color={T.accionTxt} />
                <Text style={s.enlaceTxt}>Pedir cambio de razón social o RFC</Text>
              </Pressable>
            ) : null}
          </Tarjeta>

          <Tarjeta>
            <TituloTarjeta>Mis puntos de recolección</TituloTarjeta>
            {!cuenta ? (
              <Text style={s.nota}>{falloCuenta ? "No se pudieron leer." : "Leyendo tus puntos…"}</Text>
            ) : cuenta.puntos?.length ? (
              cuenta.puntos.map((p, i) => (
                <View key={p.id} style={[s.punto, i > 0 && s.borde]}>
                  <Feather name="map-pin" size={16} color={T.gris} style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.puntoTit}>{p.alias}{p.pausado ? " · en pausa" : ""}</Text>
                    {p.direccion ? <Text style={s.nota}>{p.direccion}</Text> : null}
                    <Text style={s.nota}>
                      {p.ruta ? `${p.ruta}${(p.dias || []).length ? ` · ${p.dias.join(", ")}` : ""}` : "Sin ruta asignada"}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={s.nota}>Todavía no tienes puntos registrados. Para agregar uno, escríbenos.</Text>
            )}
          </Tarjeta>

          <TarjetaSoporte empresa={empresa?.empresa} folio={empresa?.folio} />
        </>
      ) : null}
    </ScrollView>
  );
}

function Campo({ etiqueta, valor, onCambio, editable = true, ...props }) {
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={s.label}>{etiqueta}</Text>
      <TextInput
        {...props}
        value={valor}
        onChangeText={onCambio}
        editable={editable}
        style={[s.input, !editable && { opacity: 0.6 }]}
        placeholderTextColor={T.grisClaro}
        accessibilityLabel={etiqueta}
      />
    </View>
  );
}

function Dato({ k, v }) {
  return (
    <View style={s.datoFila}>
      <Text style={s.datoK}>{k}</Text>
      <Text style={s.datoV} selectable>{v || "—"}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  h1: { color: T.tinta, fontSize: 22, fontWeight: "800" },
  sub: { color: T.gris, fontSize: 13.5, marginTop: 3, marginBottom: 14 },
  nota: { color: T.gris, fontSize: 12.5, lineHeight: 18 },
  label: { color: T.tinta, fontSize: 12.5, fontWeight: "700", marginBottom: 6, marginTop: 10 },
  input: { backgroundColor: T.panel2, borderWidth: 1, borderColor: T.linea, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, color: T.tinta, fontSize: 14, minHeight: 46 },
  bloqueo: { flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: "rgba(217,119,107,0.10)", borderWidth: 1, borderColor: "rgba(217,119,107,0.35)", borderRadius: 10, padding: 10, marginTop: 10 },
  bloqueoTxt: { color: T.tinta, fontSize: 13, lineHeight: 18, flex: 1 },
  enlace: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16, minHeight: 40 },
  enlaceTxt: { color: T.accionTxt, fontSize: 13.5, fontWeight: "700" },
  punto: { flexDirection: "row", gap: 10, paddingVertical: 10 },
  borde: { borderTopWidth: 1, borderTopColor: T.linea },
  puntoTit: { color: T.tinta, fontSize: 14, fontWeight: "700" },
  datoFila: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: T.linea },
  datoK: { color: T.gris, fontSize: 13 },
  datoV: { color: T.tinta, fontSize: 13, fontWeight: "600", flexShrink: 1, textAlign: "right" },
});
