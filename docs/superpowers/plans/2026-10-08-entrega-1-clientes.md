# Entrega 1 — Clientes completo · plan

> Ejecución: superpowers:executing-plans (en línea). Spec: `docs/superpowers/specs/2026-10-08-entregas-1-4-design.md` §Entrega 1.

**Goal:** Suspender (solo lectura + Agregar saldo, aviso rojo), dar de baja, reactivar y eliminar
clientes con efectos reales; ficha del cliente con datos, puntos y usuarios; cerrar el borrado en cascada.

**Architecture:**
- Reglas en la base (028): `mi_cliente_puede_operar()` y `mi_cliente_puede_pagar()` en las políticas de
  escritura del cliente; DELETE de `clientes` solo para el dueño o el permiso `eliminar_clientes`; llaves
  de dinero, precios y solicitudes con `restrict`.
- Lógica pura en `lib/estado-cliente.mjs`.
- Operaciones de varias tablas en `lib/clientes-servidor.js`, con la llave de servicio después de
  revisar el permiso, y puertas en `app/acciones-clientes.js`.

## Global constraints

- Migración `Web/db/027` → **`028-clientes-estados.sql`**: idempotente, `begin/commit`, security definer +
  `search_path`. Agregarla al bloque de idempotencia de `tests-db/candados.mjs`.
