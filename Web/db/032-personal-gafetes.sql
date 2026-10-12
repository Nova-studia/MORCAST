-- =====================================================================
--  032 · PERSONAL Y GAFETES (12-oct-2026)
--  Se corre DESPUÉS de 031. Diseño:
--  docs/superpowers/specs/2026-10-09-gafetes-personal-design.md
--
--  · `empleados`: el directorio del personal. Aparte de `perfiles` porque
--    casi nadie del personal tiene cuenta en el sistema.
--  · `gafetes`: UNO POR TARJETA IMPRESA. Lleva el código del enlace
--    (morcast.mx/g/<código>) y el PIN de emergencia cifrado. Si se pierde la
--    tarjeta se repone: la vieja queda 'repuesto' y deja de valer.
--  · La sección `personal` entra a la lista de permisos de los roles. NO se
--    siembra en "Administrador completo": la da el dueño.
--
--  SIN POLÍTICAS, a propósito (mismo criterio que la cubeta `altas`, db/025):
--  aquí hay datos de salud (tipo de sangre, alergias) y a quién llamar en un
--  accidente. `puede_seccion()` no sabe del segundo paso del panel (el
--  código por correo vive en una cookie), así que una política de lectura
--  dejaría sacar todo con la contraseña robada de un admin y la llave
--  pública. Lee y escribe SOLO el servidor, con la llave de servicio, después
--  de `exigirSeccion("personal")` (app/(admin)/admin/personal/acciones.js),
--  que sí exige el segundo paso. La página pública también pasa por el
--  servidor y solo saca los campos de su nivel (lib/personal.mjs).
-- =====================================================================
begin;

-- ---------------------------------------------------------- la sección
-- La única lista de secciones vive en lib/permisos.mjs; esta es su copia
-- (la 029 trae la misma lista; tests/permisos.test.mjs compara las dos).
alter table public.roles drop constraint if exists roles_permisos_validos;
alter table public.roles add constraint roles_permisos_validos check (permisos <@ array[
  'rutas', 'recolecciones', 'incidentes', 'avisos', 'unidades', 'contenedores', 'zonas',
  'solicitudes', 'altas', 'empleo', 'personal', 'clientes', 'saldos', 'precios', 'servicios', 'reportes',
  'usuarios', 'bitacora', 'eliminar_clientes'
]::text[]);

-- ---------------------------------------------------------- empleados
create table if not exists public.empleados (
  id                  uuid primary key default gen_random_uuid(),
  numero              text not null unique check (numero ~ '^[A-Z0-9-]{1,12}$'),
  nombre              text not null check (length(btrim(nombre)) between 1 and 60),
  apellido_paterno    text not null default '',
  apellido_materno    text not null default '',
  puesto              text not null default '',
  area                text not null default '',
  tipo                text not null default 'general' check (tipo in ('administrativo', 'general')),
  reporta_a           uuid references public.empleados (id) on delete set null,
  foto_ruta           text,                       -- cubeta privada `personal`
  estado              text not null default 'activo' check (estado in ('activo', 'baja')),
  baja_fecha          date,
  baja_motivo         text,
  -- Emergencia: solo se enseña con el PIN del gafete y con permiso firmado.
  tipo_sangre         text check (tipo_sangre in ('O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-')),
  alergias            text,
  contacto_emergencia text,
  telefono_emergencia text,
  permiso_emergencia  boolean not null default false,
  -- El chofer o el administrador que además tiene cuenta en el sistema.
  perfil_id           uuid references public.perfiles (id) on delete set null,
  creado              timestamptz not null default now(),
  creado_por          uuid references public.perfiles (id) on delete set null,
  check (reporta_a is null or reporta_a <> id)
);
create index if not exists empleados_estado_idx on public.empleados (estado, tipo);
create index if not exists empleados_reporta_idx on public.empleados (reporta_a);

alter table public.empleados enable row level security;
revoke all on public.empleados from anon, authenticated;

