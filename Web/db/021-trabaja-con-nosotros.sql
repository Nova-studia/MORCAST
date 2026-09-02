-- =====================================================================
--  021 — TRABAJA CON NOSOTROS: vacantes y solicitudes de empleo
--
--  Se corre en Supabase → SQL Editor → New query → Run.
--
--  Lo que hace distinto a esto de todo lo anterior: QUIEN APLICA NO TIENE
--  SESION. Por eso `solicitudes_empleo` no lleva politica de insercion y la
--  cubeta `curriculums` no lleva ninguna politica publica: escribe el
--  servidor con la llave de servicio, que se salta el RLS.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
--  VACANTES — las publica Morcast desde el panel.
-- ---------------------------------------------------------------------
create table if not exists public.vacantes (
  id          uuid primary key default gen_random_uuid(),
  puesto      text not null,
  area        text not null check (area in ('operacion','oficina')),
  tipo        text not null check (tipo in ('tiempo-completo','medio-tiempo','temporal')),
  descripcion text not null default '',
  requisitos  jsonb not null default '[]'::jsonb,
  estado      text not null default 'abierta' check (estado in ('abierta','cerrada')),
  creada_por  uuid references public.perfiles(id) on delete set null,
  creado      timestamptz not null default now()
);
create index if not exists vacantes_estado_idx on public.vacantes (estado, creado desc);

alter table public.vacantes enable row level security;

-- Solo el personal. La pagina publica NO lee de aqui con la llave anonima:
-- la lee el servidor y devuelve solo lo que se enseña (ver acciones-empleo).
drop policy if exists vacantes_personal on public.vacantes;
create policy vacantes_personal on public.vacantes
  for all to authenticated
  using (es_personal()) with check (es_personal());

-- ---------------------------------------------------------------------
--  SOLICITUDES DE EMPLEO — las manda cualquiera desde la pagina publica.
-- ---------------------------------------------------------------------
create table if not exists public.solicitudes_empleo (
  id                uuid primary key default gen_random_uuid(),
  folio             text unique not null,
  nombre            text not null,
  telefono          text not null,
  correo            text,                    -- opcional a proposito
  puesto            text not null,
  -- `set null` ademas del candado de la aplicacion: si alguien borrara una
  -- vacante por SQL directo, la solicitud sobrevive.
  vacante_id        uuid references public.vacantes(id) on delete set null,
  experiencia       text not null,
  cv_ruta           text,                    -- null si no subio nada
  estado            text not null default 'nueva'
                      check (estado in ('nueva','revisada','contactada','descartada')),
  notas             text not null default '',
  aviso_aceptado_en timestamptz not null default now(),
  aviso_version     text not null,
  creado            timestamptz not null default now()
);
create index if not exists solicitudes_empleo_creado_idx on public.solicitudes_empleo (creado desc);
create index if not exists solicitudes_empleo_estado_idx on public.solicitudes_empleo (estado);
create index if not exists solicitudes_empleo_vacante_idx on public.solicitudes_empleo (vacante_id);

alter table public.solicitudes_empleo enable row level security;

-- Lee y trabaja solo el personal. SIN POLITICA DE INSERT, a proposito: si se
-- abriera al publico, cualquiera llenaria la tabla de basura desde fuera.
drop policy if exists solicitudes_empleo_lee_personal on public.solicitudes_empleo;
create policy solicitudes_empleo_lee_personal on public.solicitudes_empleo
  for select to authenticated using (es_personal());

drop policy if exists solicitudes_empleo_edita_personal on public.solicitudes_empleo;
create policy solicitudes_empleo_edita_personal on public.solicitudes_empleo
  for update to authenticated using (es_personal()) with check (es_personal());

drop policy if exists solicitudes_empleo_borra_personal on public.solicitudes_empleo;
create policy solicitudes_empleo_borra_personal on public.solicitudes_empleo
  for delete to authenticated using (es_personal());

-- ---------------------------------------------------------------------
--  FRENO — 3 solicitudes por telefono cada 24 horas.
--
--  NO se reusa `intentos_recuperacion`: esa guarda la hora del ultimo intento
--  y sirve para permitir UNO por ventana. Aqui hacen falta TRES, o sea un
--  contador. Lo que si se reusa es la tecnica: la decision en UNA sentencia,
--  que es lo que la hace atomica.
-- ---------------------------------------------------------------------
create table if not exists public.intentos_empleo (
  telefono text primary key,
  intentos integer not null default 1,
  ventana  timestamptz not null default now()
);

