-- =====================================================================
--  MORCAST DEL NORTE — Esquema de la base de datos
--  Se corre UNA vez en Supabase → SQL Editor → New query → Run.
--  Después corre 002-rls.sql, que es el que pone los candados.
-- =====================================================================
--
--  REGLA QUE NO SE ROMPE: aquí NO se guardan datos bancarios del cliente
--  (banco, número de cuenta, CLABE ni tarjeta). Morcast cobra a su propia
--  cuenta, así que guardarlos solo agrega obligaciones legales sin darnos
--  ningún beneficio. Solo se guarda lo fiscal: RFC, régimen, uso de CFDI,
--  domicilio fiscal y la forma de pago preferida.
-- =====================================================================

-- ---------------------------------------------------------------------
-- CLIENTES — la empresa contratante. No inicia sesión: eso son los perfiles.
-- ---------------------------------------------------------------------
create table if not exists public.clientes (
  id               uuid primary key default gen_random_uuid(),
  folio            text unique not null,            -- MOR-2024-0187
  empresa          text not null,
  contacto         text,
  telefono         text,
  correo           text,

  -- Fiscales (para la constancia y los manifiestos)
  rfc              text,
  regimen          text,
  uso_cfdi         text,
  domicilio_fiscal text,
  codigo_postal    text,
  forma_pago       text,

  dias_credito     integer not null default 0,
  limite_credito   numeric(12,2) not null default 0,
  estado           text not null default 'activo'
                     check (estado in ('activo','suspendido','baja')),
  desde            date not null default current_date,
  creado           timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- PERFILES — una fila por PERSONA que entra al sistema.
-- Se enlaza 1 a 1 con auth.users (el usuario de Supabase).
--
-- Separar "cliente" (la empresa) de "perfil" (quien entra) es lo que permite
-- que una misma empresa tenga varios accesos: el gerente de planta y la
-- persona de contabilidad, cada uno con su propia contraseña.
-- ---------------------------------------------------------------------
create table if not exists public.perfiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  nombre     text not null default '',
  rol        text not null default 'cliente'
               check (rol in ('dueno','admin','operador','cliente')),
  cliente_id uuid references public.clientes(id) on delete cascade,
  telefono   text,
  activo     boolean not null default true,
  creado     timestamptz not null default now(),

  -- Un perfil de cliente SIEMPRE pertenece a una empresa; el personal de
  -- Morcast NUNCA. Sin esta regla, un cliente sin empresa vería todo.
  constraint perfil_coherente check (
    (rol =  'cliente' and cliente_id is not null) or
    (rol <> 'cliente' and cliente_id is null)
  )
);
create index if not exists perfiles_cliente_idx on public.perfiles (cliente_id);

