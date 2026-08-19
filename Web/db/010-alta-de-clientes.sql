-- =====================================================================
--  010 · El alta de clientes deja de perderse, y la frecuencia se vuelve
--       un NÚMERO de recolecciones al mes
--
--  Dos cosas que iban juntas:
--
--  1. La pantalla /portal/alta calculaba la cobertura, enseñaba el
--     resultado y ahí moría. Quien se daba de alta creía haber pedido el
--     servicio y a Morcast nunca le llegaba nada. Ahora cae en una tabla.
--
--  2. "Frecuencia" era una lista (semanal/quincenal/mensual) y no servía:
--     un cliente no genera lo mismo todas las semanas. Ahora dice cuántas
--     recolecciones necesita AL MES y él las reparte como le convenga
--     (2 la primera semana, 4 la segunda, 3 la tercera...). El total es
--     lo que se contrata; el reparto es cosa suya.
-- =====================================================================

-- ---------------------------------------------------------------------
--  Suscripciones: cuántas recolecciones al mes
-- ---------------------------------------------------------------------
alter table public.suscripciones
  add column if not exists servicios_por_mes integer;

alter table public.suscripciones
  drop constraint if exists suscripciones_servicios_por_mes_check;
alter table public.suscripciones
  add constraint suscripciones_servicios_por_mes_check
  check (servicios_por_mes is null or (servicios_por_mes between 1 and 200));

-- Las que ya existen quedan en mensual. La columna `frecuencia` se conserva
-- (hay código y datos que la leen) pero deja de ofrecerse en pantalla.
update public.suscripciones set frecuencia = 'mensual' where frecuencia <> 'mensual';
alter table public.suscripciones alter column frecuencia set default 'mensual';

-- A las que ya estaban se les pone un número de arranque para que ninguna
-- quede sin dato: cuatro al mes es lo que equivalía la semanal.
update public.suscripciones set servicios_por_mes = 4 where servicios_por_mes is null;

-- ---------------------------------------------------------------------
--  Solicitudes de alta
--
--  Es la bandeja de "alguien quiere ser cliente". Se llena desde la
--  pantalla pública, así que NO tiene política de inserción: la escribe el
--  servidor con la llave de servicio. Si se abriera al público, cualquiera
--  podría llenar la tabla de basura desde fuera.
-- ---------------------------------------------------------------------
create table if not exists public.solicitudes_alta (
  id                uuid primary key default gen_random_uuid(),
  folio             text unique not null,

  -- contacto
  empresa           text not null,
  contacto          text not null,
  telefono          text not null,
  correo            text not null,

  -- dónde
  alias             text,
  calle             text,
  colonia           text,
  cp                text,
  referencias       text,
  lat               double precision,
  lng               double precision,

  -- qué necesita
  residuos          jsonb not null default '[]'::jsonb,
  equipo            jsonb not null default '[]'::jsonb,
  servicios_por_mes integer not null check (servicios_por_mes between 1 and 200),

  -- facturación
  razon_social      text,
  rfc               text,
  domicilio_fiscal  text,
  uso_cfdi          text,
  forma_pago        text,

  -- cobertura: se calcula al momento de mandarla, no después. Si mañana se
  -- redibuja la zona, queremos saber qué le dijimos AL CLIENTE ese día.
  en_cobertura      boolean not null default false,
  rutas_que_cubren  jsonb not null default '[]'::jsonb,

  estado            text not null default 'nueva'
                      check (estado in ('nueva','contactada','aprobada','rechazada')),
  notas             text not null default '',
  creado            timestamptz not null default now()
);
create index if not exists solicitudes_alta_creado_idx on public.solicitudes_alta (creado desc);
create index if not exists solicitudes_alta_estado_idx on public.solicitudes_alta (estado);

alter table public.solicitudes_alta enable row level security;

-- Solo el personal la ve y la trabaja. Sin política de INSERT a propósito.
drop policy if exists solicitudes_alta_lee_personal on public.solicitudes_alta;
create policy solicitudes_alta_lee_personal on public.solicitudes_alta
  for select to authenticated using (es_personal());

drop policy if exists solicitudes_alta_edita_personal on public.solicitudes_alta;
create policy solicitudes_alta_edita_personal on public.solicitudes_alta
  for update to authenticated using (es_personal()) with check (es_personal());
