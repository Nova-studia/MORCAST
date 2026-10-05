-- =====================================================================
--  MORCAST DEL NORTE — 024: ajustes de la revisión de la 023
--  Se corre DESPUÉS de 023-operacion-ampliada.sql (ya aplicada el 5-oct-2026).
-- =====================================================================
--
--  1. El chofer dejaba de ver al cliente y el domicilio de una parada en
--     cuanto la marcaba "No procedió": las políticas de la 013 solo cuentan
--     las paradas 'confirmada', 'en-ruta' y 'completada'. Su lista decía
--     "—", y un incidente sobre esa parada salía sin empresa.
--  2. La 023 reescribió `mis_rutas()` (de la 014) para que solo contara las
--     suscripciones activas. Pero esa función también la usa `rutas_lectura`:
--     un cliente con su suscripción pausada se quedaba sin ver su ruta en el
--     historial. Se devuelve como estaba y los avisos usan una función propia.
--
--  Idempotente.
-- =====================================================================

begin;

-- 1 · El chofer sigue viendo a quién visitó aunque no procediera.
drop policy if exists clientes_del_operador on public.clientes;
create policy clientes_del_operador on public.clientes
  for select to authenticated
  using (
    mi_rol() = 'operador'
    and id in (
      select s.cliente_id from public.solicitudes_recoleccion s
      where s.id in (select public.mis_paradas())
        and s.estado in ('confirmada', 'en-ruta', 'completada', 'no-procedio')
    )
  );

drop policy if exists domicilios_del_operador on public.domicilios;
create policy domicilios_del_operador on public.domicilios
  for select to authenticated
  using (
    mi_rol() = 'operador'
    and id in (
      select s.domicilio_id from public.solicitudes_recoleccion s
      where s.id in (select public.mis_paradas())
        and s.estado in ('confirmada', 'en-ruta', 'completada', 'no-procedio')
    )
  );

-- 2 · `mis_rutas()` vuelve a ser la de la 014 (todas las suscripciones)…
create or replace function public.mis_rutas()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select s.ruta_id
  from public.suscripciones s
  where s.cliente_id = public.mi_cliente()
    and s.ruta_id is not null
$$;

-- …y los avisos por ruta usan una propia, solo con las activas (igual que
-- los correos de lib/avisos.mjs: el portal y el correo dicen lo mismo).
create or replace function public.mis_rutas_activas()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select distinct ruta_id from public.suscripciones
   where cliente_id = public.mi_cliente() and ruta_id is not null and estado = 'activa'
$$;
revoke all on function public.mis_rutas_activas() from public;
grant execute on function public.mis_rutas_activas() to authenticated;

drop policy if exists avisos_lee_cliente on public.avisos;
create policy avisos_lee_cliente on public.avisos
  for select to authenticated
  using (
    mi_cliente() is not null and (
      alcance = 'todos'
      or (alcance = 'cliente' and cliente_id = mi_cliente())
      or (alcance = 'ruta'    and ruta_id    in (select public.mis_rutas_activas()))
      or (alcance = 'sector'  and sector_id  in (select public.mis_sectores()))
    )
  );

commit;