-- Con RLS encendido y sin politicas queda cerrada a todo el mundo. Solo la
-- toca el servidor con la llave de servicio. Si se pudiera leer, seria una
-- lista de telefonos de gente buscando trabajo.
alter table public.intentos_empleo enable row level security;

create index if not exists intentos_empleo_ventana_idx on public.intentos_empleo (ventana);

comment on table public.intentos_empleo is
  'Freno de la pagina publica de empleo. Un renglon por telefono.';

-- ---------------------------------------------------------------------
--  La decision, en UNA sola sentencia.
--
--  Anota el intento y dice si cabe: 3 por telefono cada 24 horas. Adentro
--  del ON CONFLICT DO UPDATE, `intentos_empleo.ventana` / `.intentos` son la
--  fila que YA EXISTIA (antes de este UPDATE); `excluded` seria la fila
--  propuesta para insertar, que aqui no hace falta porque el numero (3) esta
--  escrito en el CASE y no en el valor que se intento insertar. El RETURNING
--  de un INSERT ... ON CONFLICT DO UPDATE entrega la fila tal como queda
--  DESPUES del UPDATE, asi que `v_intentos` siempre trae el conteo ya
--  incrementado (o reiniciado a 1 si la ventana ya vencio), nunca el de antes.
-- ---------------------------------------------------------------------
create or replace function public.puede_solicitar_empleo(p_telefono text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_intentos integer;
begin
  insert into public.intentos_empleo (telefono, intentos, ventana)
  values (p_telefono, 1, now())
  on conflict (telefono) do update
    set intentos = case
          when intentos_empleo.ventana < now() - interval '24 hours' then 1
          else intentos_empleo.intentos + 1
        end,
        ventana = case
          when intentos_empleo.ventana < now() - interval '24 hours' then now()
          else intentos_empleo.ventana
        end
  returning intentos into v_intentos;

  -- ⚠️ El 3 tambien esta en `TOPE_POR_DIA` de lib/empleo.mjs, que solo lo usa
  -- para redactar el mensaje. Aqui es donde MANDA. Si se cambia uno, el otro.
  return coalesce(v_intentos, 1) <= 3;
end;
$$;

comment on function public.puede_solicitar_empleo(text) is
  'Anota el intento y dice si cabe. 3 por telefono cada 24 horas.';

-- Que solo la pueda llamar el servidor, igual que puede_pedir_recuperacion
-- en 018. La funcion es SECURITY DEFINER: sin este revoke, cualquiera con
-- sesion (o con la llave anonima) podria llamarla directo y usarla para
-- tantear telefonos de gente que aplico, aunque no pueda leer la tabla.
revoke all on function public.puede_solicitar_empleo(text) from public, anon, authenticated;
grant execute on function public.puede_solicitar_empleo(text) to service_role;

-- Devuelve el intento cuando la solicitud NO se llego a guardar.
-- El freno se cobra por adelantado a proposito: si se cobrara al final, quien
-- quiera abusar sube archivos de 5 MB sin tope. Pero cobrarselo a alguien cuya
-- solicitud fallo por culpa nuestra lo deja bloqueado 24 horas sin haber
-- mandado nada. Se compensa, igual que se borra el archivo huerfano.
create or replace function public.devolver_intento_empleo(p_telefono text)
returns void language sql security definer set search_path = public as $$
  update public.intentos_empleo
     set intentos = greatest(intentos - 1, 0)
   where telefono = p_telefono;
$$;

revoke all on function public.devolver_intento_empleo(text) from public, anon, authenticated;
grant execute on function public.devolver_intento_empleo(text) to service_role;

commit;

-- =====================================================================
--  LA CUBETA — se crea a mano en Supabase → Storage → New bucket:
--    nombre: curriculums
--    Public bucket: NO
--  Y despues se corre esto:
-- =====================================================================

-- Solo el personal, y nadie mas. No hay politica para anonimos NI para
-- clientes: quien aplica nunca toca Storage, sube el servidor por el.
drop policy if exists curriculums_personal on storage.objects;
create policy curriculums_personal on storage.objects
  for all to authenticated
  using (bucket_id = 'curriculums' and es_personal())
  with check (bucket_id = 'curriculums' and es_personal());
