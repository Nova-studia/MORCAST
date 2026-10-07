-- =====================================================================
--  027 · PRECIOS REALES (7-oct-2026, pedido de Luis)
--  Se corre DESPUÉS de 026.
--
--  Lista general + precio especial por cliente + "¿Requiere factura?".
--  La tabla `precios` NO se edita ni se borra NUNCA: cada cambio es un
--  renglón nuevo con su "vale desde". Así lo ya cobrado conserva su precio
--  y el historial sale solo. Ver docs/superpowers/specs/2026-10-07-precios-design.md
-- =====================================================================
begin;

-- ---------------------------------------------------------- columnas
alter table public.clientes add column if not exists requiere_factura boolean not null default false;
alter table public.clientes add column if not exists es_prueba boolean not null default false;
alter table public.perfiles add column if not exists permisos text[] not null default '{}';

alter table public.perfiles drop constraint if exists perfiles_permisos_validos;
alter table public.perfiles add constraint perfiles_permisos_validos
  check (permisos <@ array['precios']::text[]);

-- Las cuentas de revisión de Apple y Google.
update public.clientes set es_prueba = true where folio like 'MOR-DEMO-%' and not es_prueba;

-- ---------------------------------------------------------- permiso
create or replace function public.tiene_permiso(p text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select rol = 'dueno' or (rol = 'admin' and p = any(permisos))
                   from public.perfiles where id = auth.uid() and activo), false)
$$;

-- ---------------------------------------------------------- conceptos
create table if not exists public.conceptos (
  id        uuid primary key default gen_random_uuid(),
  clave     text not null unique check (clave ~ '^[a-z0-9-]{2,60}$'),
  nombre    text not null check (length(trim(nombre)) between 2 and 120),
  unidad    text not null check (length(trim(unidad)) between 2 and 60),
  modalidad text not null check (modalidad in ('por-recoleccion', 'semanal', 'mensual', 'por-tonelada')),
  orden     integer not null default 0,
  activo    boolean not null default true,
  creado    timestamptz not null default now()
);
alter table public.conceptos enable row level security;
revoke all on public.conceptos from anon;

drop policy if exists conceptos_leen on public.conceptos;
create policy conceptos_leen on public.conceptos for select to authenticated
  using (es_personal() or (activo and mi_cliente() is not null));
drop policy if exists conceptos_escriben on public.conceptos;
create policy conceptos_escriben on public.conceptos for insert to authenticated
  with check (tiene_permiso('precios'));
drop policy if exists conceptos_cambian on public.conceptos;
create policy conceptos_cambian on public.conceptos for update to authenticated
  using (tiene_permiso('precios')) with check (tiene_permiso('precios'));
-- Sin política de delete: un concepto se desactiva, no se borra.

-- ---------------------------------------------------------- precios
create table if not exists public.precios (
  id          uuid primary key default gen_random_uuid(),
  concepto_id uuid not null references public.conceptos (id),
  cliente_id  uuid references public.clientes (id) on delete cascade,
  precio      numeric(12,2) check (precio >= 0),
  quitado     boolean not null default false,
  vale_desde  timestamptz not null default now(),
  creado_por  uuid references public.perfiles (id) on delete set null,
  creado      timestamptz not null default now(),
  check ((quitado and precio is null and cliente_id is not null) or (not quitado and precio is not null))
);
create index if not exists precios_busqueda_idx on public.precios (concepto_id, cliente_id, vale_desde desc);
alter table public.precios enable row level security;
revoke all on public.precios from anon;

drop policy if exists precios_leen on public.precios;
create policy precios_leen on public.precios for select to authenticated
  using (es_personal() or (mi_cliente() is not null and (cliente_id is null or cliente_id = mi_cliente())));
drop policy if exists precios_insertan on public.precios;
create policy precios_insertan on public.precios for insert to authenticated
  with check (tiene_permiso('precios') and creado_por = auth.uid()
              and vale_desde >= now() - interval '1 minute');

-- Nunca se edita ni se borra, ni con la llave de servicio desde la sesión.
create or replace function public.precios_no_se_tocan()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- pg_trigger_depth() > 1: el cambio lo dispara una llave foránea (on delete
  -- cascade / set null) al borrar un cliente o una cuenta, no una persona.
  if pg_trigger_depth() > 1 then
    return coalesce(new, old);
  end if;
  raise exception 'Los precios no se editan ni se borran: captura un precio nuevo.';
