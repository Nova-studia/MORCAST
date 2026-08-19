-- ============================================================
-- MORCAST DEL NORTE — Esquema de base de datos
-- Ejecutar en: Supabase -> SQL Editor -> New query -> Run
-- ============================================================

create table if not exists public.cotizaciones (
  id            uuid primary key default gen_random_uuid(),
  creado_en     timestamptz not null default now(),

  -- Datos del prospecto
  nombre        text not null,
  empresa       text,
  telefono      text not null,
  correo        text not null,
  tipo_servicio text not null,
  frecuencia    text,
  direccion     text,
  mensaje       text,

  -- Seguimiento comercial
  estado        text not null default 'nueva'
                check (estado in ('nueva','contactada','cotizada','ganada','perdida')),
  notas         text,

  -- Auditoría
  origen_ip     text,
  user_agent    text
);

create index if not exists cotizaciones_creado_en_idx
  on public.cotizaciones (creado_en desc);

create index if not exists cotizaciones_estado_idx
  on public.cotizaciones (estado);

-- ------------------------------------------------------------
-- Seguridad
-- ------------------------------------------------------------
-- RLS activo y SIN políticas: nadie puede leer ni escribir con la
-- clave anon. El sitio inserta desde una Server Action usando la
-- service role key, que salta RLS por diseño.
-- Esto evita que alguien lea la lista de prospectos desde el navegador.
alter table public.cotizaciones enable row level security;

-- ------------------------------------------------------------
-- Vista rápida para el equipo comercial
-- ------------------------------------------------------------
create or replace view public.cotizaciones_pendientes as
  select id, creado_en, nombre, empresa, telefono, correo,
         tipo_servicio, frecuencia, direccion, mensaje
  from public.cotizaciones
  where estado = 'nueva'
  order by creado_en desc;

comment on table public.cotizaciones is
  'Solicitudes de cotización enviadas desde el sitio web de Morcast del Norte.';
