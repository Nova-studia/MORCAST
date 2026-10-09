# Apps al 100% — contrato para implementar (iOS y Android iguales)

> Va junto con `2026-10-09-apps-al-100.md`. La web ya está hecha en la rama `apps-100`:
> - la puerta `POST /api/app/accion/<nombre>` (`Web/lib/app-acciones-mapa.mjs`, `Web/lib/app-acciones.js`);
> - el puente `/admin/entrar`.
>
> Este documento dice qué hacer en CADA app. Las dos apps ya tienen:
> - `src/accion.js`: `accionAdmin(nombre, datos)` y `accionApp(nombre, datos)`. Responden `{ ok, motivo?, sinRed?, … }`.
> - `src/web/*.mjs`: COPIAS de la lógica pura de la web. No se editan.
> - `src/permisos-app.mjs`: `puedeVer(yo, pantalla)` y `pantallasVisibles`.

## Reglas para quien implementa

- **Solo JS**: nada de dependencias nativas nuevas; tiene que poder ir por EAS Update.
- **Estilo**: el de la app (`src/ui.js`, `src/tema.js`, los componentes que ya existen). Español de México, como el
  resto.
- **Lógica**: la nueva va en módulos `.mjs` puros, con pruebas `node --test` en `tests/` (con el mismo estilo que
  los que ya hay).
  - **Corre `npm test` de la app al final; tiene que quedar todo verde.**
- **No se rompe nada que ya funcione.**
  - El revisor de Apple entra con la cuenta de muestra (`cuenta-muestra.js`, `cuentas-prueba`); su flujo sigue igual.
  - En modo demostración/sin red, las pantallas no truenan.
- **Errores:**
  - si `r.sinRed`, se enseña "Sin conexión" con **Reintentar**;
  - si `!r.ok`, se enseña `r.motivo` tal cual (el servidor ya lo escribe para personas).
- **NO hagas commits ni push ni EAS.** Deja los cambios en el árbol de trabajo; Claude los revisa y los sube.

## Acciones de la web (`/api/app/accion/<nombre>`)

| nombre | quién | cuerpo | respuesta (además de ok/motivo) |
|---|---|---|---|
| `mis-permisos` | admin (`accionAdmin`) | — | `rol, rolNombre, permisos[]` |
| `puente-admin` | admin | `destino` (una de `/admin/rutas`, `/admin/sectores`, `/admin/precios`, `/admin/empleo`, `/admin/unidades`, `/admin/contenedores`, `/admin/viajes`, `/admin/bitacora`, `/admin/reportes`, `/admin`) | `url` (abrir con `Linking.openURL`) |
| `cuenta-contrasena` | cualquiera (`accionApp`) | `actual, nueva, repetir` | — |
| `cliente-cuenta` | cliente (`accionApp`) | — | `empresa {folio, empresa, contacto, telefono, correo, rfc, estado}`, `puntos [{id, alias, direccion, ruta, dias[], pausado}]` |
| `cliente-guardar` | cliente | `contacto, telefono, correo` | — |
| `solicitud-cambiar` | cliente | `id, accion ('cancelar'\|'reagendar'), fecha?, motivo?` | `fecha?` |
| `cliente-ficha` | admin | `clienteId` | `cliente, puntos[], solicitudes[], movimientos[], usuarios[], conteos, puedeEliminar` (lo mismo que `Web/app/(admin)/admin/clientes/[id]/page.js` usa de `fichaClienteAccion`) |
| `cliente-estado` | admin | `clienteId, estado ('activo'\|'suspendido'\|'baja'), motivo` | — |
| `cliente-editar` | admin | `clienteId, cambios {empresa, contacto, correo, telefono, rfc, …}` | `cambios` |
| `cliente-eliminar` | admin | `clienteId, confirmacion` (el nombre de la empresa) | — |
| `cliente-acceso` | admin | `clienteId, perfilId, activo` | — |
| `cliente-reenviar` | admin | `clienteId, perfilId` | — |
| `cliente-punto-agregar` | admin | `clienteId, punto {alias, calle, colonia, cp, referencias}` | — |
| `cliente-punto-quitar` | admin | `clienteId, domicilioId` | — |
| `cliente-servicio` | admin | `clienteId, suscripcionId, estado ('activa'\|'pausada')` | — |
| `usuarios-detalle` | admin | — | `porId { [uid]: {correo, ultimoAcceso} }` |
| `usuario-editar` | admin | `id, nombre, telefono, rolId?` (rolId solo si eres dueño y es admin; `""` = sin rol) | — |
| `usuario-enlace` | admin | `id` | `correo` |
| `usuario-eliminar` | admin | `id` | — |
| `usuario-permiso` | admin (dueño) | `perfilId, permiso ('precios'\|'eliminar_clientes'), valor` | `permisos` |
| `recoleccion-crear` | admin | `clienteId, domicilioId, fecha, tipoResiduo, nota, origen, confirmar, hora?, choferId?` | `folio, estado` |

