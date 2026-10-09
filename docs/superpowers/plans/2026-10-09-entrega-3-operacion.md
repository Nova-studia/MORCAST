# Entrega 3 — Arreglos urgentes de operación · plan

> Ejecución en línea (superpowers:executing-plans), TDD por tarea, revisión independiente al final.
> Spec: `docs/superpowers/specs/2026-10-08-entregas-1-4-design.md` §Entrega 3 (y §Entrega 1, línea 28: la baja
> saca al cliente de rutas, agenda y puntos y avisa al chofer). Hechos del código: tres mapas del 9-oct
> (portal/documentos, panel, chofer/apps).

**Goal:** que la operación diaria no falle en silencio.
- Cada recolección le llega al chofer correcto.
- El folio no choca.
- No hay evidencia duplicada.
- El GPS funciona.
- El cliente elige su punto y descarga documentos honestos.
- La oficina encuentra, crea y programa recolecciones.

## Restricción que manda: las apps 1.1.1 ya instaladas

- Las apps cierran paradas con un `insert` directo a `recolecciones`, sin reintento automático.
- Las apps crean solicitudes con un folio calculado por ellas, y lo mandan.
- Todo cambio de base tiene que funcionar con esas apps sin publicar otra versión.

## Decisiones (con su porqué)

- **Migración 031** (la 030 ya es de avisos):
  - **Folio de la solicitud:**
    - un `before insert` en `solicitudes_recoleccion` (molde: `asignar_folio_cliente` de la 014, con candado);
    - si el folio viene vacío **o ya existe**, la base pone el siguiente `REC-AAAA-NNNN`;
    - un folio libre que mande la app se respeta.
    - Por qué: el cliente solo ve sus folios, así que el "máximo + 1" de la app choca con el de otros clientes.
  - **Una sola evidencia por parada:**
    - `unique (solicitud_id)` en `recolecciones`;
    - un `before insert` (security definer): si ya hay evidencia de esa parada **del mismo chofer**, actualiza la
      existente con lo nuevo que no venga vacío y descarta el insert (`return null`);
    - de otro chofer: error "Esta recolección ya la cerró otro chofer.";
    - antes del `unique`, si hay duplicados en la base la migración se detiene con un mensaje.
    - Por qué: el reintento de una app instalada no truena y puede seguir a "completada".
  - **Política de cierre del chofer:** el `insert` de `recolecciones` además exige que la parada esté
    `confirmada`, `en-ruta` o `completada` (nunca `no-procedio`).
- **Chofer de la ruta:**
  - Rutas: un select de choferes activos que guarda `rutas.chofer_id`, y `rutas.chofer` (texto) se llena con su
    nombre.
  - En Recolecciones, la opción vacía dice "El de la ruta: <nombre>" o "La ruta no tiene chofer".
  - Si la ruta no tiene chofer, confirmar avisa que nadie la verá.
- **Chofer web:**
  - `Permissions-Policy: geolocation=(self)`; cámara y micrófono siguen en `()`, porque la foto usa
    `<input capture>`.
  - La hora real se guarda en ISO al tomar cada foto.
  - Finalizar con candado contra doble toque.
  - Si la parada ya está completada, se dice y no se vuelve a cerrar.
  - Error de red → "No se pudo cargar tu ruta" con **Reintentar**, nunca "Sin paradas para hoy".
  - "Continuar" (en-ruta) usa `avisarEventoParada`, que sí avisa.
  - El texto "el cliente ya fue avisado" solo aparece si de verdad se avisó; si no, "No se pudo avisar al cliente".
- **Portal:**
  - Si el cliente tiene más de un punto con servicio activo, primero elige el punto.
  - La solicitud guarda ese `domicilio_id` y la ruta de esa suscripción.
  - El folio lo pone la base: `insert … select("folio")`.
  - Manifiesto:
    - residuo declarado (`tipo_residuo`);
    - peso real si hay, si no el del chofer marcado "(estimado)";
    - fecha y hora reales;
    - chofer real;
    - "Pendiente" en permiso y destino final;
    - sin la palabra "demostración".
  - Constancia fiscal: escondida mientras no haya RFC real (misma señal que las apps).
- **Recolecciones (panel):**
  - búsqueda por folio o empresa;
  - rango de fechas (por omisión, desde hace 30 días sin tope);
  - estado en el servidor;
  - páginas de 50 con el total;
  - "Vencidas" con su propia consulta, para que no se pierdan fuera del rango.
- **Crear recolección desde la oficina:**
  - cliente → punto (sus domicilios) → fecha → tipo de residuo → nota;
  - "Confirmarla ya" con fecha, hora y chofer, o dejarla "solicitada";
  - se inserta con la sesión y luego, si se confirma, pasa por `cambiarEstadoSolicitudComo`, que manda los
    avisos y escribe la bitácora.
- **Baja:**
  - rechaza también `en-ruta`, con la fecha efectiva (`fecha_confirmada` o `fecha_pedida`) desde hoy;
  - avisa por push "quitada" a cada chofer que la tenía;
  - en Sectores y puntos se esconden los puntos de clientes dados de baja;
  - las suscripciones canceladas ya no pintan ruta.

## Tareas

1. **031 + test:db (sección 25):**
   - folio: vacío → se asigna; repetido → se asigna otro; libre → se respeta;
   - evidencia: segundo insert del mismo chofer = actualiza (1 fila); de otro chofer falla; tras no-procedio no
     entra;
   - idempotencia.
2. **Chofer de la ruta:**
   - `lib/rutas-chofer.mjs`, puro: `nombreChoferRuta`, `textoChoferPorOmision`;
   - `guardarRuta` con `chofer_id`;
   - el select en Rutas;
   - el texto en Recolecciones.
3. **Chofer web:**
   - `next.config.mjs`;
   - `lib/chofer-cierre.mjs`, puro: hora de foto, `puedeCerrar(estado)`, `textoEnCamino`;
   - página de parada y lista: error con Reintentar;
   - `cerrarRecoleccion`.
4. **Portal:**
   - `lib/puntos-cliente.mjs`, puro: puntos agendables;
   - `misPuntos()`;
   - selector en Agendar;
   - `pedirRecoleccion({domicilioId})` con el folio de la base;
   - manifiesto con `lib/manifiesto.mjs`, puro: `filasManifiesto`;
   - constancia escondida.
5. **Recolecciones paginadas:**
   - `lib/consulta-recolecciones.mjs`, puro: arma el filtro (fechas, búsqueda, estado, página);
   - `listarSolicitudesPanel({…})` con `count`;
   - en la UI, buscador, fechas y paginación.
6. **Crear desde la oficina:**
   - `lib/recoleccion-nueva.mjs`, puro: `validarRecoleccionOficina`;
   - `crearRecoleccionOficinaAccion`;
   - el formulario en Recolecciones.
7. **Baja:**
   - `cambiarEstadoClienteCon` (fecha efectiva, en-ruta, push a choferes);
   - `listarPuntos` sin bajas y con la suscripción activa o pausada.
8. **Manual, revisión independiente y entrega** (Luis corre la 031 antes del push).

## Review Focus

- Reintento de cierre desde una app 1.1.1 tras una respuesta perdida: debe terminar en "completada" y con una
  sola evidencia.
- Dos clientes agendando a la vez, desde la web y desde la app: folios distintos y sin error.
- Recolección confirmada con "El de la ruta" en una ruta sin chofer: la oficina tiene que enterarse.
- Cliente con un solo punto en el portal: el flujo sigue igual que hoy.
- Una búsqueda con comas o paréntesis no rompe el filtro `or` de PostgREST.
