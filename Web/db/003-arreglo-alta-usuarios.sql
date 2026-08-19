-- =====================================================================
--  MORCAST — Arreglo del alta de usuarios
--  Se corre DESPUÉS de 001-esquema.sql y 002-rls.sql.
-- =====================================================================
--
--  QUÉ SE ROMPIÓ (11-ago-2026)
--  ---------------------------
--  Al crear el primer usuario por la API de administración, falló con
--  "perfiles violates check constraint perfil_coherente".
--
--  Motivo: Supabase inserta la fila en auth.users PRIMERO y aplica el
--  app_metadata DESPUÉS, en un paso aparte. El trigger corría en medio, veía
--  el rol vacío, caía al valor por defecto 'cliente'... y un cliente sin
--  empresa viola la restricción. El candado hizo su trabajo.
--
--  ARREGLO
--  -------
--  1. Se agrega el rol 'pendiente': existe pero todavía no tiene asignación.
--     Es el estado real de un usuario recién creado, así que ahora el modelo
--     dice la verdad en lugar de fingir que ya es cliente.
--  2. El trigger de alta usa 'pendiente' cuando aún no hay rol.
--  3. Un trigger nuevo sincroniza el perfil cuando el app_metadata cambia,
--     que es el momento en que de verdad llega el rol.
-- =====================================================================

-- 1) Permitir el rol 'pendiente'.
alter table public.perfiles drop constraint if exists perfiles_rol_check;
alter table public.perfiles add constraint perfiles_rol_check
  check (rol in ('dueno','admin','operador','cliente','pendiente'));

-- 2) Solo el rol 'cliente' lleva empresa. Todos los demás, incluido
--    'pendiente', van sin ella.
alter table public.perfiles drop constraint if exists perfil_coherente;
alter table public.perfiles add constraint perfil_coherente check (
  (rol =  'cliente' and cliente_id is not null) or
  (rol <> 'cliente' and cliente_id is null)
);

-- 3) Alta: si todavía no hay rol, nace 'pendiente'.
create or replace function public.nuevo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol     text;
  v_cliente uuid;
begin
  v_rol     := coalesce(new.raw_app_meta_data ->> 'rol', 'pendiente');
  v_cliente := nullif(new.raw_app_meta_data ->> 'cliente_id', '')::uuid;

  -- Coherencia: un cliente sin empresa no puede existir, así que se queda
  -- pendiente hasta que alguien le asigne una.
  if v_rol = 'cliente' and v_cliente is null then
    v_rol := 'pendiente';
  end if;
  if v_rol <> 'cliente' then
    v_cliente := null;
  end if;

  insert into public.perfiles (id, nombre, rol, cliente_id)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nombre', ''), v_rol, v_cliente)
  on conflict (id) do nothing;

  return new;
end;
$$;

-- 4) Sincronizar cuando cambie el app_metadata: ese es el momento en que
--    de verdad llega el rol.
--
--    Sigue leyéndose de app_metadata y NUNCA de user_metadata: lo segundo lo
--    edita el propio usuario desde el navegador, así que cualquiera podría
--    ascenderse solo. app_metadata solo se escribe con la llave de servicio.
create or replace function public.sincronizar_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol     text;
  v_cliente uuid;
begin
  if new.raw_app_meta_data is not distinct from old.raw_app_meta_data then
    return new;                                  -- no cambió nada relevante
  end if;

  v_rol     := new.raw_app_meta_data ->> 'rol';
  v_cliente := nullif(new.raw_app_meta_data ->> 'cliente_id', '')::uuid;
  if v_rol is null then
    return new;
  end if;

  if v_rol = 'cliente' and v_cliente is null then
    return new;                                  -- incoherente: no se aplica
  end if;
  if v_rol <> 'cliente' then
    v_cliente := null;
  end if;

  update public.perfiles
     set rol = v_rol, cliente_id = v_cliente
   where id = new.id;

  return new;
end;
$$;

drop trigger if exists al_cambiar_metadatos on auth.users;
create trigger al_cambiar_metadatos
  after update on auth.users
  for each row execute function public.sincronizar_perfil();

-- 5) Que el personal pueda ver también a los pendientes en el panel.
--    (Las políticas de 002-rls.sql ya cubren esto: es_personal() ve todo.)
