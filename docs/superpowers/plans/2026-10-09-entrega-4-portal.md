# Entrega 4 — Portal del cliente · plan

> Ejecución en línea (superpowers:executing-plans), TDD por tarea y una revisión independiente al final.
> Spec: `docs/superpowers/specs/2026-10-08-entregas-1-4-design.md` §Entrega 4. Los hechos del código salen del mapa del
> portal del 9-oct.

**Goal:** el cliente se atiende solo:
- su cuenta;
- cancelar o reagendar;
- contacto a la mano;
- errores que se dicen como errores.

## Restricción: las apps 1.1.1 instaladas

- Los estados de una solicitud no cambian.
- Cancelar = `rechazada` con `motivo_rechazo` "Cancelada por el cliente…". La web la enseña como **Cancelada**; la
  app, como Rechazada con ese motivo.
- Sin migración nueva: las acciones del cliente van por el servidor, con la llave de servicio, filtradas por
  `quien.cliente_id` (el mismo patrón que `avisarSolicitudNueva`).

## Decisiones

- **Mi cuenta** (`/portal/cuenta`):
  - Mis datos: nombre y teléfono del perfil, y contacto, teléfono y correo de avisos de la empresa (`clientes`).
    Solo esos campos, por el servidor.
  - Cambiar contraseña: la de staff, abierta al rol cliente.
  - Mis puntos: solo lectura.
  - Eliminar mi cuenta: `eliminarCuenta` de `lib/eliminar-cuenta.mjs`, con el token de la sesión y origen "web".
    Pide escribir ELIMINAR y luego cierra la sesión.
  - Razón social o RFC: botón de WhatsApp con un mensaje ya escrito.
  - El avatar del menú lleva a Mi cuenta.
- **Cancelar / reagendar:**
  - Cancelar si está `solicitada` o `confirmada` (nunca `en-ruta`).
  - Reagendar (cambiar `fecha_pedida`) solo si está `solicitada`, con fecha de hoy a +365.
  - A la oficina: correo y notificación. Si estaba confirmada, al chofer: push "quitada".
  - Queda en la bitácora.
- **Soporte:** `TarjetaSoporte` (WhatsApp, teléfono y correo) en Inicio y Mi cuenta, y "Contáctanos" en las
  vencidas de Agendar.
- **Errores:**
  - `listarSolicitudes`, `misServicios`, `misPuntos` y `resumenCliente` aceptan `{ lanzar: true }`.
  - Inicio, Agendar, Historial y Documentos enseñan "No se pudo cargar…" con **Reintentar**.
- **Detalles:**
  - el login respeta `?volver=`, solo rutas `/portal/…`;
  - Historial pierde sus filtros, que siempre salían vacíos;
  - se quita "Fase 2" de los dos menús;
  - el login ya no promete "saldo en tiempo real".
  - Ruling: el zoom de iPhone no aplica, porque los campos miden 18 px (0.95rem × 120 %).

## Tareas

1. **Mi cuenta:**
   - `lib/cuenta-cliente.mjs` (puro): `validarDatosCliente`, `mensajeCambioFiscal`;
   - `app/acciones-cuenta-cliente.js`;
   - `PUEDEN` con cliente;
   - la página y el avatar.
2. **Cancelar / reagendar:**
   - `lib/solicitud-cliente.mjs` (puro): `puedeCancelar`, `puedeReagendar`, `validarReagenda`, `estadoParaMostrar`,
     `MOTIVO_CANCELADA`;
   - las acciones;
   - el correo a la oficina;
   - los botones en Agendar;
   - "Cancelada" en las listas.
3. **Soporte:** `TarjetaSoporte` y "Contáctanos" en las vencidas.
4. **Errores con Reintentar** en las cuatro pantallas.
5. **Detalles** (volver, filtros, Fase 2, tiempo real).
6. **Manual, revisión independiente y entrega.**

## Review Focus

- Un cliente cancela o reagenda la solicitud de **otra** empresa mandando su id: debe negarse.
- Cancelar una parada que el chofer ya trae `en-ruta`: debe negarse con un mensaje claro.
- Eliminar la cuenta desde la web: borra solo ese usuario, nunca la empresa ni su historial, y cierra la sesión.
- `?volver=//evil.com` o `?volver=/admin`: el login no debe obedecerlos.
- Doble clic en Cancelar: un solo aviso a la oficina.
