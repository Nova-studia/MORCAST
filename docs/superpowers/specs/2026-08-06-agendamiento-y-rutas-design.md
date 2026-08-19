# Agendamiento y rutas — diseño

**Fecha:** 6 de agosto de 2026
**Proyecto:** Morcast del Norte (web + app)
**Estado:** diseño aprobado, pendiente de plan de implementación

---

## 1. Qué problema resuelve

Hoy el cliente no tiene forma de pedir una recolección: llama por teléfono o manda
WhatsApp. La empresa lleva las rutas por fuera del sistema, y las tres vistas que ya
existen (agenda del admin, historial del cliente, ruta del chofer en la app) usan datos
inventados **por separado**, sin ninguna relación entre ellas.

Este sistema es la pieza que las amarra: la ruta que arma la empresa es la misma que ve
el chofer en su teléfono y la que se le ofrece al cliente.

## 2. Decisiones tomadas

| Decisión | Elegido | Por qué |
|---|---|---|
| Cobertura por zona | **Leaflet + OpenStreetMap** | Mapa real con zonas dibujadas, sin API key, sin tarjeta y sin costo. Google Maps exige cuenta de Google Cloud con tarjeta y cambió precios en 2025. |
| Qué se agenda | **Recurrente + puntual** | El cliente se da de alta en una ruta fija y además puede pedir recolecciones extra. Es como opera el negocio. |
| Confirmación | **La empresa autoriza** | Con 4 unidades no se puede comprometer un camión sin que un humano lo vea. |
| Datos de pago | **Facturación y preferencia** | RFC, razón social, uso de CFDI y forma de pago preferida. **No se guardan datos bancarios del cliente**: Morcast cobra a su propia cuenta, así que no los necesita, y guardarlos activa obligaciones de la LFPDPPP sin ningún beneficio. |
| Persistencia | **Demo, en memoria** | Igual que el portal y el admin actuales. Sirve para mostrar y cobrar sin arrastrar la Fase 4 completa. |

## 3. Alcance

**Dentro:**
- Alta de cliente con domicilio de recolección ubicado en el mapa
- Consulta de cobertura: ¿mi zona tiene ruta?
- Solicitud de apertura de zona cuando no hay cobertura
- Agendado de recolección (de ruta y extra)
- Panel de rutas para la empresa: crear, editar y dibujar zona
- Bandeja de solicitudes con confirmar/rechazar
- Las tres vistas conectadas: cliente, admin y chofer

**Fuera, a propósito:**
- Optimización del orden de paradas
- GPS en vivo de la unidad
- Notificaciones push
- Cobro en línea

Cada una es un proyecto aparte y ninguna hace falta para que esto funcione.

## 4. Modelo de datos

Vive en `Web/lib/rutas-datos.js`, con espejo en `App IOS/src/rutas-datos.js` y
`App Android/src/rutas-datos.js`.

### Ruta

```
id            "RT-NORTE"
nombre        "Ruta Norte"
tipo          "manual" | "roll-off" | "compactador"
dias          ["martes", "viernes"]        semana laboral: lunes a sábado
unidad        "Roll Off International"      de UNIDADES en cotizacion-datos.js
chofer        "José Medina"
cupo          12                            paradas por día
zona          [[lat, lng], ...]             polígono que se dibuja en el mapa
activa        true
```

Los tres tipos son los que dio el cliente: **Manual**, **Industrial (Roll Off)** y
**Compactador trasero**.

### Domicilio de recolección

Un cliente puede tener más de uno (una maquiladora con dos plantas).

```
id, clienteId, alias ("Planta 1"), calle, colonia, cp, referencias,
lat, lng, rutaId (calculada al caer dentro de una zona, o null)
```

### Suscripción

El cliente dado de alta en una ruta.

```
id, clienteId, domicilioId, rutaId, frecuencia ("semanal" | "quincenal" | "mensual"),
equipo [{tipo, medida, cantidad}], estado ("activa" | "pausada" | "cancelada"), desde
```

El `equipo` sale de `EQUIPO_RENTA` en `cotizacion-datos.js`: contenedores 1.5/3/6 m³,
tolvas 21 y 30, compactadores 21 y 30.

### Solicitud de recolección

```
folio         "REC-2026-0142"
clienteId, domicilioId, rutaId
origen        "ruta" | "extra"
fechaPedida, fechaConfirmada
estado        "solicitada" | "confirmada" | "en-ruta" | "completada" | "rechazada"
nota, motivoRechazo
```

Los estados `en-ruta` y `completada` son los mismos que ya usa `AGENDA_SERVICIOS` del
admin y el historial del cliente, para que las tres vistas hablen el mismo idioma.

### Zona solicitada

Cuando alguien cae fuera de todas las rutas.

```
id, nombreContacto, empresa, telefono, correo, colonia, lat, lng,
volumenEstimado, estado ("nueva" | "en-evaluacion" | "aprobada" | "descartada"), fecha
```

Vale comercialmente: dice dónde están pidiendo servicio y no se llega.

### Facturación

```
clienteId, rfc, razonSocial, domicilioFiscal, usoCFDI,
formaPagoPreferida ("transferencia" | "efectivo" | "cheque")
```

