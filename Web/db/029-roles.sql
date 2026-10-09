-- =====================================================================
--  029 · ROLES PERSONALIZADOS (9-oct-2026)
--  Se corre DESPUÉS de 028. Pedido de Luis: "ponme la opción de agregar otro
--  rol y el dueño decida a qué tiene acceso". Ver
--  docs/superpowers/plans/2026-10-08-entrega-2-roles.md
--
--  · `roles`: el dueño los crea con casillas por sección.
--  · `perfiles.rol_id`: el rol de cada administrador. Sin rol, un admin
--    solo LEE (no escribe en ninguna sección).
--  · `tiene_permiso(p)`: dueño, o admin activo con `p` en su rol o en sus
--    permisos sueltos (`perfiles.permisos`, db/027).
--  · Las políticas "el personal hace todo" se parten: leer sigue siendo de
--    todo el personal; crear, editar y borrar pide la sección.
--  · Nadie pierde nada: si la tabla nace vacía se siembra "Administrador
--    completo" (todas las secciones salvo precios y eliminar_clientes, que
--    ya eran aparte) y se le pone a todo admin.
-- =====================================================================
begin;

-- ---------------------------------------------------------- la tabla
create table if not exists public.roles (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null unique check (length(btrim(nombre)) between 1 and 60),
  descripcion text,
  permisos    text[] not null default '{}',
  creado      timestamptz not null default now(),
  creado_por  uuid references public.perfiles (id) on delete set null
);

-- La única lista de secciones vive en lib/permisos.mjs; esta es su copia
-- (tests/permisos.test.mjs compara las dos).
alter table public.roles drop constraint if exists roles_permisos_validos;
alter table public.roles add constraint roles_permisos_validos check (permisos <@ array[
  'rutas', 'recolecciones', 'incidentes', 'avisos', 'unidades', 'contenedores', 'zonas',
  'solicitudes', 'altas', 'empleo', 'clientes', 'saldos', 'precios', 'servicios', 'reportes',
  'usuarios', 'bitacora', 'eliminar_clientes'
]::text[]);

alter table public.roles enable row level security;

drop policy if exists roles_leen on public.roles;
create policy roles_leen on public.roles for select to authenticated using (es_personal());
drop policy if exists roles_dueno on public.roles;
create policy roles_dueno on public.roles for all to authenticated using (es_dueno()) with check (es_dueno());

alter table public.perfiles add column if not exists rol_id uuid references public.roles (id) on delete set null;

-- ---------------------------------------------------------- funciones
create or replace function public.tiene_permiso(p text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select pf.rol = 'dueno'
        or (pf.rol = 'admin' and (p = any(pf.permisos) or p = any(coalesce(r.permisos, '{}'))))
    from public.perfiles pf
    left join public.roles r on r.id = pf.rol_id
    where pf.id = auth.uid() and pf.activo
  ), false)
$$;