-- ---------------------------------------------------------- gafetes
create table if not exists public.gafetes (
  id              uuid primary key default gen_random_uuid(),
  empleado_id     uuid not null references public.empleados (id) on delete cascade,
  -- El alfabeto de lib/gafetes.mjs: sin 0/O ni 1/I/L.
  codigo          text not null unique check (codigo ~ '^[2-9A-HJKMNP-Z]{10}$'),
  -- AES-GCM con PERSONAL_PIN_LLAVE (lib/pin-gafete.mjs). Nunca el PIN en claro.
  pin_cifrado     text not null check (pin_cifrado like 'v1.%'),
  estado          text not null default 'vigente' check (estado in ('vigente', 'repuesto', 'anulado')),
  emitido         timestamptz not null default now(),
  emitido_por     uuid references public.perfiles (id) on delete set null,
  chip_grabado_en timestamptz,
  anulado_en      timestamptz,
  anulado_motivo  text
);
-- Un solo gafete vigente por persona: dos tarjetas válidas del mismo
-- empleado serían una prestada.
create unique index if not exists gafetes_un_vigente on public.gafetes (empleado_id) where estado = 'vigente';
create index if not exists gafetes_empleado_idx on public.gafetes (empleado_id, emitido desc);

alter table public.gafetes enable row level security;
revoke all on public.gafetes from anon, authenticated;

-- ---------------------------------------------------------- emitir y reponer
-- En UNA sentencia de servidor: el gafete que estuviera vigente deja de
-- valer (`p_anterior`: 'repuesto' al reponer la tarjeta) y nace el nuevo.
-- Si fueran dos llamadas y la segunda fallara, la persona se quedaría sin
-- gafete válido con la tarjeta todavía en la mano.
create or replace function public.emitir_gafete(
  p_empleado uuid, p_codigo text, p_pin_cifrado text, p_por uuid, p_motivo text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not exists (select 1 from public.empleados where id = p_empleado and estado = 'activo') then
    raise exception 'Solo se emite gafete a un empleado activo.';
  end if;
  update public.gafetes
     set estado = 'repuesto', anulado_en = now(), anulado_motivo = coalesce(p_motivo, 'Repuesto')
   where empleado_id = p_empleado and estado = 'vigente';
  insert into public.gafetes (empleado_id, codigo, pin_cifrado, emitido_por)
  values (p_empleado, p_codigo, p_pin_cifrado, p_por)
  returning id into v_id;
  return v_id;
end;
$$;

-- Baja: la persona deja de estar activa Y su tarjeta se anula, juntas. La
-- página pública ya diría NO VÁLIDO solo con la baja; anular el gafete hace
-- que, si la persona vuelve, tenga que emitirse uno nuevo (código y PIN
-- distintos de los de la tarjeta que quizá nunca devolvió).
create or replace function public.baja_empleado(p_empleado uuid, p_motivo text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update public.empleados
     set estado = 'baja', baja_fecha = (now() at time zone 'America/Matamoros')::date, baja_motivo = p_motivo
   where id = p_empleado and estado = 'activo';
  if not found then return false; end if;
  update public.gafetes
     set estado = 'anulado', anulado_en = now(), anulado_motivo = 'Baja del empleado'
   where empleado_id = p_empleado and estado = 'vigente';
  return true;
end;
$$;

-- Reactivar: vuelve a estar activa, sin gafete. El nuevo se emite aparte
-- (`emitir_gafete`), con su código y su PIN.
create or replace function public.reactivar_empleado(p_empleado uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update public.empleados
     set estado = 'activo', baja_fecha = null, baja_motivo = null
   where id = p_empleado and estado = 'baja';
  return found;
end;
$$;

-- Solo el servidor. Son SECURITY DEFINER: sin este revoke, cualquiera con
-- sesión podría darse un gafete o dar de baja a alguien llamándolas directo.
revoke all on function public.emitir_gafete(uuid, text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.baja_empleado(uuid, text) from public, anon, authenticated;
revoke all on function public.reactivar_empleado(uuid) from public, anon, authenticated;
grant execute on function public.emitir_gafete(uuid, text, text, uuid, text) to service_role;
grant execute on function public.baja_empleado(uuid, text) to service_role;
grant execute on function public.reactivar_empleado(uuid) to service_role;

-- ---------------------------------------------------------- las fotos
--  personal/<id del empleado>/<momento>.jpg
--  PRIVADA, con tope de 2 MB y solo imágenes. Sin políticas: la foto se
--  sirve por dos rutas del servidor, la del panel (pide la sección) y la de
--  `/g/<código>/foto`, que solo la entrega si ese gafete está vigente.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('personal', 'personal', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

commit;
