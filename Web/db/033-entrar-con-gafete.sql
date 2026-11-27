-- =====================================================================
--  033 · ENTRAR A LA APP CON EL GAFETE (27-nov-2026)
--  Se corre DESPUÉS de 032. Diseño:
--  docs/superpowers/specs/2026-11-27-entrar-con-gafete-design.md
--
--  · `gafetes.chip_serie`: la serie del chip NFC. Se guarda la primera vez
--    que alguien vincula el gafete a un teléfono (los chips de hoy se
--    grabaron con NFC Tools y su serie no se conocía). No va en el QR: es
--    lo que impide que una foto del QR sirva para entrar.
--  · `gafete_telefonos`: un renglón por cada par gafete–teléfono. Guarda el
--    HASH (SHA-256) del secreto que vive en el almacén seguro del teléfono,
--    nunca el secreto. Desvincular = poner `desvinculado_en`; el renglón se
--    queda para la historia. Si el gafete se repone o el empleado se da de
--    baja, el par deja de valer solo (el servidor exige gafete vigente).
--  · `fallos`: intentos fallidos seguidos de ESE teléfono. Al 4.º, el
--    teléfono pide entrar con correo (lib/gafete-acceso.mjs). El gafete en
--    sí nunca se bloquea.
--
--  SIN POLÍTICAS, a propósito (mismo criterio que db/032): lee y escribe
--  SOLO el servidor con la llave de servicio (lib/gafete-acceso-servidor.js).
-- =====================================================================
begin;

alter table public.gafetes add column if not exists chip_serie text;
alter table public.gafetes drop constraint if exists gafetes_chip_serie_forma;
alter table public.gafetes add constraint gafetes_chip_serie_forma check (chip_serie ~ '^[0-9A-F]{8,20}$');

create table if not exists public.gafete_telefonos (
  id               uuid primary key default gen_random_uuid(),
  gafete_id        uuid not null references public.gafetes (id) on delete cascade,
  perfil_id        uuid not null references public.perfiles (id) on delete cascade,
  dispositivo_id   uuid not null,
  secreto_hash     text not null check (secreto_hash ~ '^[0-9a-f]{64}$'),
  aparato          text not null default '' check (length(aparato) <= 60),
  -- false solo si al vincular el teléfono no pudo leer la serie (iPhone).
  exige_serie      boolean not null default true,
  fallos           integer not null default 0 check (fallos >= 0),
  creado           timestamptz not null default now(),
  ultimo_uso       timestamptz,
  desvinculado_en  timestamptz,
  desvinculado_por uuid references public.perfiles (id) on delete set null
);
create unique index if not exists gafete_telefonos_un_vigente
  on public.gafete_telefonos (gafete_id, dispositivo_id) where desvinculado_en is null;
create index if not exists gafete_telefonos_dispositivo_idx on public.gafete_telefonos (dispositivo_id);

alter table public.gafete_telefonos enable row level security;
revoke all on public.gafete_telefonos from anon, authenticated;

commit;
