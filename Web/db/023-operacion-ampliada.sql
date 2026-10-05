-- =====================================================================
--  MORCAST DEL NORTE — 023: la operación ampliada (pedidos de los dueños, 4-oct-2026)
--  Se corre DESPUÉS de 022-candados-de-seguridad.sql.
-- =====================================================================
--
--  QUÉ TRAE (un bloque por pedido de los dueños)
--  ----------------------------------------------
--   1. Sectores A, B, C y D que cubren Matamoros; cada punto cae en uno.
--      Los LÍMITES los dibujan los dueños en el panel: aquí solo nace la
--      tabla con los cuatro sectores vacíos.
--   2. Ubicación exacta de cada punto (para el pin de Google Maps): de dónde
--      salió (el panel o el GPS del chofer en su primera visita) y
--      referencias para llegar ("portón azul").
--   3. Inventario de unidades (camiones) y la unidad de cada ruta.
--   4. Inventario de contenedores, cada uno con su código para el QR.
--   5. Tipo de residuo al agendar, y "No procedió" con su motivo, que marca
--      el chofer cuando lo que encontró no es lo que se agendó. No se cobra.
--   6. Incidentes que reporta el chofer: accidente, retraso, falla, o un
--      contenedor dañado, movido o que no está.
--   7. Peso real: el del relleno sanitario, por VIAJE (así lo pesan) y, por
--      si acaso, también por recolección. El del chofer queda como estimado.
--   8. Avisos a clientes por sector, ruta o cliente (retrasos, reagendas).
--   9. Precio de cada servicio contratado, para la carga de clientes y el
--      cobro mensual (llega con el Excel de «Últimos pendientes»).
--
--  Todo es idempotente: se puede correr dos veces sin romper nada.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
--  1 · SECTORES
-- ---------------------------------------------------------------------
create table if not exists public.sectores (
  id      uuid primary key default gen_random_uuid(),
  clave   text unique not null,              -- 'A', 'B', 'C', 'D'
  nombre  text not null,
  color   text not null default '#2a6a99',
  zona    jsonb not null default '[]'::jsonb, -- polígono [[lat,lng], …], como rutas.zona
  activo  boolean not null default true,
  creado  timestamptz not null default now()
);
alter table public.sectores enable row level security;

insert into public.sectores (clave, nombre, color) values
  ('A', 'Sector A', '#2a6a99'),
  ('B', 'Sector B', '#265421'),
  ('C', 'Sector C', '#b45f06'),
  ('D', 'Sector D', '#7b3f8c')
on conflict (clave) do nothing;

-- Cualquiera con sesión los LEE (el mapa de cobertura y el portal los usan);
-- solo el personal los dibuja.
drop policy if exists sectores_lectura on public.sectores;
create policy sectores_lectura on public.sectores
  for select to authenticated using (true);
drop policy if exists sectores_personal on public.sectores;
create policy sectores_personal on public.sectores
  for all to authenticated using (es_personal()) with check (es_personal());


-- ---------------------------------------------------------------------
--  2 · UBICACIÓN EXACTA DE CADA PUNTO
-- ---------------------------------------------------------------------
alter table public.domicilios add column if not exists sector_id uuid
  references public.sectores (id) on delete set null;
alter table public.domicilios add column if not exists referencias text;
alter table public.domicilios add column if not exists ubicacion_origen text
  check (ubicacion_origen in ('panel', 'chofer'));
alter table public.domicilios add column if not exists ubicacion_fecha timestamptz;
create index if not exists domicilios_sector_idx on public.domicilios (sector_id);

-- En qué sector cae un punto. Misma regla que lib/punto-en-zona.mjs (rayo
-- horizontal) y que lib/sectores.mjs: si cayera en dos, se queda con el
-- primero por clave (A→D). Null si no cae en ninguno o no hay límites.
create or replace function public.sector_de_punto(p_lat double precision, p_lng double precision)
returns uuid
language plpgsql
stable
set search_path = public
as $$
declare
  v_sector record;
  v_n      integer;
  v_i      integer;
  v_j      integer;
  v_dentro boolean;
  lat_i double precision; lng_i double precision;
  lat_j double precision; lng_j double precision;