-- ---------------------------------------------------------------------
-- RUTAS — con su zona de cobertura.
--
-- La zona va como jsonb `[[lat,lng], ...]` porque el cálculo de cobertura
-- hoy corre en JavaScript (lib/punto-en-zona.mjs) y así la web y las dos
-- apps comparten exactamente el mismo dato. Si algún día son cientos de
-- rutas, esto se cambia a PostGIS (geography + índice GiST + ST_Contains).
-- ---------------------------------------------------------------------
create table if not exists public.rutas (
  id        uuid primary key default gen_random_uuid(),
  clave     text unique not null,                   -- RT-NORTE
  nombre    text not null,
  tipo      text not null check (tipo in ('manual','roll-off','compactador')),
  dias      text[] not null default '{}',           -- lunes..sábado, nunca domingo
  unidad    text,
  chofer_id uuid references public.perfiles(id) on delete set null,
  cupo      integer not null default 10,
  activa    boolean not null default true,
  zona      jsonb not null default '[]'::jsonb,
  creado    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- DOMICILIOS — un cliente puede tener varias plantas o sucursales.
-- ---------------------------------------------------------------------
create table if not exists public.domicilios (
  id         uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  alias      text not null,                         -- "Planta 1"
  calle      text,
  colonia    text,
  cp         text,
  lat        double precision,
  lng        double precision,
  creado     timestamptz not null default now()
);
create index if not exists domicilios_cliente_idx on public.domicilios (cliente_id);

-- ---------------------------------------------------------------------
-- SUSCRIPCIONES — el cliente dado de alta en una ruta.
-- ---------------------------------------------------------------------
create table if not exists public.suscripciones (
  id           uuid primary key default gen_random_uuid(),
  cliente_id   uuid not null references public.clientes(id) on delete cascade,
  domicilio_id uuid not null references public.domicilios(id) on delete cascade,
  ruta_id      uuid references public.rutas(id) on delete set null,
  frecuencia   text not null check (frecuencia in ('semanal','quincenal','mensual')),
  equipo       jsonb not null default '[]'::jsonb,  -- [{tipo,medida,cantidad}]
  estado       text not null default 'activa'
                 check (estado in ('activa','pausada','cancelada')),
  desde        date not null default current_date,
  creado       timestamptz not null default now()
);
create index if not exists suscripciones_cliente_idx on public.suscripciones (cliente_id);

-- ---------------------------------------------------------------------
-- SOLICITUDES DE RECOLECCIÓN — el corazón del flujo.
-- El cliente pide, Morcast confirma, el chofer la ejecuta.
-- ---------------------------------------------------------------------
create table if not exists public.solicitudes_recoleccion (
  id               uuid primary key default gen_random_uuid(),
  folio            text unique not null,            -- REC-2026-0142
  cliente_id       uuid not null references public.clientes(id) on delete cascade,
  domicilio_id     uuid references public.domicilios(id) on delete set null,
  ruta_id          uuid references public.rutas(id) on delete set null,
  origen           text not null default 'ruta' check (origen in ('ruta','extra')),
  fecha_pedida     date not null,
  fecha_confirmada date,
  estado           text not null default 'solicitada'
                     check (estado in ('solicitada','confirmada','en-ruta','completada','rechazada')),
  nota             text not null default '',
  creada_por       uuid references public.perfiles(id) on delete set null,
  creado           timestamptz not null default now()
);
create index if not exists solicitudes_cliente_idx on public.solicitudes_recoleccion (cliente_id);
create index if not exists solicitudes_ruta_fecha_idx
  on public.solicitudes_recoleccion (ruta_id, fecha_confirmada);

-- ---------------------------------------------------------------------
-- RECOLECCIONES — la evidencia que levanta el chofer.
-- Las fotos guardan la RUTA dentro de Storage, nunca una URL pública:
-- se sirven con URL firmada que caduca.
-- ---------------------------------------------------------------------
create table if not exists public.recolecciones (
  id           uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null references public.solicitudes_recoleccion(id) on delete cascade,
  operador_id  uuid references public.perfiles(id) on delete set null,
  qr           text,
  peso_kg      numeric(10,2),
  foto_antes   text,
  foto_despues text,
  hora_antes   timestamptz,
  hora_despues timestamptz,
  creado       timestamptz not null default now()
);
create index if not exists recolecciones_solicitud_idx on public.recolecciones (solicitud_id);

-- ---------------------------------------------------------------------
-- MOVIMIENTOS DE SALDO — cargos y abonos.
-- El cliente sube su comprobante; Morcast lo verifica. Queda registrado
-- QUIÉN lo verificó: es dinero.
-- ---------------------------------------------------------------------
create table if not exists public.movimientos_saldo (
  id             uuid primary key default gen_random_uuid(),
  cliente_id     uuid not null references public.clientes(id) on delete cascade,
  tipo           text not null check (tipo in ('cargo','abono')),
  concepto       text not null,
  monto          numeric(12,2) not null check (monto > 0),
  comprobante    text,                              -- ruta en Storage
  estado         text not null default 'pendiente'
                   check (estado in ('pendiente','verificado','rechazado')),
  verificado_por uuid references public.perfiles(id) on delete set null,
  fecha          date not null default current_date,
  creado         timestamptz not null default now()
);
create index if not exists movimientos_cliente_idx on public.movimientos_saldo (cliente_id);

-- ---------------------------------------------------------------------
-- ZONAS PEDIDAS — quien quedó fuera de cobertura y dejó su teléfono.
-- Es la lista de por dónde conviene abrir la siguiente ruta.
-- ---------------------------------------------------------------------
create table if not exists public.zonas_pedidas (
  id       uuid primary key default gen_random_uuid(),
  clave    text unique not null,                    -- ZP-005
  nombre   text,
  telefono text,
  correo   text,
  lat      double precision not null,
  lng      double precision not null,
  nota     text,
  estado   text not null default 'nueva'
             check (estado in ('nueva','aprobada','descartada')),
  creado   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- BITÁCORA — quién hizo qué. Manejan dinero y evidencia ambiental;
-- sin esto no hay a quién preguntarle cuando algo no cuadra.
-- ---------------------------------------------------------------------
create table if not exists public.bitacora (
  id           bigserial primary key,
  actor_id     uuid references public.perfiles(id) on delete set null,
  actor_correo text,
  accion       text not null,                       -- 'confirmar_solicitud'
  tabla        text,
  registro_id  text,
  detalle      jsonb,
  creado       timestamptz not null default now()
);
create index if not exists bitacora_creado_idx on public.bitacora (creado desc);

-- =====================================================================
--  ALTA AUTOMÁTICA DEL PERFIL AL CREARSE UN USUARIO
-- =====================================================================
--
--  🔒 DETALLE DE SEGURIDAD IMPORTANTE:
--  El rol se lee de `raw_app_meta_data`, NUNCA de `raw_user_meta_data`.
--
--  `user_metadata` lo puede escribir el propio usuario desde el navegador.
--  Si el rol saliera de ahí, cualquiera podría registrarse mandando
--  rol="admin" y entrar al panel. `app_metadata` solo se puede escribir
--  con la llave de servicio, o sea, únicamente desde nuestro servidor.
-- ---------------------------------------------------------------------
create or replace function public.nuevo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, nombre, rol, cliente_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nombre', ''),
    coalesce(new.raw_app_meta_data  ->> 'rol', 'cliente'),
    nullif(new.raw_app_meta_data ->> 'cliente_id', '')::uuid
  );
  return new;
end;
$$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.nuevo_usuario();
