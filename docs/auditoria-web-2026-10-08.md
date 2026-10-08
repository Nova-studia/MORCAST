# Auditoría de morcast.mx — qué falta para darla por terminada

**8-oct-2026.** Revisión de solo lectura del código de producción (`main` `077eef8`), hecha en tres
partes: panel de administración, portal de clientes y sitio público, y modo chofer y temas transversales.
Queda **fuera** lo que depende de la información que la empresa todavía no entrega (precios, RFC,
datos bancarios, términos revisados por abogado, permisos con número). Al final se dice dónde entra
cada uno de esos datos.

Prioridad: **Alta** rompe la operación o expone datos · **Media** hace falta para operar bien ·
**Baja** pulido.

---

## 1. Clientes: baja y eliminación (lo que pidió Luis)

**Hoy no existe ninguna forma de dar de baja ni de eliminar un cliente desde el panel.**

**En el panel no se puede:**
- editar sus datos ni cambiar su estado;
- ver o quitar a sus usuarios ni abrir una ficha de detalle;
- completar a los 16 clientes en `pendiente-info` (solo con SQL);
- ver los errores al crear un cliente: se guardan pero no se muestran. Mientras carga, la pantalla dice "0 clientes".

**Los estados `suspendido` y `baja`:**
- existen en la base, pero **no tienen efecto**;
- un cliente dado de baja sigue entrando al portal y a la app, y puede pedir recolecciones;
- un cliente nuevo siempre nace "activo".

**Riesgo serio en la base:**
- **cualquier admin** (no solo el dueño) puede borrar un cliente llamando a la API directamente;
- el borrado arrastra en cascada sus solicitudes, recolecciones, **movimientos de dinero** y **precios**, que "nunca se borran";
- deja usuarios, archivos y tokens de notificación sueltos.

**Para dar de baja (reversible) hace falta:**
- estado con motivo, fecha y quién lo hizo;
- desactivar a todos sus usuarios;
- pausar sus servicios y revisar sus paradas futuras;
- liberar sus contenedores;
- bloquear sus pedidos en la base;
- ocultarlo de rutas y agenda;
- poder reactivarlo;
- dejarlo en la bitácora.

**Para eliminar definitivamente hace falta:**
- que lo haga **solo el dueño** y **solo si el cliente no tiene historial**; si lo tiene, se le manda a "baja" por la retención ambiental y fiscal;
- borrar sus usuarios, sus archivos y su ficha, y dejar una foto en la bitácora;
- que la base ya no permita borrar en cascada el dinero ni los precios.

## 2. Roles y permisos (pedido: el dueño crea roles y decide accesos)

Hoy solo existen **dueño, admin y chofer**, más el permiso "precios".

**Lo que no hay:**
- editar a una persona: nombre, teléfono o rol;
- reenviar la invitación (el enlace vence en 1 hora);
- restablecer contraseña o eliminar a alguien;
- ver el correo de cada usuario;
- una pantalla "Mi cuenta" para el personal.

**Problema de fondo:** el menú esconde secciones, pero **las páginas y la base no se protegen por sección**: cualquier admin lee y escribe todo por la API.

Un sistema de roles personalizados tiene que tocar:
- el guardia de páginas (`proxy.js`) y el menú;
- unas 10 acciones de servidor que fijan `["dueno","admin"]`;
- unas 20 rutas de la API de las apps;
- unas 40 políticas de la base que hoy dicen `es_personal()`;
- el modo administración de las dos apps.

## 3. Panel de administración — otros huecos

