import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { T } from "../tema";
import { Tarjeta, TituloTarjeta, Badge, Boton, EncabezadoPantalla } from "../ui";
import { miSuscripcion, leerMisSolicitudes, pedirRecoleccion } from "../datos-remoto";
import { ESTADOS_SOLICITUD_REC, nombreTipoRuta } from "../rutas-datos";
import { TIPOS_RESIDUO } from "../cotizar-whatsapp";
import { validarSolicitudAgenda } from "../agendar.mjs";
import { textoNoProcedio } from "../estado-servicio.mjs";
import { aISO, limitesExtra, revisarFechaExtra, fechaConDia } from "../calendario.mjs";
import CalendarioFecha from "../CalendarioFecha";

/** Próximas fechas (hasta 6) en que pasa la ruta, a partir de mañana. */
function proximasFechas(dias, cuantas = 6) {
  const nombres = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const fechas = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  for (let i = 1; i <= 60 && fechas.length < cuantas; i++) {
    const f = new Date(d);
    f.setDate(d.getDate() + i);
    if (dias.includes(nombres[f.getDay()])) fechas.push(aISO(f));
  }
  return fechas;
}

export default function Agendar() {
  const [suscripcion, setSuscripcion] = useState(null);
  const [mias, setMias] = useState([]);
  // "ruta" = un día de los que pasa su ruta; "extra" = cualquier día de hoy
  // a un año (6-oct-2026, como `/portal/agendar`). Antes la app solo pedía
  // días de ruta y mandaba a WhatsApp a quien no tenía ruta.
  const [modo, setModo] = useState("ruta");
  const [fecha, setFecha] = useState("");
  const [nota, setNota] = useState("");
  // Sin valor por defecto A PROPÓSITO (igual que la web): si viniera puesto
  // "RSU", el cliente que no lo lee mandaría RSU aunque entregue otra cosa,
  // y el chofer llegaría preparado para lo que no es.
  const [tipoResiduo, setTipoResiduo] = useState("");
  const [enviado, setEnviado] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  // Mientras no vuelve `miSuscripcion()` no se sabe si hay ruta: antes
  // decía "Aún no tienes una ruta asignada" y un segundo después cambiaba.
  const [cargando, setCargando] = useState(true);
  // "No pude leer tus solicitudes" no es "no has pedido ninguna".
  const [errorLista, setErrorLista] = useState("");
  const [refrescando, setRefrescando] = useState(false);
  const turno = useRef(0);

  const ruta = suscripcion?.ruta || null;
  const hoy = aISO(new Date());
  const limites = limitesExtra(hoy);

  // Las solicitudes que llegan ya son solo las de esta empresa: el RLS las
  // filtró en la base, no hace falta filtrarlas aquí.
  const recargar = useCallback(async () => {
    const n = ++turno.current;
    try {
      const [su, li] = await Promise.all([miSuscripcion().catch(() => undefined), leerMisSolicitudes()]);
      if (n !== turno.current) return;
      if (su !== undefined) setSuscripcion(su);
      setMias(li.solicitudes);
      setErrorLista(li.ok ? "" : li.motivo || "No pudimos leer tus solicitudes.");
    } finally {
      if (n === turno.current) setCargando(false);
    }
  }, []);

  // Se relee al volver a la pestaña: Morcast confirma o reprograma desde la
  // oficina y el estado tiene que verse sin cerrar la app.
  useFocusEffect(useCallback(() => { recargar(); }, [recargar]));

  // Sin ruta asignada solo se puede pedir una extra: se abre directo ahí.
  useEffect(() => {
    if (!cargando && !ruta) setModo("extra");
  }, [cargando, ruta]);

  const refrescar = async () => {
    setRefrescando(true);
    try { await recargar(); } finally { setRefrescando(false); }
  };

  const fechas = useMemo(() => (ruta ? proximasFechas(ruta.dias) : []), [ruta]);

  // Obligatorio desde la 1.1 (db/023); con «Otro», la nota también. En la
  // extra, además, la fecha tiene que caer de hoy a un año (db/013).
  const revision = validarSolicitudAgenda({ fecha, tipoResiduo, nota }, TIPOS_RESIDUO);
  const faltaDescribirOtro = tipoResiduo === "Otro" && !nota.trim();

  const cambiarModo = (m) => {
    if (m === modo) return;
    setModo(m);
    setFecha("");
    setError("");
  };

  const enviar = async () => {
    if (enviando) return;
    if (!revision.ok) { setError(revision.mensaje); return; }
    if (modo === "extra") {
      const malFecha = revisarFechaExtra(fecha, hoy);
      if (malFecha) { setError(malFecha); return; }
    }
    setEnviando(true);
    setError("");

    const r = await pedirRecoleccion({
      rutaClave: ruta?.clave || null,
      domicilioId: suscripcion?.domicilioId || null,
      fecha,
      nota,
      origen: modo,
      tipoResiduo,
    });

    if (!r.ok) {
      // El motivo real cuando lo hay ("Esa fecha no se puede…", "Tu cuenta
      // no tiene empresa asignada"); "revisa tu señal" sólo si no se sabe.
      setError(r.motivo || "No se pudo enviar tu solicitud. Revisa tu señal e intenta otra vez.");
      setEnviando(false);
      return;
    }

    // Se relee de la base para que veas el folio real, no uno inventado aquí.
    await recargar();
    setEnviado(r.folio);
    setFecha("");
    setNota("");
    setTipoResiduo("");
    setEnviando(false);
  };

  const badge = (id) =>
    ESTADOS_SOLICITUD_REC.find((e) => e.id === id) || { texto: id, clase: "prog" };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: T.fondo }}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      // Propiedad de iOS: deja que el sistema recorra el contenido cuando sale
      // el teclado. Viene apagada por omision y sin ella el campo de la nota
      // se queda tapado. En Android se ignora (alli lo resuelve el resize).
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={T.gris} />}
    >
      <EncabezadoPantalla
        titulo="Agendar recolección"
        sub="Pide tu servicio en el día de tu ruta, o una recolección extra si se te juntó de más."
      />

      <Tarjeta>
        <TituloTarjeta>Nueva solicitud</TituloTarjeta>

        {ruta ? (
          <Text style={s.intro}>
            Estás dado de alta en <Text style={s.fuerte}>{ruta.nombre}</Text> ·{" "}
            {nombreTipoRuta(ruta.tipo)}. Pasa {ruta.dias.join(", ")}.
          </Text>
        ) : cargando ? (
          <Text style={s.intro}>Leyendo tu ruta…</Text>
        ) : (
          <Text style={s.intro}>
            Aún no tienes una ruta asignada. Mientras Morcast te la asigna, puedes pedir una recolección extra para el día que la necesites.
          </Text>
        )}

        {/* Igual que el portal: día de ruta o extra. Sin ruta, solo extra. */}
        <View style={s.modos} accessibilityRole="tablist">
          <Pressable
            onPress={() => cambiarModo("ruta")}
            disabled={!ruta}
            style={[s.modo, modo === "ruta" && s.modoOn, !ruta && { opacity: 0.45 }]}
            accessibilityRole="tab"
            accessibilityState={{ selected: modo === "ruta", disabled: !ruta }}
          >
            <Feather name="calendar" size={15} color={modo === "ruta" ? "#fff" : T.tinta} />
            <Text style={[s.modoTxt, modo === "ruta" && { color: "#fff" }]}>Día de mi ruta</Text>
          </Pressable>
          <Pressable
            onPress={() => cambiarModo("extra")}
            style={[s.modo, modo === "extra" && s.modoOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: modo === "extra" }}
          >
            <Feather name="plus-circle" size={15} color={modo === "extra" ? "#fff" : T.tinta} />
            <Text style={[s.modoTxt, modo === "extra" && { color: "#fff" }]}>Recolección extra</Text>
          </Pressable>
        </View>

        {modo === "ruta" ? (
          <View style={s.fechas}>
            {fechas.map((f) => (
              <Pressable
                key={f}
                onPress={() => { setFecha(f); setError(""); }}
                style={[s.chip, fecha === f && s.chipActivo]}
                accessibilityRole="radio"
                accessibilityState={{ selected: fecha === f }}
              >
                {/* "martes 7 de octubre", no "2026-10-07": la pregunta es
                    "¿el martes o el viernes?" (como el portal). */}
                <Text style={[s.chipTxt, fecha === f && s.chipTxtActivo]}>{fechaConDia(f)}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <>
            <Text style={s.label}>¿Qué día? <Text style={{ color: T.error }}>*</Text></Text>
            <CalendarioFecha
              valor={fecha}
              onCambiar={(f) => { setFecha(f); setError(""); }}
              min={limites.min}
              max={limites.max}
              hoy={hoy}
            />
            <Text style={s.elegida}>
              {fecha ? <>Elegiste el <Text style={s.fuerte}>{fechaConDia(fecha)}</Text>.</> : "Toca un día, de hoy a un año."}
            </Text>
          </>
        )}

        {/* El tipo de residuo: es lo que le dice al chofer con qué ir. */}
        <Text style={s.label}>¿Qué residuo vas a entregar? <Text style={{ color: T.error }}>*</Text></Text>
        <View style={s.fechas}>
          {TIPOS_RESIDUO.map((t) => (
            <Pressable
              key={t}
              onPress={() => { setTipoResiduo(t); setError(""); }}
              style={[s.chip, tipoResiduo === t && s.chipActivo]}
              accessibilityRole="radio"
              accessibilityState={{ selected: tipoResiduo === t }}
            >
              <Text style={[s.chipTxt, tipoResiduo === t && s.chipTxtActivo]}>{t}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={s.ayuda}>
          Si al llegar el residuo es otro, el chofer no lo puede recoger y la
          visita queda como «No procedió» (sin cobro).
        </Text>

        <TextInput
          style={[s.input, faltaDescribirOtro && { borderColor: T.alerta }]}
          placeholder={tipoResiduo === "Otro" ? "¿Qué residuo es? (obligatorio con «Otro»)" : "Nota para la cuadrilla (opcional)"}
          placeholderTextColor={T.grisClaro}
          value={nota}
          onChangeText={setNota}
          multiline
        />

        {faltaDescribirOtro ? (
          <Text style={s.aviso}>Con «Otro», escribe en la nota qué residuo es.</Text>
        ) : null}

        {/* Se deja tocar aunque falte algo: así se dice QUÉ falta, en vez de
            un botón apagado sin explicación. */}
        <Boton onPress={enviar} disabled={!fecha || enviando}>
          <Text style={s.botonTxt}>{enviando ? "Enviando…" : modo === "extra" ? "Pedir recolección extra" : "Enviar solicitud"}</Text>
        </Boton>

        {error ? <Text style={s.error}>{error}</Text> : null}

        {enviado ? (
          <Text style={s.exito}>
            Solicitud <Text style={s.fuerte}>{enviado}</Text> enviada. Morcast la
            confirma y te avisa.
          </Text>
        ) : null}
      </Tarjeta>

      <Tarjeta>
        <TituloTarjeta>Mis solicitudes</TituloTarjeta>
        {errorLista ? (
          <View style={s.errorCaja} accessibilityLiveRegion="polite">
            <Text style={s.errorCajaTxt}>{errorLista}</Text>
            <Pressable onPress={refrescar} style={s.reintentar} accessibilityRole="button" hitSlop={6}>
              <Feather name="refresh-cw" size={14} color={T.tinta} />
              <Text style={s.reintentarTxt}>Reintentar</Text>
            </Pressable>
          </View>
        ) : null}
        {mias.length === 0 ? (
          errorLista ? null : (
            <Text style={s.vacio}>{cargando ? "Leyendo tus solicitudes…" : "Todavía no has pedido ninguna recolección."}</Text>
          )
        ) : (
          mias.map((sol, i) => {
            const b = badge(sol.estado);
            return (
              <View key={sol.folio} style={[s.fila, i > 0 && s.filaBorde, { alignItems: "flex-start" }]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.folio}>{sol.folio}</Text>
                  <Text style={s.filaDato}>
                    {fechaConDia(sol.fechaPedida)} · {sol.origen === "extra" ? "Extra" : "De ruta"}
                  </Text>
                  <Text style={s.filaResiduo}>{sol.tipoResiduo || "Residuo sin especificar"}</Text>
                  {sol.estado === "no-procedio" ? (
                    <Text style={s.noProc}>{textoNoProcedio(sol.motivoNoProcedio, sol.detalleNoProcedio)}</Text>
                  ) : null}
                </View>
                <Badge clase={b.clase}>{b.texto}</Badge>
              </View>
            );
          })
        )}
      </Tarjeta>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  intro: { color: T.gris, fontSize: 13, lineHeight: 19, marginBottom: 12 },
  label: { color: T.tinta, fontSize: 13, fontWeight: "700", marginBottom: 8 },
  aviso: { color: T.alerta, fontSize: 12.5, marginTop: -4, marginBottom: 10 },
  ayuda: { color: T.gris, fontSize: 12, lineHeight: 17, marginTop: -4, marginBottom: 12 },
  elegida: { color: T.gris, fontSize: 12.5, marginTop: -4, marginBottom: 14 },
  noProc: { color: T.error, fontSize: 12.5, marginTop: 6, lineHeight: 18 },
  fuerte: { color: T.tinta, fontWeight: "700" },
  modos: { flexDirection: "row", gap: 8, marginBottom: 12 },
  modo: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: T.linea, backgroundColor: T.panel2, paddingHorizontal: 8 },
  modoOn: { backgroundColor: T.verde, borderColor: T.verde },
  modoTxt: { color: T.tinta, fontSize: 13, fontWeight: "700" },
  fechas: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 12 },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: T.linea,
    backgroundColor: T.panel2,
  },
  chipActivo: { backgroundColor: T.verde, borderColor: T.verde },
  chipTxt: { color: T.tinta, fontSize: 12.5, fontWeight: "600" },
  chipTxtActivo: { color: "#fff" },
  input: {
    backgroundColor: T.panel2,
    borderWidth: 1,
    borderColor: T.linea,
    borderRadius: 10,
    padding: 11,
    color: T.tinta,
    fontSize: 13.5,
    minHeight: 64,
    textAlignVertical: "top",
    marginBottom: 12,
  },
  botonTxt: { color: "#fff", fontWeight: "800", fontSize: 14.5 },
  error: { color: "#ef8080", fontSize: 12.5, marginTop: 10, lineHeight: 18 },
  exito: { color: T.verdeClaro, fontSize: 12.5, marginTop: 10, lineHeight: 18 },
  vacio: { color: T.gris, fontSize: 13 },
  fila: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11 },
  filaBorde: { borderTopWidth: 1, borderTopColor: T.linea },
  folio: { color: T.tinta, fontSize: 14, fontWeight: "700" },
  filaDato: { color: T.gris, fontSize: 12.5, marginTop: 3 },
  filaResiduo: { color: T.tinta, fontSize: 12.5, marginTop: 2 },
  errorCaja: { padding: 11, borderRadius: 10, marginBottom: 6, backgroundColor: "rgba(217,119,107,0.10)", borderWidth: 1, borderColor: "rgba(217,119,107,0.35)" },
  errorCajaTxt: { color: T.tinta, fontSize: 13, lineHeight: 18 },
  reintentar: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginTop: 8, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 9, borderWidth: 1, borderColor: T.linea, backgroundColor: T.panel, minHeight: 40 },
  reintentarTxt: { color: T.tinta, fontSize: 13, fontWeight: "700" },
});