-- Escribir en una sección del panel. Mismo que tiene_permiso; el nombre deja
-- claro en cada política que se habla de una sección.
create or replace function public.puede_seccion(p text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.tiene_permiso(p)
$$;

revoke all on function public.puede_seccion(text) from public, anon;
grant execute on function public.puede_seccion(text) to authenticated, service_role;

-- El rol de un admin solo lo cambia el dueño (como sus permisos sueltos).
create or replace function public.permisos_solo_dueno()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or es_dueno() then return new; end if;
  if (tg_op = 'INSERT' and (new.permisos <> '{}' or new.rol_id is not null))
     or (tg_op = 'UPDATE' and (new.permisos is distinct from old.permisos
                               or new.rol_id is distinct from old.rol_id)) then
    raise exception 'Solo el dueño asigna permisos y roles.';
  end if;
  return new;
end;
$$;

-- Bitácora: también cuando cambia el rol de alguien.
drop trigger if exists bitacora_perfiles_tg on public.perfiles;
create trigger bitacora_perfiles_tg
  after insert or delete or update of rol, cliente_id, activo, rol_id, permisos on public.perfiles
  for each row execute function public.bitacora_desde_la_base();
drop trigger if exists bitacora_roles_tg on public.roles;
create trigger bitacora_roles_tg
  after insert or delete or update on public.roles
  for each row execute function public.bitacora_desde_la_base();

-- ---------------------------------------------------------- partir políticas
-- Ayudante de esta migración (se borra al final): cambia la política "todo"
-- `viejo` por una de lectura (es_personal) y tres de escritura (`cond`).
create or replace function pg_temp.partir(tabla text, viejo text, cond text, filtro text default null)
returns void language plpgsql as $$
declare
  f text := coalesce(filtro || ' and ', '');
begin
  execute format('drop policy if exists %I on %s', viejo, tabla);
  execute format('drop policy if exists %I on %s', viejo || '_lee', tabla);
  execute format('drop policy if exists %I on %s', viejo || '_crea', tabla);
  execute format('drop policy if exists %I on %s', viejo || '_edita', tabla);
  execute format('drop policy if exists %I on %s', viejo || '_borra', tabla);
  execute format('create policy %I on %s for select to authenticated using (%s es_personal())',
                 viejo || '_lee', tabla, f);
  execute format('create policy %I on %s for insert to authenticated with check (%s %s)',
                 viejo || '_crea', tabla, f, cond);
  execute format('create policy %I on %s for update to authenticated using (%s %s) with check (%s %s)',
                 viejo || '_edita', tabla, f, cond, f, cond);
  execute format('create policy %I on %s for delete to authenticated using (%s %s)',
                 viejo || '_borra', tabla, f, cond);
end;
$$;

select pg_temp.partir('public.avisos',                  'avisos_personal',        $c$puede_seccion('avisos')$c$);
select pg_temp.partir('public.contenedores',            'contenedores_personal',  $c$puede_seccion('contenedores')$c$);
select pg_temp.partir('public.cotizaciones',            'cotizaciones_personal',  $c$puede_seccion('solicitudes')$c$);
select pg_temp.partir('public.domicilios',              'domicilios_personal',    $c$(puede_seccion('clientes') or puede_seccion('rutas'))$c$);
select pg_temp.partir('public.incidentes',              'incidentes_personal',    $c$puede_seccion('incidentes')$c$);
select pg_temp.partir('public.perfiles',                'perfiles_personal',      $c$(puede_seccion('usuarios') or puede_seccion('clientes'))$c$);
select pg_temp.partir('public.recolecciones',           'recolecciones_personal', $c$puede_seccion('recolecciones')$c$);
select pg_temp.partir('public.rutas',                   'rutas_personal',         $c$puede_seccion('rutas')$c$);
select pg_temp.partir('public.sectores',                'sectores_personal',      $c$puede_seccion('rutas')$c$);
select pg_temp.partir('public.solicitudes_recoleccion', 'solicitudes_personal',   $c$puede_seccion('recolecciones')$c$);
select pg_temp.partir('public.suscripciones',           'suscripciones_personal', $c$(puede_seccion('clientes') or puede_seccion('rutas') or puede_seccion('servicios'))$c$);
select pg_temp.partir('public.unidades',                'unidades_personal',      $c$puede_seccion('unidades')$c$);
select pg_temp.partir('public.vacantes',                'vacantes_personal',      $c$puede_seccion('empleo')$c$);
select pg_temp.partir('public.viajes_relleno',          'viajes_personal',        $c$puede_seccion('recolecciones')$c$);
select pg_temp.partir('public.zonas_pedidas',           'zonas_pedidas_personal', $c$puede_seccion('zonas')$c$);

select pg_temp.partir('storage.objects', 'comprobantes_personal',        $c$puede_seccion('saldos')$c$,        $f$bucket_id = 'comprobantes'$f$);
select pg_temp.partir('storage.objects', 'curriculums_personal',         $c$puede_seccion('empleo')$c$,        $f$bucket_id = 'curriculums'$f$);
select pg_temp.partir('storage.objects', 'evidencias_personal',          $c$puede_seccion('recolecciones')$c$, $f$bucket_id = 'evidencias'$f$);
select pg_temp.partir('storage.objects', 'incidentes_archivos_personal', $c$(puede_seccion('incidentes') or puede_seccion('recolecciones'))$c$,
                      $f$bucket_id = any (array['incidentes', 'tickets'])$f$);

-- Las que ya estaban partidas: solo cambia la escritura.
drop policy if exists clientes_personal_crea on public.clientes;
create policy clientes_personal_crea on public.clientes for insert to authenticated
  with check (puede_seccion('clientes'));
drop policy if exists clientes_personal_edita on public.clientes;
create policy clientes_personal_edita on public.clientes for update to authenticated
  using (puede_seccion('clientes')) with check (puede_seccion('clientes'));

drop policy if exists solicitudes_alta_edita_personal on public.solicitudes_alta;
create policy solicitudes_alta_edita_personal on public.solicitudes_alta for update to authenticated
  using (puede_seccion('altas')) with check (puede_seccion('altas'));

drop policy if exists solicitudes_empleo_edita_personal on public.solicitudes_empleo;
create policy solicitudes_empleo_edita_personal on public.solicitudes_empleo for update to authenticated
  using (puede_seccion('empleo')) with check (puede_seccion('empleo'));
drop policy if exists solicitudes_empleo_borra_personal on public.solicitudes_empleo;
create policy solicitudes_empleo_borra_personal on public.solicitudes_empleo for delete to authenticated
  using (puede_seccion('empleo'));

drop policy if exists movimientos_crea_personal on public.movimientos_saldo;
create policy movimientos_crea_personal on public.movimientos_saldo for insert to authenticated
  with check (puede_seccion('saldos') and (es_dueno() or tipo = 'cargo' or estado = 'por-verificar'));

-- ---------------------------------------------------------- nadie pierde nada
do $$
declare
  completo uuid;
begin
  if not exists (select 1 from public.roles) then
    insert into public.roles (nombre, descripcion, permisos)
    values ('Administrador completo',
            'Todo el panel, como hasta hoy. Precios y eliminar clientes se dan aparte.',
            array['rutas', 'recolecciones', 'incidentes', 'avisos', 'unidades', 'contenedores', 'zonas',
                  'solicitudes', 'altas', 'empleo', 'clientes', 'saldos', 'servicios', 'reportes',
                  'usuarios', 'bitacora'])
    returning id into completo;
    update public.perfiles set rol_id = completo where rol = 'admin' and rol_id is null;
  end if;
end;
$$;

commit;
