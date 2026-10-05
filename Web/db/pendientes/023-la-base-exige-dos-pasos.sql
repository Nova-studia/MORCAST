-- =====================================================================
--  MORCAST DEL NORTE — 023: la BASE exige el segundo paso al personal
--  ⚠️ PENDIENTE. NO correr todavía: ver "CUÁNDO" abajo.
--  Va DESPUÉS de 022-candados-de-seguridad.sql.
-- =====================================================================
--
--  POR QUÉ
--  -------
--  Desde la rama `seguridad-oct` el panel web pide el segundo paso (código
--  de Google Authenticator) a dueño y administradores: proxy.js y
--  usuarioActual() no dejan pasar una sesión de solo contraseña (aal1).
--
--  Pero eso lo revisa la WEB. Quien tenga la contraseña de un admin puede
--  iniciar sesión directo contra la API de Supabase (la llave pública va
--  dentro de la página) y leer lo que el RLS le deje leer a un admin. Para
--  cerrar esa puerta, la base misma tiene que pedir `aal2` en el token.
--
--  CUÁNDO
--  ------
--  Cuando la sección de administración de las APPS (iOS y Android) también
--  pida el código. Hoy las apps inician sesión con solo contraseña: si se
--  corre esto antes, la administración desde el teléfono deja de ver datos
--  (los choferes y los clientes NO se ven afectados: esto solo toca
--  es_personal() y es_dueno()).
--  Si la administración desde el teléfono no se usa, se puede correr ya.
--
--  CÓMO SE DESHACE
--  ---------------
--  Volver a correr las dos funciones como están en 002-rls.sql.
-- =====================================================================

begin;

create or replace function public.es_personal()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select rol in ('dueno','admin')
                   from public.perfiles where id = auth.uid() and activo), false)
     and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
$$;

create or replace function public.es_dueno()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select rol = 'dueno'
                   from public.perfiles where id = auth.uid() and activo), false)
     and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
$$;

commit;
