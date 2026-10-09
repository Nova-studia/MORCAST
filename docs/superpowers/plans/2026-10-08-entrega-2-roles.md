# Entrega 2 — Roles personalizados y usuarios · plan

> Ejecución en línea (superpowers:executing-plans). Spec: `docs/superpowers/specs/2026-10-08-entregas-1-4-design.md` §Entrega 2.

**Goal:** El dueño crea roles con casillas por sección. Esos permisos se respetan en el menú, en las
páginas, en las acciones del servidor, en la API de las apps y en las ESCRITURAS de la base. Además:
gestión completa de usuarios y "Mi cuenta".

## Decisiones (con su porqué)

- **Secciones** (`lib/permisos.mjs`, la única lista):
  `panel, rutas, recolecciones, incidentes, avisos, unidades, contenedores, zonas, solicitudes, altas,
  empleo, clientes, saldos, precios, servicios, reportes, usuarios, bitacora`, más los permisos sueltos
  `eliminar_clientes`.
- **Roles** (029): tabla `roles(id, nombre único, descripcion, permisos text[], creado, creado_por)` y
  `perfiles.rol_id → roles` (`set null`).
  - `tiene_permiso(p)`: dueño, o admin activo con `p` en los permisos de su rol o en `perfiles.permisos`.
- **Nadie pierde nada:** se siembra "Administrador completo", con todas las secciones **incluida
  `usuarios`**, porque hoy los admins invitan choferes. Excluye `precios` y `eliminar_clientes`, que hoy
  ya son aparte. Se asigna a todo admin sin rol.
  - Ruling: la spec decía "todo menos usuarios"; manda la regla de la misma spec de que "nadie pierde
    nada".
- **Base:** cada política `FOR ALL using (es_personal())` se parte en una de lectura (`es_personal()`) y
  tres de escritura (insert, update y delete) con `puede_seccion('<sección>')`, definida como
  `es_personal() and tiene_permiso(p)`. Tabla → sección:

  | Tabla | Sección |
  |---|---|
  | avisos | avisos |
  | contenedores | contenedores |
  | cotizaciones | solicitudes |
  | domicilios, suscripciones | clientes **o** rutas |
  | incidentes | incidentes |
  | perfiles | usuarios **o** clientes |
  | recolecciones, solicitudes_recoleccion, viajes_relleno | recolecciones |
  | rutas, sectores | rutas |
  | unidades | unidades |
  | vacantes, solicitudes_empleo (edita y borra) | empleo |
  | zonas_pedidas | zonas |
  | clientes (crea y edita) | clientes |
  | solicitudes_alta (edita) | altas |
  | movimientos_saldo (crea) | saldos |
  | storage `comprobantes` | saldos |
  | storage `evidencias` | recolecciones |
  | storage `curriculums` | empleo |
  | storage `incidentes` y `tickets` | incidentes **o** recolecciones |

  Las lecturas siguen con `es_personal()`; el riesgo queda documentado.
- **Páginas:** `proxy.js` consulta los permisos (perfil + rol) solo en `/admin/*` y redirige al Panel
  con `?sin_permiso=<sección>` si no los tiene. **Menú:** cada renglón lleva su `permiso`.
- **Acciones de servidor:** `lib/permisos-servidor.js`, con `exigirPermiso(p)`, que reemplaza los
  `PERSONAL` en las acciones del panel. El mapa acción → sección va en el mismo archivo.
- **API de las apps:** `entrarAppAdmin(peticion, { permiso })` en las rutas de administración.

## Tareas

1. **029 + test:db**
   - roles, `rol_id`, `puede_seccion`, siembra, partición de las ~30 políticas y storage;
   - casos: admin con rol limitado no escribe en otra sección pero sí lee; dueño todo; "Administrador
     completo" igual que hoy; un rol sin `usuarios` no crea perfiles; un rol borrado deja `rol_id` null.
2. **`lib/permisos.mjs`** (puro + pruebas): `SECCIONES`, `seccionDeRuta(path)`,
   `puede({ rol, permisos })`, `validarRol({ nombre, permisos })`.
3. **Servidor:**
   - `lib/permisos-servidor.js` (`permisosDe(sb, uid)`, `exigirPermiso`);
   - acciones de roles (`crearRol`, `editarRol`, `borrarRol`; solo el dueño);
   - acciones de usuarios: editar nombre, teléfono y rol; ver correo y último acceso; reenviar
     invitación; restablecer contraseña; eliminar (solo el dueño);
   - aplicar `exigirPermiso` en `acciones-*.js` y en las rutas `/api/app/*` de administración.
4. **`proxy.js`, `AdminShell` y `admin-sesion`:** permisos efectivos en la sesión, menú filtrado,
   guardia de páginas y aviso de "sin permiso" en el Panel.
5. **Pantallas:**
   - Usuarios y roles: pestaña Roles con casillas; editar usuario; acciones nuevas.
   - `/admin/cuenta` y `/chofer/cuenta` (Mi cuenta: nombre, teléfono, cambiar contraseña con la
     actual).
   - "¿Olvidaste tu contraseña?" en los logins del panel y del chofer.
6. **Docs, revisión independiente y entrega** (Luis corre la 029 antes del push).
