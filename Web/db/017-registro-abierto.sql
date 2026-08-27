-- =====================================================================
--  MORCAST DEL NORTE — 017: registro abierto con Google
--  Se corre DESPUES de 016-ubicacion-de-la-evidencia.sql.
-- =====================================================================
--
--  QUE ABRE ESTO
--  -------------
--  Cualquiera puede registrarse solo con su cuenta de Google. Registrarse
--  NO da acceso a nada: la persona queda con rol 'pendiente' y sin empresa,
--  asi que el RLS no le entrega una sola fila. Entra cuando Morcast la
--  activa desde el panel.
--
--  LO QUE NO HACE FALTA, PORQUE YA ESTABA
--  --------------------------------------
--  El rol 'pendiente' y el disparador que lo asigna los puso la 003 el
--  11-ago-2026, por el mismo motivo (createUser tronaba con
--  "perfiles violates check constraint perfil_coherente"). Verificado
--  contra produccion antes de escribir esto: `perfiles_rol_check` ya
--  incluye 'pendiente' y `nuevo_usuario()` ya hace
--  coalesce(raw_app_meta_data->>'rol', 'pendiente').
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1) De donde vino cada solicitud, y a que usuario pertenece.
--
--    `usuario_id` es lo que permite activar: sin el no se sabe a QUIEN
--    ponerle el sello. Va `on delete set null` y no `cascade`: si algun dia
--    se borra la cuenta, la solicitud se conserva como historia de que esa
--    empresa toco la puerta.
-- ---------------------------------------------------------------------
alter table public.solicitudes_alta
  add column if not exists origen            text    not null default 'formulario',
  add column if not exists usuario_id        uuid    references auth.users(id) on delete set null,
  add column if not exists correo_verificado boolean not null default false;

alter table public.solicitudes_alta drop constraint if exists solicitudes_alta_origen_check;
alter table public.solicitudes_alta
  add constraint solicitudes_alta_origen_check check (origen in ('formulario','google'));

-- Una persona deja sus datos UNA vez. Sin esto, recargar la pantalla de
-- registro crea filas gemelas y el panel muestra la misma empresa dos veces.
-- Parcial (`where usuario_id is not null`) para no estorbarle a las miles de
-- solicitudes del formulario publico, que no tienen usuario.
create unique index if not exists solicitudes_alta_usuario_idx
  on public.solicitudes_alta (usuario_id) where usuario_id is not null;

-- ---------------------------------------------------------------------
-- 2) Cuantas recolecciones al mes deja de ser obligatorio.
--
--    El formulario largo siempre lo pregunta; el registro con Google NO.
--    Rellenarlo con un numero inventado es el mismo error que ponerle a un
--    manifiesto el RFC de la empresa de ejemplo: el panel ensenaria un dato
--    que el cliente nunca dijo. Mejor vacio, y en pantalla una raya.
-- ---------------------------------------------------------------------
alter table public.solicitudes_alta alter column servicios_por_mes drop not null;

alter table public.solicitudes_alta
  drop constraint if exists solicitudes_alta_servicios_por_mes_check;
alter table public.solicitudes_alta
  add constraint solicitudes_alta_servicios_por_mes_check
  check (servicios_por_mes is null or servicios_por_mes between 1 and 200);

-- ---------------------------------------------------------------------
-- 3) Cosmetico, y a prueba de futuro: quitar el default 'cliente' del rol.
--
--    Hoy es inalcanzable —los tres insert sobre `perfiles` escriben el rol a
--    mano, y el unico sitio del codigo que crea usuarios es
--    activarCuentaCliente, que siempre manda app_metadata.rol— pero un
--    default que dice "cliente" es una invitacion a que el proximo insert se
--    lo salte. Que la columna no opine.
-- ---------------------------------------------------------------------
alter table public.perfiles alter column rol drop default;

commit;