begin
  if p_lat is null or p_lng is null then
    return null;
  end if;
  for v_sector in
    select id, zona from public.sectores
     where activo and jsonb_typeof(zona) = 'array' and jsonb_array_length(zona) >= 3
     order by clave
  loop
    v_n := jsonb_array_length(v_sector.zona);
    v_dentro := false;
    v_j := v_n - 1;
    for v_i in 0 .. v_n - 1 loop
      lat_i := (v_sector.zona -> v_i ->> 0)::double precision;
      lng_i := (v_sector.zona -> v_i ->> 1)::double precision;
      lat_j := (v_sector.zona -> v_j ->> 0)::double precision;
      lng_j := (v_sector.zona -> v_j ->> 1)::double precision;
      if (lat_i > p_lat) <> (lat_j > p_lat)
         and p_lng < (lng_j - lng_i) * (p_lat - lat_i) / (lat_j - lat_i) + lng_i then
        v_dentro := not v_dentro;
      end if;
      v_j := v_i;
    end loop;
    if v_dentro then
      return v_sector.id;
    end if;
  end loop;
  return null;
end;
$$;

-- El chofer NO edita domicilios (es dato de Morcast), pero sí puede dejar
-- la ubicación de un punto que todavía no la tiene, parado frente a él en
-- su primera visita. Una función y no una política, para que solo pueda
-- tocar lat/lng de un punto de SUS paradas, y nunca pisar una ubicación
-- que ya puso el panel.
create or replace function public.fijar_ubicacion_punto(
  p_solicitud uuid, p_lat double precision, p_lng double precision
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dom uuid;
begin
  if p_lat is null or p_lng is null
     or p_lat not between 25.5 and 26.2 or p_lng not between -98.0 and -97.0 then
    raise exception 'Esa ubicación no está en Matamoros.';
  end if;

  select s.domicilio_id into v_dom
    from public.solicitudes_recoleccion s
   where s.id = p_solicitud and s.id in (select public.mis_paradas());
  if v_dom is null then
    raise exception 'Esa parada no es tuya.';
  end if;

  -- El sector se calcula aquí mismo: sin esto, el punto quedaría con el
  -- sector viejo hasta que alguien recalculara en el panel.
  update public.domicilios
     set lat = p_lat, lng = p_lng, ubicacion_origen = 'chofer', ubicacion_fecha = now(),
         sector_id = public.sector_de_punto(p_lat, p_lng)
   where id = v_dom and (lat is null or ubicacion_origen is distinct from 'panel');
  return found;
end;
$$;
revoke all on function public.fijar_ubicacion_punto(uuid, double precision, double precision) from public, anon;
grant execute on function public.fijar_ubicacion_punto(uuid, double precision, double precision) to authenticated;


-- ---------------------------------------------------------------------
--  3 · UNIDADES (camiones)
-- ---------------------------------------------------------------------
create table if not exists public.unidades (
  id                 uuid primary key default gen_random_uuid(),
  numero_economico   text unique not null,          -- el número pintado en la puerta
  placas             text unique,
  tipo               text not null default 'otro'
                       check (tipo in ('manual', 'roll-off', 'compactador', 'camioneta', 'otro')),
  marca_modelo       text,
  anio               integer check (anio between 1980 and 2100),
  estado             text not null default 'activa' check (estado in ('activa', 'taller', 'baja')),
  vence_seguro       date,
  vence_verificacion date,
  notas              text,
  creado             timestamptz not null default now()
);
alter table public.unidades enable row level security;

drop policy if exists unidades_personal on public.unidades;
create policy unidades_personal on public.unidades
  for all to authenticated using (es_personal()) with check (es_personal());
-- El chofer ve las unidades (para elegir en cuál va al reportar algo).
drop policy if exists unidades_lee_operador on public.unidades;
create policy unidades_lee_operador on public.unidades
  for select to authenticated using (mi_rol() = 'operador');

alter table public.rutas add column if not exists unidad_id uuid
  references public.unidades (id) on delete set null;


-- ---------------------------------------------------------------------
--  4 · CONTENEDORES (el inventario que va a hacer la empresa)
-- ---------------------------------------------------------------------
create table if not exists public.contenedores (
  id           uuid primary key default gen_random_uuid(),
  codigo       text unique not null,                -- MOR-C-0001: es lo que dice el QR
  tipo         text not null default 'contenedor',  -- contenedor, tolva, compactador, tambo…
  medida       text,                                -- '3 m³', '30 m³'
  estado       text not null default 'en-servicio'
                 check (estado in ('en-servicio', 'en-bodega', 'danado', 'perdido', 'baja')),
  domicilio_id uuid references public.domicilios (id) on delete set null,
  notas        text,
  creado       timestamptz not null default now(),
  actualizado  timestamptz not null default now()
);
alter table public.contenedores enable row level security;
create index if not exists contenedores_domicilio_idx on public.contenedores (domicilio_id);

-- Los puntos que visita el chofer (por sus paradas). Función para no caer
-- en la recursión entre políticas que ya se vio en 022.
create or replace function public.mis_puntos_de_ruta()
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select distinct s.domicilio_id
    from public.solicitudes_recoleccion s
   where s.id in (select public.mis_paradas()) and s.domicilio_id is not null
$$;
revoke all on function public.mis_puntos_de_ruta() from public;
grant execute on function public.mis_puntos_de_ruta() to authenticated;

drop policy if exists contenedores_personal on public.contenedores;
create policy contenedores_personal on public.contenedores
  for all to authenticated using (es_personal()) with check (es_personal());
drop policy if exists contenedores_lee_operador on public.contenedores;
create policy contenedores_lee_operador on public.contenedores
  for select to authenticated
  using (mi_rol() = 'operador' and domicilio_id in (select public.mis_puntos_de_ruta()));
drop policy if exists contenedores_lee_cliente on public.contenedores;
create policy contenedores_lee_cliente on public.contenedores
  for select to authenticated
  using (domicilio_id in (select public.mis_domicilios()));


-- ---------------------------------------------------------------------
--  5 · TIPO DE RESIDUO y "NO PROCEDIÓ"
-- ---------------------------------------------------------------------
--  `tipo_residuo` es texto: el catálogo vive en la web (lib/cotizar-whatsapp
--  TIPOS_RESIDUO) para poder agregar uno sin migración.
alter table public.solicitudes_recoleccion add column if not exists tipo_residuo text;
alter table public.solicitudes_recoleccion add column if not exists motivo_no_procedio text;
alter table public.solicitudes_recoleccion add column if not exists detalle_no_procedio text;

alter table public.solicitudes_recoleccion drop constraint if exists solicitudes_recoleccion_estado_check;
alter table public.solicitudes_recoleccion add constraint solicitudes_recoleccion_estado_check
  check (estado in ('solicitada', 'confirmada', 'en-ruta', 'completada', 'rechazada', 'no-procedio'));

-- El chofer ya podía pasar su parada a 'en-ruta' o 'completada' (013);
-- ahora también a 'no-procedio'.
drop policy if exists solicitudes_cierra_operador on public.solicitudes_recoleccion;
create policy solicitudes_cierra_operador on public.solicitudes_recoleccion
  for update to authenticated
  using (
    mi_rol() = 'operador'
    and id in (select public.mis_paradas())
    and estado in ('confirmada', 'en-ruta')
  )
  with check (
    id in (select public.mis_paradas())
    and estado in ('en-ruta', 'completada', 'no-procedio')
  );

-- El candado de 022 dejaba al chofer cambiar SOLO el estado. Para marcar
-- "No procedió" necesita además el motivo y el detalle. Sigue sin poder
-- tocar cliente, fechas, nota ni nada más. Y un "No procedió" sin motivo
-- no se acepta: es el respaldo ante el cliente.
create or replace function public.chofer_solo_cambia_estado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and mi_rol() = 'operador' then
    if (to_jsonb(new) - 'estado' - 'motivo_no_procedio' - 'detalle_no_procedio')
       is distinct from (to_jsonb(old) - 'estado' - 'motivo_no_procedio' - 'detalle_no_procedio') then
      raise exception 'El chofer solo puede cambiar el estado de su parada.';
    end if;
    if new.estado = 'no-procedio' and coalesce(trim(new.motivo_no_procedio), '') = '' then
      raise exception 'Para marcar "No procedió" hay que decir el motivo.';
    end if;
    if new.estado is distinct from 'no-procedio'
       and (new.motivo_no_procedio is distinct from old.motivo_no_procedio
         or new.detalle_no_procedio is distinct from old.detalle_no_procedio) then
      raise exception 'El motivo solo se escribe al marcar "No procedió".';
    end if;
  end if;
  return new;
end;
$$;


-- ---------------------------------------------------------------------
--  6 · INCIDENTES que reporta el chofer
-- ---------------------------------------------------------------------
create table if not exists public.incidentes (
  id            uuid primary key default gen_random_uuid(),
  tipo          text not null check (tipo in (
                  'accidente', 'retraso', 'falla-mecanica',
                  'contenedor-danado', 'contenedor-movido', 'contenedor-no-esta', 'otro')),
  descripcion   text,
  retraso_min   integer check (retraso_min between 0 and 1440),
  foto          text,                -- ruta en la cubeta "incidentes"
  ubicacion     jsonb,               -- {lat,lng,precision_m,capturada}
  operador_id   uuid references public.perfiles (id) on delete set null default auth.uid(),
  unidad_id     uuid references public.unidades (id) on delete set null,
  ruta_id       uuid references public.rutas (id) on delete set null,
  solicitud_id  uuid references public.solicitudes_recoleccion (id) on delete set null,
  contenedor_id uuid references public.contenedores (id) on delete set null,
  estado        text not null default 'abierto' check (estado in ('abierto', 'atendido')),
  atendido_por  uuid references public.perfiles (id) on delete set null,
  atendido_en   timestamptz,
  nota_atencion text,
  creado        timestamptz not null default now()
);
alter table public.incidentes enable row level security;
create index if not exists incidentes_creado_idx on public.incidentes (creado desc);

drop policy if exists incidentes_personal on public.incidentes;
create policy incidentes_personal on public.incidentes
  for all to authenticated using (es_personal()) with check (es_personal());
-- El chofer reporta a su nombre, siempre "abierto", y si lo amarra a una
-- parada tiene que ser una de las suyas. Ve solo los que él reportó.
drop policy if exists incidentes_reporta_operador on public.incidentes;
create policy incidentes_reporta_operador on public.incidentes
  for insert to authenticated
  with check (
    mi_rol() = 'operador'
    and operador_id = auth.uid()
    and estado = 'abierto'
    and atendido_por is null
    and (solicitud_id is null or solicitud_id in (select public.mis_paradas()))
  );
drop policy if exists incidentes_lee_operador on public.incidentes;
create policy incidentes_lee_operador on public.incidentes
  for select to authenticated using (operador_id = auth.uid());

-- Cubetas privadas: fotos de incidentes y tickets de báscula.
insert into storage.buckets (id, name, public)
values ('incidentes', 'incidentes', false), ('tickets', 'tickets', false)
on conflict (id) do nothing;

drop policy if exists incidentes_archivos_personal on storage.objects;
create policy incidentes_archivos_personal on storage.objects
  for all to authenticated
  using (bucket_id in ('incidentes', 'tickets') and es_personal())
  with check (bucket_id in ('incidentes', 'tickets') and es_personal());
-- El chofer sube y ve solo en SU carpeta: incidentes/<su uid>/…
drop policy if exists incidentes_sube_operador on storage.objects;
create policy incidentes_sube_operador on storage.objects
  for insert to authenticated
  with check (bucket_id = 'incidentes' and mi_rol() = 'operador' and carpeta_uuid(name) = auth.uid());
drop policy if exists incidentes_lee_operador on storage.objects;
create policy incidentes_lee_operador on storage.objects
  for select to authenticated
  using (bucket_id = 'incidentes' and carpeta_uuid(name) = auth.uid());


-- ---------------------------------------------------------------------
--  7 · PESO REAL (báscula del relleno sanitario)
-- ---------------------------------------------------------------------
--  El relleno pesa el CAMIÓN completo: el peso real se guarda por viaje,
--  con las recolecciones que iban en él. Y, por si acaso, también se puede
--  poner el peso real de una recolección suelta (roll-off: un contenedor
--  por viaje). El peso del chofer queda como estimado.
create table if not exists public.viajes_relleno (
  id            uuid primary key default gen_random_uuid(),
  fecha         date not null default current_date,
  unidad_id     uuid references public.unidades (id) on delete set null,
  operador_id   uuid references public.perfiles (id) on delete set null,
  peso_real_kg  numeric(10,2) not null check (peso_real_kg > 0),
  folio_ticket  text,
  foto_ticket   text,                -- ruta en la cubeta "tickets"
  notas         text,
  creado_por    uuid references public.perfiles (id) on delete set null default auth.uid(),
  creado        timestamptz not null default now()
);
alter table public.viajes_relleno enable row level security;
drop policy if exists viajes_personal on public.viajes_relleno;
create policy viajes_personal on public.viajes_relleno
  for all to authenticated using (es_personal()) with check (es_personal());

alter table public.recolecciones add column if not exists peso_es_estimado boolean not null default true;
alter table public.recolecciones add column if not exists peso_real_kg numeric(10,2) check (peso_real_kg > 0);
alter table public.recolecciones add column if not exists peso_real_por uuid references public.perfiles (id) on delete set null;
alter table public.recolecciones add column if not exists peso_real_en timestamptz;
alter table public.recolecciones add column if not exists viaje_id uuid references public.viajes_relleno (id) on delete set null;
create index if not exists recolecciones_viaje_idx on public.recolecciones (viaje_id);

-- El chofer puede corregir su peso ESTIMADO (012), pero el real lo pone
-- Morcast con el ticket: no lo toca.
create or replace function public.peso_real_solo_personal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not es_personal()
     and (new.peso_real_kg is distinct from old.peso_real_kg
       or new.peso_real_por is distinct from old.peso_real_por
       or new.peso_real_en  is distinct from old.peso_real_en
       or new.viaje_id      is distinct from old.viaje_id) then
    raise exception 'El peso real lo registra la administración.';
  end if;
  return new;
end;
$$;
drop trigger if exists peso_real_solo_personal_tg on public.recolecciones;
create trigger peso_real_solo_personal_tg
  before update on public.recolecciones
  for each row execute function public.peso_real_solo_personal();


-- ---------------------------------------------------------------------
--  8 · AVISOS A CLIENTES
-- ---------------------------------------------------------------------
create table if not exists public.avisos (
  id               uuid primary key default gen_random_uuid(),
  titulo           text not null,
  mensaje          text not null,
  motivo           text not null default 'general' check (motivo in ('retraso', 'reagenda', 'general')),
  alcance          text not null check (alcance in ('todos', 'sector', 'ruta', 'cliente')),
  sector_id        uuid references public.sectores (id) on delete cascade,
  ruta_id          uuid references public.rutas (id) on delete cascade,
  cliente_id       uuid references public.clientes (id) on delete cascade,
  vigente_hasta    date,
  correos_enviados integer not null default 0,
  enviado_por      uuid references public.perfiles (id) on delete set null default auth.uid(),
  creado           timestamptz not null default now(),
  check (
    (alcance = 'todos'   and sector_id is null and ruta_id is null and cliente_id is null) or
    (alcance = 'sector'  and sector_id is not null) or
    (alcance = 'ruta'    and ruta_id is not null) or
    (alcance = 'cliente' and cliente_id is not null)
  )
);
alter table public.avisos enable row level security;
create index if not exists avisos_creado_idx on public.avisos (creado desc);

-- Rutas y sectores de MI empresa (por mis suscripciones y mis puntos).
create or replace function public.mis_rutas()
returns setof uuid language sql stable security definer set search_path = public as $$
  select distinct ruta_id from public.suscripciones
   where cliente_id = public.mi_cliente() and ruta_id is not null
$$;
create or replace function public.mis_sectores()
returns setof uuid language sql stable security definer set search_path = public as $$
  select distinct sector_id from public.domicilios
   where cliente_id = public.mi_cliente() and sector_id is not null
$$;
revoke all on function public.mis_rutas() from public;
revoke all on function public.mis_sectores() from public;
grant execute on function public.mis_rutas() to authenticated;
grant execute on function public.mis_sectores() to authenticated;

drop policy if exists avisos_personal on public.avisos;
create policy avisos_personal on public.avisos
  for all to authenticated using (es_personal()) with check (es_personal());
-- El cliente ve los avisos que le tocan: a todos, a su sector, a su ruta o
-- a su empresa.
drop policy if exists avisos_lee_cliente on public.avisos;
create policy avisos_lee_cliente on public.avisos
  for select to authenticated
  using (
    mi_cliente() is not null and (
      alcance = 'todos'
      or (alcance = 'cliente' and cliente_id = mi_cliente())
      or (alcance = 'ruta'    and ruta_id    in (select public.mis_rutas()))
      or (alcance = 'sector'  and sector_id  in (select public.mis_sectores()))
    )
  );


-- ---------------------------------------------------------------------
--  9 · PRECIO DE CADA SERVICIO CONTRATADO
-- ---------------------------------------------------------------------
alter table public.suscripciones add column if not exists precio numeric(12,2) check (precio >= 0);
alter table public.suscripciones add column if not exists modalidad text
  check (modalidad in ('por-recoleccion', 'mensual', 'semanal', 'por-tonelada'));
alter table public.suscripciones add column if not exists incluye_iva boolean;
alter table public.suscripciones add column if not exists tipo_residuo text;
alter table public.suscripciones add column if not exists precio_notas text;


-- ---------------------------------------------------------------------
--  10 · BITÁCORA (la de 022) para lo nuevo que mueve inventario o dinero
-- ---------------------------------------------------------------------
drop trigger if exists bitacora_unidades_tg on public.unidades;
create trigger bitacora_unidades_tg
  after insert or delete or update of estado on public.unidades
  for each row execute function public.bitacora_desde_la_base();

drop trigger if exists bitacora_contenedores_tg on public.contenedores;
create trigger bitacora_contenedores_tg
  after insert or delete or update of estado, domicilio_id on public.contenedores
  for each row execute function public.bitacora_desde_la_base();

drop trigger if exists bitacora_viajes_tg on public.viajes_relleno;
create trigger bitacora_viajes_tg
  after insert or delete or update of peso_real_kg on public.viajes_relleno
  for each row execute function public.bitacora_desde_la_base();

drop trigger if exists bitacora_suscripciones_tg on public.suscripciones;
create trigger bitacora_suscripciones_tg
  after update of precio, modalidad, incluye_iva on public.suscripciones
  for each row execute function public.bitacora_desde_la_base();

-- Supabase da por defecto todos los permisos de las tablas nuevas a anon:
-- con RLS no verían nada, pero no tienen por qué ni intentarlo.
revoke all on public.sectores, public.unidades, public.contenedores, public.incidentes,
              public.viajes_relleno, public.avisos from anon;

commit;
