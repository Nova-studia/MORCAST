-- =====================================================================
--  MORCAST — Que el candado anti-escalada no bloquee al propio sistema
--  Se corre DESPUÉS de 003-arreglo-alta-usuarios.sql.
-- =====================================================================
--
--  QUÉ SE ROMPIÓ
--  -------------
--  Al crear el dueño: "No puedes cambiar tu rol, tu empresa ni tu estado."
--
--  Los dos candados se estorbaban. `sincronizar_perfil` hace un UPDATE sobre
--  `perfiles` para aplicar el rol que llegó en app_metadata; ese UPDATE
--  dispara `perfil_sin_escalar`, que pregunta si quien lo hace es personal de
--  Morcast. Como no hay ninguna sesión de navegador detrás (es el sistema),
--  `auth.uid()` viene nulo, `es_personal()` da falso, y lo bloquea.
--
--  ARREGLO
--  -------
--  Dejar pasar cuando NO hay usuario con sesión (`auth.uid() is null`), que
--  es el caso de la llave de servicio y de los triggers internos.
--
--  ¿Por qué es seguro? Porque el RLS es la puerta de afuera y ya cierra ese
--  camino: para actualizar `perfiles` hay que cumplir alguna política, y las
--  dos que existen exigen `id = auth.uid()` (falso si es nulo) o
--  `es_personal()`. Un visitante anónimo no puede actualizar nada, así que
--  llegar aquí con uid nulo solo pasa desde el servidor.
-- =====================================================================

create or replace function public.perfil_sin_escalar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Sin sesión de navegador: es el sistema (llave de servicio o un trigger).
  -- El RLS ya impidió que un anónimo llegara hasta aquí.
  if auth.uid() is null then
    return new;
  end if;

  -- Morcast sí puede reasignar roles y empresas.
  if es_personal() then
    return new;
  end if;

  if new.rol        is distinct from old.rol
     or new.cliente_id is distinct from old.cliente_id
     or new.activo     is distinct from old.activo then
    raise exception 'No puedes cambiar tu rol, tu empresa ni tu estado.';
  end if;

  return new;
end;
$$;
