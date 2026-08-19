import { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "../tema";
import { Tarjeta, TituloTarjeta, Badge, Boton, EncabezadoPantalla } from "../ui";
import { miSuscripcion, misSolicitudes, pedirRecoleccion } from "../datos-remoto";
import { ESTADOS_SOLICITUD_REC, nombreTipoRuta } from "../rutas-datos";

/**
 * Fecha en YYYY-MM-DD con la hora LOCAL.
 * No usar `toISOString()`: pasa a UTC y, según la zona horaria, devuelve el día
 * anterior. Aquí las fechas son de calendario, no instantes.
 */
function aISO(f) {
  const mes = String(f.getMonth() + 1).padStart(2, "0");
  const dia = String(f.getDate()).padStart(2, "0");
  return `${f.getFullYear()}-${mes}-${dia}`;
}

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
  const [fecha, setFecha] = useState("");
  const [nota, setNota] = useState("");
  const [enviado, setEnviado] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  const ruta = suscripcion?.ruta || null;

  // Las solicitudes que llegan ya son solo las de esta empresa: el RLS las
  // filtró en la base, no hace falta filtrarlas aquí.
  const recargar = () =>
    Promise.all([miSuscripcion(), misSolicitudes()]).then(([su, li]) => {
      setSuscripcion(su);
      setMias(li);
    });

  useEffect(() => {
    let vivo = true;
    recargar().then(() => { if (!vivo) return; });
    return () => { vivo = false; };
  }, []);

  const fechas = useMemo(() => (ruta ? proximasFechas(ruta.dias) : []), [ruta]);

  const enviar = async () => {
    if (!fecha || enviando) return;
    setEnviando(true);
    setError("");

    // En la app solo se piden días de la ruta; el servicio extra se pide por
    // teléfono, que es como opera hoy el negocio.
    const r = await pedirRecoleccion({ rutaClave: ruta?.clave || null, fecha, nota, origen: "ruta" });

    if (!r.ok) {
      setError("No se pudo enviar tu solicitud. Revisa tu señal e intenta otra vez.");
      setEnviando(false);
      return;
    }

    // Se relee de la base para que veas el folio real, no uno inventado aquí.
    await recargar();
    setEnviado(r.folio);
    setFecha("");
    setNota("");
    setEnviando(false);
  };

  const badge = (id) =>
    ESTADOS_SOLICITUD_REC.find((e) => e.id === id) || { texto: id, clase: "prog" };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: T.fondo }}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
    >
      <EncabezadoPantalla
        titulo="Agendar recolección"
        sub="Pide tu servicio en uno de los días de tu ruta."
      />

      <Tarjeta>
        <TituloTarjeta>Nueva solicitud</TituloTarjeta>

        {ruta ? (
          <Text style={s.intro}>
            Estás dado de alta en <Text style={s.fuerte}>{ruta.nombre}</Text> ·{" "}
            {nombreTipoRuta(ruta.tipo)}. Pasa {ruta.dias.join(", ")}.
          </Text>
        ) : (
          <Text style={s.intro}>Aún no tienes una ruta asignada.</Text>
        )}

        <View style={s.fechas}>
          {fechas.map((f) => (
            <Pressable
              key={f}
              onPress={() => setFecha(f)}
              style={[s.chip, fecha === f && s.chipActivo]}
            >
              <Text style={[s.chipTxt, fecha === f && s.chipTxtActivo]}>{f}</Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          style={s.input}
          placeholder="Nota para la cuadrilla (opcional)"
          placeholderTextColor={T.grisClaro}
          value={nota}
          onChangeText={setNota}
          multiline
        />

        <Boton onPress={enviar} disabled={!fecha || enviando}>
          <Text style={s.botonTxt}>{enviando ? "Enviando…" : "Enviar solicitud"}</Text>
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
        {mias.length === 0 ? (
          <Text style={s.vacio}>Todavía no has pedido ninguna recolección.</Text>
        ) : (
          mias.map((sol, i) => {
            const b = badge(sol.estado);
            return (
              <View key={sol.folio} style={[s.fila, i > 0 && s.filaBorde]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.folio}>{sol.folio}</Text>
                  <Text style={s.filaDato}>
                    {sol.fechaPedida} · {sol.origen === "extra" ? "Extra" : "De ruta"}
                  </Text>
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
  fuerte: { color: T.tinta, fontWeight: "700" },
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
  chipTxtActivo: { color: "#0d1211" },
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
  botonTxt: { color: "#0d1211", fontWeight: "800", fontSize: 14.5 },
  error: { color: "#ef8080", fontSize: 12.5, marginTop: 10, lineHeight: 18 },
  exito: { color: T.verdeClaro, fontSize: 12.5, marginTop: 10, lineHeight: 18 },
  vacio: { color: T.gris, fontSize: 13 },
  fila: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11 },
  filaBorde: { borderTopWidth: 1, borderTopColor: T.linea },
  folio: { color: T.tinta, fontSize: 14, fontWeight: "700" },
  filaDato: { color: T.gris, fontSize: 12.5, marginTop: 3 },
});