- **Suspendido:** entra, ve todo y **solo** Agregar saldo; aviso **rojo** fijo arriba ("Tu cuenta está
  suspendida. Contáctanos para restablecerla." + WhatsApp + llamada).
- **Baja:** no entra.
- **Eliminar:** el dueño o el permiso `eliminar_clientes`; se permite con historial, enseñando antes los
  conteos y pidiendo escribir el nombre de la empresa.
- Teléfono de contacto: `EMPRESA_COTIZACION.telefonos[0]` (`lib/cotizacion-datos.js`).
- Sin push a `main` y sin tocar producción. La migración la corre Luis.

## Review focus

1. Cliente suspendido que intenta agendar por la API o la app: la base lo rechaza.
2. Admin sin permiso que intenta borrar un cliente por la API: la base lo rechaza.
3. Eliminar un cliente con recolecciones, movimientos y precios: borra todo en orden, sin dejar usuarios
   de Auth huérfanos.
4. Reactivar después de una baja: los usuarios vuelven a entrar (se quita el bloqueo) y sus servicios
   quedan `pausada`.
5. Cliente con dos usuarios: Quitar acceso solo afecta al elegido.

---

### Task 1 — Migración 028 + test:db

**Files:** `Web/db/028-clientes-estados.sql` · `Web/tests-db/candados.mjs` (sección 22 y bloque de idempotencia)

1. **Prueba primero.** Agregar la sección 22. Casos:
   - `cli1` en `suspendido`: NO inserta solicitud, SÍ inserta un abono por verificar;
   - en `baja`: NO inserta ni solicitud ni abono;
   - el admin NO borra un cliente; el dueño sí;
   - un admin con `{eliminar_clientes}` sí borra;
   - el borrado de un cliente con movimientos falla por `restrict` hasta borrar sus movimientos (con la
     llave de servicio);
   - con la llave de servicio, `precios` del cliente se borran; con sesión, no;
   - `perfiles_permisos_validos` acepta `eliminar_clientes`.
2. Correr `npm run test:db` → falla.
3. Escribir la 028:
   - columnas `estado_motivo`, `estado_fecha`, `estado_por` en `clientes`;
   - funciones `mi_cliente_estado()`, `mi_cliente_puede_operar()` (activo o pendiente-info) y
     `mi_cliente_puede_pagar()` (también suspendido);
   - recrear `solicitudes_pide_el_cliente` (la de la 022 + `mi_cliente_puede_operar()`),
     `movimientos_sube_el_cliente` (+ `puede_pagar`) y `comprobantes_sube_cliente` (+ `puede_pagar`);
   - partir `clientes_personal` en select/insert/update (`es_personal()`) y delete
     (`es_dueno() or tiene_permiso('eliminar_clientes')`);
   - ampliar `perfiles_permisos_validos` a `{precios, eliminar_clientes}`;
   - pasar a `restrict` `movimientos_saldo_cliente_id_fkey`, `precios_cliente_id_fkey` y
     `solicitudes_recoleccion_cliente_id_fkey`;
   - `precios_no_se_tocan` también deja pasar `auth.uid() is null` (servidor).
4. Correr `npm run test:db` → TODO BIEN. Commit.

### Task 2 — Reglas puras (`lib/estado-cliente.mjs`)

**Produces:**
- `permisosDeEstado(estado)` → `{ entra, puedeOperar, puedePagar, aviso }`;
- `validarCambioEstado({ actual, nuevo, motivo })` → `{ ok, motivo? }` (motivo obligatorio para
  suspender o dar de baja; no se pasa a `pendiente-info` a mano);
- `resumenBorrado(conteos)` → texto;
- `puedeEliminarCliente({ rol, permisos })`.

Pruebas en `tests/estado-cliente.test.mjs` (existe; agregar casos). Primero en rojo, luego en verde. Commit.

### Task 3 — Servidor (`lib/clientes-servidor.js` + `app/acciones-clientes.js`)

Funciones (reciben `sb` de servicio y `actor`, y cuentan filas):
- `cambiarEstadoClienteCon`, con los efectos de cada estado:
  - **suspendido:** suscripciones activas a `pausada`;
  - **baja:** perfiles inactivos y bloqueados (`ban_duration`), suscripciones `cancelada`, solicitudes
    futuras `solicitada` o `confirmada` a `rechazada` con motivo, contenedores de sus domicilios a
    `en-bodega` sin domicilio, `push_tokens` de sus usuarios borrados;
  - **activo (reactivar):** perfiles activos y desbloqueados, suscripciones `cancelada` o `pausada` a
    `pausada`.
- `editarClienteCon`: campos permitidos; si queda completo, pasa de `pendiente-info` a `activo`.
- `conteosClienteCon` y `eliminarClienteCon`:
  1. foto en la bitácora;
  2. archivos de evidencias y comprobantes;
  3. recolecciones, solicitudes, movimientos, precios, avisos y domicilios;
  4. `auth.admin.deleteUser` de cada usuario;
  5. la empresa.
- `usuariosDeClienteCon` (correo y último acceso desde Auth), `quitarAccesoClienteCon`,
  `reenviarAccesoClienteCon` (recovery a `/portal/nueva-clave`, como `darAccesoAClienteCon`).
- `agregarPuntoCon`, `quitarPuntoCon` (con historial se cancela; sin historial se borra) y
  `cambiarServicioCon`.

En las acciones: `exigirPersonal` para todo; dueño o `eliminar_clientes` para eliminar. Pruebas con un
supabase falso para el orden del borrado y los efectos de baja. Commit.

### Task 4 — Panel

- `app/(admin)/admin/clientes/[id]/page.js`, la ficha: datos editables, estado con botones y motivo,
  eliminar con conteos y nombre, puntos, usuarios e historial corto.
- La lista: búsqueda, filtro de estado, enlace a la ficha, errores visibles y "Cargando…".

Build y revisión visual. Commit.

### Task 5 — Portal y apps (lado servidor)

- `portal-sesion.js`: `estado` y `uuid` en el expediente. `iniciarSesion` y `obtenerSesion` rechazan
  `baja` con su mensaje.
- `PortalShell`: aviso rojo fijo con WhatsApp y llamada si está suspendido. Agendar y Cotizar
  deshabilitados con explicación; Agregar saldo sigue disponible.
- `/api/app/*` de cliente: la baja ya se rechaza (perfil inactivo). El aviso visual de la app va por
  EAS Update.

Build y revisión visual. Commit.

### Task 6 — Cierre

- Docs (manual de empresa: Clientes) y memoria.
- Revisión independiente de la rama.
- Pasos de Luis: correr la 028 y después hacer el push.