| Pantalla | Hueco | Prioridad |
|---|---|---|
| Recolecciones | Sin búsqueda por cliente, folio o fecha; carga todo y **se corta en silencio a las 1,000** | Alta |
| Recolecciones | La oficina no puede **crear una recolección** a nombre de un cliente (pedidos por teléfono) | Alta |
| Rutas | El chofer de la ruta es **texto libre**; `rutas.chofer_id` nunca se llena (de él dependen los permisos y los avisos del chofer) | Alta |
| Puntos | No se pueden **agregar ni quitar puntos** de un cliente, ni pausar o cancelar un servicio | Alta |
| Usuarios | Editar, reenviar invitación, restablecer contraseña, eliminar, ver correo (ver §2) | Alta |
| Recolecciones | No se ven las fotos ni la evidencia de las completadas; no hay exportación | Media |
| Panel | Enseña cifras de demostración (**$148,900 falsos**) mientras carga; faltan KPIs de operación (paradas de hoy, vencidas, incidentes, recargas, altas) | Media |
| Reportes | Datos de demostración mientras carga; sin rango de fechas, desglose por cliente o ruta, ni Excel | Media |
| Saldos | Sin estado de cuenta por cliente ni cargos o pagos capturados en oficina (hará falta al salir del Hold) | Media |
| Solicitudes / Zonas pedidas | Si falla el cambio de estado no avisa; sin notas de seguimiento ni búsqueda | Media |
| Bitácora | Sin filtro por persona o cliente, rango de fechas, exportación ni paginación | Media |
| Login / Mi cuenta | Sin "¿Olvidaste tu contraseña?"; nadie puede cambiar su contraseña ya dentro | Media |
| Incidentes, Avisos, Unidades, Contenedores, Altas, Empleo, Precios, Servicios, Sectores | Detalles: exportar, notas, confirmaciones (borrar una vacante no pide confirmación), vigencia futura de precios, fusionar Servicios con Recolecciones | Baja |

## 4. Portal de clientes

| Hueco | Prioridad |
|---|---|
| **Varios puntos:** al agendar, la solicitud cae siempre en el **primer punto** (43 clientes con 70 puntos → recolecciones en el punto equivocado) | **Alta** |
| El **manifiesto** que descarga un cliente real dice "Manifiesto de demostración", con residuo genérico y sin permiso ni destino final | **Alta** |
| La **constancia fiscal** la arma el sistema ("demostración", RFC "Pendiente", régimen supuesto) | **Alta** |
| No hay **Mi cuenta**: editar empresa, contacto, teléfono, domicilio, contraseña o correo | **Alta** |
| No se puede **cancelar ni reagendar** una solicitud | **Alta** |
| No hay **soporte o contacto** dentro del portal (WhatsApp o teléfono) | **Alta** |
| Si falla la red, se muestra "todavía no has pedido…" en lugar de un error | Media |
| El folio de la solicitud se calcula en el navegador: dos solicitudes al mismo tiempo chocan | Media |
| No se puede **eliminar la cuenta desde la web** (solo desde la app) | Media |
| No se pueden agregar otros **usuarios de la misma empresa**; no hay preferencias de avisos | Media |
| Facturas CFDI y estado de cuenta descargables (depende de facturación) | Media |
| Filtros del historial que siempre salen vacíos; el login ignora "volver a donde estaba"; zoom en iPhone; texto "Fase 2"; promete saldo en tiempo real durante el Hold | Baja |

## 5. Sitio público

| Hueco | Prioridad |
|---|---|
| El Aviso de Privacidad remite al **INAI**, que se extinguió en 2025 | **Alta** |
| El Aviso no menciona la firma, la IP, el inicio con Google ni los proveedores en EE. UU. (Supabase, Vercel, Resend) | Media |
| No hay página pública de **Términos** (el cliente firma un texto que luego no puede consultar) | Media |
| No hay páginas propias de **404 y error** (salen las de Next, en inglés) | Media |
| Sin imagen al compartir en WhatsApp o Facebook; sin datos estructurados para SEO local; sin página por servicio | Media |
| Domicilio y mapa ausentes en Contacto y en el pie | Media |
| Sin analítica ni medición de conversiones | Media |
| Los logins internos se pueden indexar en Google; al sitemap le faltan páginas; el pie no enlaza las páginas legales | Baja |