Las que ya existían siguen igual (`/api/app/...`):
- `usuarios/invitar` ahora acepta `rolId`;
- `avisos/contar` y `avisos/mandar` aceptan `alcance:'clientes'` + `clienteIds[]`.

**Lecturas y escrituras directas con la sesión (supabase-js, RLS):**
- cliente:
  - `clientes.estado` (su fila);
  - `suscripciones` activas con `domicilios (alias, colonia)` y `rutas (id, clave, nombre, tipo, dias)` → los puntos (usa
    `src/web/puntos-cliente.mjs`);
  - `solicitudes_recoleccion.motivo_rechazo`.
- admin:
  - `roles` (leer: todo el personal; crear/editar/borrar: solo el dueño, con `validarRol` de `src/web/permisos.mjs`);
  - `perfiles` (`rol_id`, `permisos`, `telefono`);
  - `rutas` (`id, clave, nombre, chofer, chofer_id, activa`; el update de `chofer_id` y `chofer` con `elegirChoferRuta`);
  - choferes = `perfiles` (`rol='operador'`, `activo`);
  - solicitudes con búsqueda/fechas/páginas como `Web/lib/datos-solicitudes.js` `buscarSolicitudesPanel` (usa
    `src/web/consulta-recolecciones.mjs`).
- todos: su `perfiles` (`nombre`, `telefono`), con `update` directo (`perfiles_edita_el_suyo`).

## Fase A · lo que hoy ya se ve mal

1. **Admin según su rol:**
   - al entrar al modo admin (después del segundo paso), `accionAdmin('mis-permisos')` → guarda `{rol, permisos}`;
   - las pestañas inferiores y la lista de `MasAdmin` usan `puedeVer`;
   - una pantalla prohibida abierta por notificación muestra "Tu rol no incluye esta sección";
   - si `mis-permisos` falla por red, se reintenta y mientras tanto se enseña solo lo que no pide sección.
2. **Cliente suspendido:**
   - lee `clientes.estado`; si es `suspendido`, banda roja arriba en todas sus pantallas con
     `AVISO_SUSPENDIDO` (`src/web/estado-cliente.mjs`) y botones de WhatsApp y llamada (como
     `Web/components/portal/AvisoSuspendido.js`);
   - Agendar bloqueado con su mensaje (`permisosDeEstado`);
   - el error de RLS al pedir ya no se traduce a "Esa fecha no se puede" cuando la causa es el estado.
3. **Cuenta de baja o sesión inválida:** al abrir la app, comprobar con el servidor (`supabase.auth.getUser()`). Si
   falla por sesión (no por red), cerrar sesión y mandar al login con el mensaje `AVISO_BAJA` cuando aplique.
4. **"Cancelada":** traer `motivo_rechazo` en las solicitudes del cliente y mostrar "Cancelada" cuando
   `estadoParaMostrar(s) === 'cancelada'` (`src/web/solicitud-cliente.mjs`).
5. **Elegir punto al agendar:**
   - como `Web/app/(portal)/portal/agendar/page.js`, con `puntosAgendables`/`puntoInicial`;
   - con varios puntos, primero el punto; los días son los de la ruta de ese punto;
   - `pedirRecoleccion` manda ese `domicilio_id` y `ruta_id`.
6. **Folio de la base:**
   - insertar con `folio: null` y `.select('folio').single()`;
   - el mensaje "Solicitud X enviada" usa el folio real;
   - el aviso a la oficina (`solicitud-avisada`) se manda con ese folio.
7. **Chofer:**
   - (a) si cerrar falla en el paso de estado, releer la parada: si ya está `completada`, es éxito;
   - (b) una parada `completada` es "completado" aunque la evidencia sea de otro chofer (`estatusDeParada`);
   - (c) "el cliente ya fue avisado" solo si el servidor respondió `avisado: true` (`textoEnCamino`); si no, "no se
     pudo avisar al cliente".