**No lleva banco, cuenta ni CLABE del cliente.**

## 5. Cómo se decide la cobertura

Punto en polígono, calculado en el navegador. No requiere servidor ni servicio externo.

1. La empresa dibuja la zona de cada ruta sobre el mapa (una lista de coordenadas).
2. El cliente pone su pin al darse de alta.
3. Se evalúa el pin contra cada zona activa con el algoritmo de **ray casting**
   (`punto-en-zona.js`, ~20 líneas, sin dependencias).
4. Si cae dentro de una o más zonas, se le ofrecen esas rutas con sus días.
5. Si no cae en ninguna, se le ofrece **solicitar apertura de zona**.

Si un domicilio cae en varias zonas, se le ofrecen todas y el cliente elige; el tipo de
ruta (manual, roll off, compactador) suele decidir por él, porque depende del equipo que
tenga instalado.

## 6. El mapa en cada plataforma

| Dónde | Cómo |
|---|---|
| **Web** | Leaflet cargado con `next/dynamic` y `ssr: false`. Leaflet toca `window`, así que revienta si Next intenta renderizarlo en el servidor. |
| **App (iOS y Android)** | El mismo Leaflet **dentro de un WebView** (`react-native-webview`). Se descartó `react-native-maps` porque en Android usa Google Maps y exige API key, justo lo que estamos evitando. |

Las teselas salen de los servidores públicos de OpenStreetMap, que piden atribución
visible y uso moderado. Para el volumen de Morcast sobra, pero queda anotado.

## 7. Pantallas

### Cliente (web y app)

| Pantalla | Qué hace |
|---|---|
| **Alta / inscripción** | Contacto, pin en el mapa, residuos que genera, equipo que necesita, facturación y forma de pago |
| **Cobertura** | Mapa con zonas y su pin. Responde "te cubre la Ruta Norte, martes y viernes" o "aún no llegamos" + botón de solicitar apertura |
| **Agendar** | Elige día de su ruta, o pide recolección extra con fecha y nota |
| **Mis recolecciones** | Próximas y pasadas. Se integra al historial que ya existe |

### Empresa (admin)

| Pantalla | Qué hace |
|---|---|
| **Rutas** | Alta y edición: tipo, días, unidad, chofer, cupo, y dibujar la zona en el mapa |
| **Solicitudes** | Bandeja para confirmar o rechazar, con el mismo patrón de la bandeja de cotizaciones que ya funciona |
| **Zonas pedidas** | Dónde piden servicio y no hay ruta, con mapa de calor de solicitudes |
| **Agenda del día** | Qué lleva cada ruta. Extiende `AGENDA_SERVICIOS` en vez de duplicarlo |

### Chofer (solo app)

La pantalla `RutaChofer` ya existe y hoy lee de `datos-chofer.js`. Pasa a leer las
recolecciones **confirmadas** de su ruta para la fecha de hoy. El flujo de 5 pasos
(escanear QR → foto antes → recolectar → foto después → peso) **no se toca**.

## 8. Archivos

**Nuevos:**
- `Web/lib/rutas-datos.js` — rutas, zonas, suscripciones, solicitudes
- `Web/lib/punto-en-zona.js` — ray casting, sin dependencias
- `Web/components/MapaZonas.js` — Leaflet, cliente, carga dinámica
- `Web/app/(portal)/portal/cobertura/page.js`
- `Web/app/(portal)/portal/agendar/page.js`
- `Web/app/(admin)/admin/rutas/page.js`
- `Web/app/(admin)/admin/zonas-pedidas/page.js`
- Espejos en `App IOS/src/` y `App Android/src/`

**Se tocan:**
- `Web/lib/admin-datos.js` — `AGENDA_SERVICIOS` pasa a derivarse de las solicitudes
- `App IOS/src/datos-chofer.js` — la ruta del día sale de las solicitudes confirmadas
- Menús del portal y del admin

## 9. Cómo se verifica

- `npm run build` de la web sin errores
- `npx expo export` de la app sin errores
- Recorrido con navegador: alta → ver cobertura → agendar → confirmar desde el admin →
  aparece en la agenda y en la ruta del chofer
- Revisión a 390px de ancho. **Ojo:** las animaciones `Revelar` con `desde="izq"` o
  `desde="der"` aplican un desplazamiento horizontal que ensancha la página en móvil.
  Usar `desde="abajo"` en todo lo nuevo.
- Un domicilio dentro de zona y otro fuera, para probar los dos caminos

## 10. Riesgos y pendientes

- **Dibujar las zonas es trabajo de Morcast, no técnico.** El sistema queda listo, pero
  hasta que alguien de la empresa marque las zonas reales de sus rutas, la cobertura
  opera con zonas de ejemplo. Es la parte que suele atorarse.
- **Al ser demo, nada persiste.** El alta de un cliente se pierde al recargar. Cuando se
  conecte Supabase (Fase 4), las pantallas no cambian: cambia de dónde salen los datos.
- **OpenStreetMap pide atribución visible** en el mapa. Va incluida.
- **Los días de recolección son de lunes a sábado**, según los horarios que confirmó el
  cliente el 6-ago-2026. Emergencias es 24/7 pero eso va por teléfono, no por el sistema.