## 6. Modo chofer (web)

| Hueco | Prioridad |
|---|---|
| **El GPS está bloqueado en todo el sitio** (`Permissions-Policy: geolocation=()`): en la web del chofer la ubicación nunca funciona | **Alta** |
| Las horas de las fotos antes y después son **la hora en que pulsó Finalizar**, no la de la foto | **Alta** |
| Puede quedar **evidencia duplicada** (no hay `unique`), lo que duplica pesos | **Alta** |
| Sin señal dice "**Sin paradas para hoy**" en lugar de un error | **Alta** |
| "En camino" dice que avisó al cliente cuando no lo hizo | Media |
| Fotos sin comprimir y sin reintento; el código del contenedor se teclea sin validar; sin firma de quien recibe | Media |
| No puede llamar al cliente ni ver la ruta de mañana; la ruta no se refresca sola; no hay "¿Olvidaste tu contraseña?" | Media |
| El chofer puede leer de la base más datos del cliente de los que necesita (RFC, correo, saldo) | Media |

## 7. Seguridad y producción

| Hueco | Prioridad |
|---|---|
| El **código por correo del panel solo protege las páginas**: con la contraseña robada de un admin se lee y escribe todo por la API | **Alta** |
| **No hay ambiente de pruebas**: las vistas previas escriben en la base real | **Alta** |
| **No hay monitoreo de errores**: si fallan correos, avisos o el cron, nadie se entera | **Alta** |
| Correos fallidos sin registro; todo sale de un solo remitente; SPF, DKIM y DMARC sin verificar | Media |
| `CRON_SECRET` posiblemente sin poner en Vercel; faltan crons de retención (recuperación, altas, códigos) | Media |
| `.env.example` incompleto; CSP solo en modo reporte | Media |
| Bitácora sin recolecciones, incidentes ni avisos; cubetas de archivos creadas a mano | Media |
| Respaldos en una PC personal, sin cifrar y sin alerta | Media |
| Derechos ARCO sin registro ni plazos | Media |
| Datos de demostración que se ven en producción (cuentas demo si faltan variables, KPIs falsos); textos "Fase 2" | Media |
| Sin CI: `tests-db` no corre solo; sin pruebas del chofer ni de punta a punta | Media |
| Manuales desactualizados (corte del 14-ago; las actualizaciones de octubre siguen sin subir en `docs-octubre-2026`) | Media |
| Índices para crecer; zona horaria en dos lugares; límites de frecuencia en avisos del chofer | Baja |

## 8. Dónde entra la información pendiente de la empresa

- **RFC y régimen fiscal:** `lib/cotizacion-datos.js:37` y `lib/portal-pdf.js:27`. Lo ideal es subir el PDF real del SAT.
- **Datos bancarios:** `lib/cotizacion-datos.js:89` y `lib/recargas-datos.js:17`.
- **Precios:** `/admin/precios`. Después se apaga el Hold en `lib/estado-sistema.js`.
- **Términos revisados por abogado:** `lib/terminos.mjs`, más una página `/terminos` nueva.
- **Aviso de privacidad revisado:** `app/(claro)/aviso-de-privacidad/page.js` y `app/(claro)/privacidad/page.js`.
- **Correos @morcast.mx:** `lib/datos.js:37` y `lib/cotizacion-datos.js:33`. Hoy salen Gmails personales.
- **Permisos con número, vigencia y PDF:** `lib/datos.js:60`, `/permisos` y el manifiesto.
- **Formato y folio legal del manifiesto:** `lib/portal-pdf.js:192` y `lib/datos-solicitudes.js:435`.
- **Facturación CFDI:** no hay ningún lugar preparado todavía.
- **Imagen para redes y autorización de los logos de clientes.**
- **`CRON_SECRET` en Vercel:** pendiente del socio.