8. **Recolecciones (admin):**
   - búsqueda (folio o empresa), fechas Desde/Hasta (por omisión desde hace 30 días) y páginas de 50 en la base;
   - vencidas aparte;
   - abrir por notificación o "Cambiar" busca ese folio.
9. **Avisos (admin):** el historial muestra "N clientes elegidos" para alcance `clientes`.

## Fase B · cliente al 100%

1. **Mi cuenta** (pantalla nueva desde "Más"):
   - mis datos (nombre, teléfono del perfil, directo);
   - contraseña (`cuenta-contrasena`; ocultar si la cuenta es solo Apple/Google: `user.app_metadata.providers` sin
     `email`);
   - datos de contacto de la empresa (`cliente-cuenta` / `cliente-guardar`; suspendido = solo lectura con el
     motivo);
   - mis puntos (lectura);
   - "Pedir cambio de razón social o RFC" por WhatsApp (`mensajeCambioFiscal`);
   - el "Eliminar mi cuenta" que ya existe se queda.
2. **Cancelar / cambiar fecha** en la lista de Agendar (y donde se vean sus solicitudes):
   - con `puedeCancelar`/`puedeReagendar`;
   - motivo opcional al cancelar;
   - fecha con el calendario de la app;
   - `solicitud-cambiar`;
   - recargar la lista.
3. **Soporte:**
   - tarjeta "¿Necesitas ayuda?" (WhatsApp con mensaje, teléfono, correo) en Inicio y Mi cuenta;
   - "Contáctanos" en las solicitudes vencidas.

## Fase C · administración al 100%

1. **Ficha del cliente** (desde Clientes, toca un cliente):
   - lo mismo que `Web/app/(admin)/admin/clientes/[id]/page.js`:
     - estado (suspender/baja/reactivar con motivo);
     - editar datos;
     - eliminar (si `puedeEliminar`, escribiendo el nombre);
     - usuarios (quitar/dar acceso, reenviar enlace);
     - puntos (agregar, quitar, pausar/reanudar servicio);
     - últimas solicitudes y movimientos;
   - acciones `cliente-*`.
2. **Usuarios:**
   - al invitar admin, elegir rol (dueño);
   - por usuario: editar (nombre, teléfono, rol), mandar enlace de contraseña, eliminar (dueño), permisos sueltos
     (dueño), correo y último acceso (`usuarios-detalle`);
   - pestaña o pantalla **Roles**: lista con sus secciones, y para el dueño crear/editar/borrar con casillas
     (`SECCIONES` + `PERMISOS_SUELTOS` de `src/web/permisos.mjs`); "Administrador completo" no se renombra ni se
     borra (`rolProtegido`).
3. **Avisos:** alcance "Clientes específicos" con lista para marcar (buscador, marcar todos/quitar todos), como la web.
4. **Recolecciones:**
   - botón **Nueva recolección**: cliente → punto → fecha → residuo → nota → "confirmarla ya" (hora, chofer);
   - `recoleccion-crear`;
   - el texto de "El de la ruta" con `textoChoferPorOmision` y el aviso `avisoRutaSinChofer`.
5. **Rutas** (pantalla nueva en Más): lista de rutas (nombre, días, chofer) y elegir el **chofer** de cada una, con
   update directo `chofer_id` + `chofer`.
6. **Mi cuenta** del personal (en Más) y del **chofer** (botón en su ruta): nombre, teléfono, contraseña.

## Fase D · herramientas de escritorio

- En "Más" de admin, sección **"En la web"** con botones (según `puedeVer` de su sección):
  - Zonas y sectores → `/admin/rutas`;
  - Precios → `/admin/precios`;
  - Trabaja con nosotros → `/admin/empleo`;
  - Unidades (alta y edición) → `/admin/unidades`;
  - Contenedores → `/admin/contenedores`;
  - Peso real → `/admin/viajes`;
  - Bitácora completa → `/admin/bitacora`.
- Cada botón: `accionAdmin('puente-admin', {destino})` → `Linking.openURL(r.url)`. Con error, el motivo.
- Secciones de esos botones: rutas, precios, empleo, unidades, contenedores, recolecciones, bitacora.