end;
$$;
drop trigger if exists precios_no_se_tocan_tg on public.precios;
create trigger precios_no_se_tocan_tg before update or delete on public.precios
  for each row execute function public.precios_no_se_tocan();

-- ---------------------------------------------------------- cuál precio toca
create or replace function public.precio_de(p_cliente uuid, p_concepto uuid, p_en timestamptz default now())
returns numeric language sql stable security definer set search_path = public as $$
  -- Es security definer: un cliente solo puede preguntar por SU empresa. Si
  -- pregunta por otra, se le contesta el precio de lista (nunca el especial ajeno).
  with quien as (
    select case when auth.uid() is null or es_personal() or coalesce(p_cliente = mi_cliente(), false)
                then p_cliente end as cliente
  ), especial as (
    select precio, quitado from public.precios
    where concepto_id = p_concepto and cliente_id = (select cliente from quien) and vale_desde <= p_en
    order by vale_desde desc, creado desc limit 1
  ), lista as (
    select precio from public.precios
    where concepto_id = p_concepto and cliente_id is null and vale_desde <= p_en
    order by vale_desde desc, creado desc limit 1
  )
  select case
    when exists (select 1 from especial where not quitado) then (select precio from especial)
    else (select precio from lista)
  end
$$;

-- El 16 % vive AQUÍ y solo aquí en la base.
create or replace function public.iva_de_cliente(p_cliente uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select case
    when not (auth.uid() is null or es_personal() or coalesce(p_cliente = mi_cliente(), false)) then null
    when coalesce((select requiere_factura from public.clientes where id = p_cliente), false) then 0.16
    else 0 end
$$;

-- ---------------------------------------------------------- candados de clientes/perfiles
-- requiere_factura es precio: solo con el permiso. es_prueba solo por SQL (sin sesión).
create or replace function public.cliente_campos_de_precio()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then
    if new.es_prueba then
      raise exception 'La marca de cuenta de revisión no se pone desde el sistema.';
    end if;
    if new.requiere_factura and not tiene_permiso('precios') then
      raise exception 'No tienes permiso para cambiar precios ni facturación.';
    end if;
    return new;
  end if;
  if new.es_prueba is distinct from old.es_prueba then
    raise exception 'La marca de cuenta de revisión no se cambia desde el sistema.';
  end if;
  if new.requiere_factura is distinct from old.requiere_factura and not tiene_permiso('precios') then
    raise exception 'No tienes permiso para cambiar precios ni facturación.';
  end if;
  return new;
end;
$$;
drop trigger if exists cliente_campos_de_precio_tg on public.clientes;
create trigger cliente_campos_de_precio_tg before insert or update on public.clientes
  for each row execute function public.cliente_campos_de_precio();

create or replace function public.permisos_solo_dueno()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or es_dueno() then return new; end if;
  if (tg_op = 'INSERT' and new.permisos <> '{}')
     or (tg_op = 'UPDATE' and new.permisos is distinct from old.permisos) then
    raise exception 'Solo el dueño asigna permisos.';
  end if;
  return new;
end;
$$;
drop trigger if exists permisos_solo_dueno_tg on public.perfiles;
create trigger permisos_solo_dueno_tg before insert or update on public.perfiles
  for each row execute function public.permisos_solo_dueno();

-- ---------------------------------------------------------- bitácora
drop trigger if exists bitacora_precios_tg on public.precios;
create trigger bitacora_precios_tg after insert on public.precios
  for each row execute function public.bitacora_desde_la_base();
drop trigger if exists bitacora_conceptos_tg on public.conceptos;
create trigger bitacora_conceptos_tg after insert or update on public.conceptos
  for each row execute function public.bitacora_desde_la_base();
-- clientes: solo cuando cambia la factura (el trigger general anotaría todo).
drop trigger if exists bitacora_factura_tg on public.clientes;
create trigger bitacora_factura_tg after update of requiere_factura on public.clientes
  for each row execute function public.bitacora_desde_la_base();

-- Toda función nueva nace ejecutable por PUBLIC (anónimos incluidos): se
-- cierra y se abre solo a sesiones y al servidor (revisión final, 7-oct).
revoke all on function public.precio_de(uuid, uuid, timestamptz) from public, anon;
revoke all on function public.iva_de_cliente(uuid) from public, anon;
grant execute on function public.precio_de(uuid, uuid, timestamptz) to authenticated, service_role;
grant execute on function public.iva_de_cliente(uuid) to authenticated, service_role;

commit;
