-- =====================================================================
--  MORCAST DEL NORTE — 025: alta del cliente con firma electrónica
--  Se corre DESPUÉS de 024-ajustes-de-la-revision.sql.
-- =====================================================================
--
--  QUÉ PIDIÓ EL SOCIO (5-oct-2026)
--  -------------------------------
--  Que el alta sea "amplia", que el cliente la FIRME, que salga un PDF con
--  toda la información y que vea "¡Alta exitosa!". Decidido con Luis: se
--  firma la "Solicitud de alta" con la aceptación de los Términos del
--  servicio y del Aviso de privacidad, con firma electrónica SIMPLE hecha en
--  casa. Esa firma vale; lo que pesa es la evidencia, y esta migración es
--  sobre todo el lugar donde se guarda esa evidencia y los candados para que
--  nadie la maquille después.
--
--  LO QUE AGREGA
--  -------------
--   1. Los campos nuevos del alta: representante legal, contacto de
--      facturación, horario de acceso y la ruta de la Constancia de
--      Situación Fiscal.
--   2. La evidencia de la firma: quién, cuándo, desde qué IP y navegador,
--      qué versión de los términos, lo firmado completo (`contenido_firmado`)
--      y su huella SHA-256, y la huella del PDF.
--   3. La confirmación del correo: un token de un solo uso del que SOLO se
--      guarda la huella, con vencimiento.
--   4. Un candado: desde una sesión (el panel, la app o la API) sólo se
--      cambia el estado y las notas. Lo firmado y su evidencia los escribe
--      únicamente el servidor con la llave de servicio.
--   5. La cubeta PRIVADA `altas` (firma, constancia y PDF), SIN ninguna
--      política: nadie con sesión la lee, escribe ni borra. Todo pasa por
--      el servidor con la llave de servicio.
--
--  PREPARADO PARA DESPUÉS (no se construye aquí): e.firma del SAT y
--  constancia NOM-151 con un proveedor. Ese proveedor sella una huella, y
--  la huella ya está (`contenido_huella`, `pdf_huella`): bastará con una
--  columna para guardar su constancia.
--
--  Idempotente: se puede correr dos veces sin romper nada.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
--  1 · El alta "amplia"
-- ---------------------------------------------------------------------
--  Todo opcional: el formulario los pide pero no los exige, y las altas de
--  antes no los tienen. `constancia_ruta` es la ruta DENTRO de la cubeta
--  `altas` (`<id>/constancia.pdf`), no un enlace: los enlaces se firman al
--  momento y caducan.
alter table public.solicitudes_alta
  add column if not exists representante_nombre  text,
  add column if not exists representante_cargo   text,
  add column if not exists facturacion_nombre    text,
  add column if not exists facturacion_correo    text,
  add column if not exists facturacion_telefono  text,
  add column if not exists horario_acceso        text,
  add column if not exists constancia_ruta       text;

-- ---------------------------------------------------------------------
--  2 · La evidencia de la firma
-- ---------------------------------------------------------------------
--  `contenido_firmado` es EXACTAMENTE lo que se firmó (datos, términos,
--  huella de la firma, IP, navegador, fecha). jsonb reordena las llaves,
--  pero la huella se calcula sobre el JSON canónico (llaves ordenadas,
--  `lib/alta-firma.mjs`), así que recalcularla desde aquí da la misma.
--  `pdf_inicial_huella` es la del PDF que se emitió al firmar; `pdf_huella`
--  la del vigente (el "confirmado", cuando el cliente confirma su correo).
alter table public.solicitudes_alta
  add column if not exists firmado_en          timestamptz,
  add column if not exists firmante_nombre     text,
  add column if not exists firmante_cargo      text,
  add column if not exists firma_ruta          text,
  add column if not exists firma_ip            text,
  add column if not exists firma_navegador     text,
  add column if not exists terminos_version    text,
  add column if not exists aviso_version       text,
  add column if not exists contenido_firmado   jsonb,
  add column if not exists contenido_huella    text,
  add column if not exists pdf_ruta            text,
  add column if not exists pdf_huella          text,
  add column if not exists pdf_inicial_huella  text;

-- ---------------------------------------------------------------------
--  3 · La confirmación del correo
-- ---------------------------------------------------------------------
--  `confirmacion_huella` es el SHA-256 del token que va en el enlace; el
--  token en claro no se guarda nunca. Al confirmar se BORRA la huella: así
--  el enlace es de un solo uso aunque alguien lo vuelva a abrir.
--  `correo_confirmado_por`: 'enlace' (el formulario público) o 'google'
--  (el registro con Google, donde el correo ya viene verificado).
alter table public.solicitudes_alta
  add column if not exists correo_confirmado       boolean not null default false,
  add column if not exists correo_confirmado_en    timestamptz,
  add column if not exists correo_confirmado_por   text,
  add column if not exists confirmacion_ip         text,
  add column if not exists confirmacion_navegador  text,
  add column if not exists confirmacion_huella     text,
  add column if not exists confirmacion_vence      timestamptz;

-- Las huellas tienen forma de huella. Si algún día alguien guardara aquí el
-- token en claro (43 caracteres base64url) por error, la base lo rechaza.
alter table public.solicitudes_alta drop constraint if exists solicitudes_alta_huellas_check;
alter table public.solicitudes_alta
  add constraint solicitudes_alta_huellas_check check (
        (contenido_huella    is null or contenido_huella    ~ '^[0-9a-f]{64}$')
    and (pdf_huella          is null or pdf_huella          ~ '^[0-9a-f]{64}$')
    and (pdf_inicial_huella  is null or pdf_inicial_huella  ~ '^[0-9a-f]{64}$')
    and (confirmacion_huella is null or confirmacion_huella ~ '^[0-9a-f]{64}$')
  );

-- Una firma sin quién, sin qué términos o sin huella no es una firma.
alter table public.solicitudes_alta drop constraint if exists solicitudes_alta_firma_completa_check;
alter table public.solicitudes_alta
  add constraint solicitudes_alta_firma_completa_check check (
    firmado_en is null or (
      firmante_nombre is not null and terminos_version is not null
      and contenido_huella is not null and contenido_firmado is not null
    )
  );

-- Confirmado = con fecha, con modo, y sin token vivo (un solo uso).
alter table public.solicitudes_alta drop constraint if exists solicitudes_alta_confirmacion_check;
alter table public.solicitudes_alta
  add constraint solicitudes_alta_confirmacion_check check (
    (correo_confirmado_por is null or correo_confirmado_por in ('enlace', 'google'))
    and (not correo_confirmado or (
      correo_confirmado_en is not null and correo_confirmado_por is not null
      and confirmacion_huella is null
    ))
  );

-- Para encontrar el alta por la huella del enlace, y que dos altas nunca
-- compartan un token.
create unique index if not exists solicitudes_alta_confirmacion_idx
  on public.solicitudes_alta (confirmacion_huella) where confirmacion_huella is not null;

-- ---------------------------------------------------------------------
--  4 · Lo firmado no se edita desde una sesión
-- ---------------------------------------------------------------------
--  `solicitudes_alta_edita_personal` (010) deja al personal hacer UPDATE de
--  la fila entera, y las políticas no saben de columnas. Lo remata este
--  trigger (mismo truco que `chofer_solo_cambia_estado` de la 022): si quien
--  actualiza trae sesión, todo lo que no sea `estado` o `notas` tiene que
--  quedar igual. Un admin con la sesión robada no puede cambiar la empresa,
--  el RFC, la firma, la fecha, la huella ni marcar un correo como
--  confirmado. Sin sesión es la llave de servicio (el servidor), que es
--  quien escribe la evidencia y confirma el correo.
create or replace function public.alta_firmada_sin_retoques()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if (to_jsonb(new) - 'estado' - 'notas') is distinct from (to_jsonb(old) - 'estado' - 'notas') then
    raise exception 'Desde el panel sólo se cambia el estado y las notas de un alta: lo que el cliente firmó y su evidencia no se editan.';
  end if;
  return new;
end;
$$;

revoke all on function public.alta_firmada_sin_retoques() from public;

drop trigger if exists alta_firmada_sin_retoques_tg on public.solicitudes_alta;
create trigger alta_firmada_sin_retoques_tg
  before update on public.solicitudes_alta
  for each row execute function public.alta_firmada_sin_retoques();

-- ---------------------------------------------------------------------
--  5 · La cubeta `altas`
-- ---------------------------------------------------------------------
--  altas/<id del alta>/firma.png
--  altas/<id del alta>/constancia.<pdf|jpg|png>
--  altas/<id del alta>/solicitud-<folio>.pdf            (el que se emite al firmar)
--  altas/<id del alta>/solicitud-<folio>-confirmada.pdf (al confirmar el correo)
--
--  PRIVADA y con tope de 3.5 MB (el de la constancia) y tipos cerrados también del lado de Storage:
--  si el servidor tuviera un error, la cubeta igual no acepta un .exe ni un
--  archivo de 50 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('altas', 'altas', false, 3670016, array['application/pdf', 'image/png', 'image/jpeg'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- NINGUNA política, a propósito, ni siquiera de lectura para el personal:
--  · `es_personal()` no sabe del segundo paso del panel (el código por
--    correo vive en una cookie, `lib/mfa.mjs`). Con la contraseña robada de
--    un admin y la llave pública, una política de lectura dejaría bajar
--    constancias y firmas saltándose ese segundo paso.
--  · El panel no la necesita: los enlaces de descarga los firma el servidor
--    con la llave de servicio después de `usuarioActual()`, que SÍ exige el
--    segundo paso (`enlacesArchivosAlta` en app/acciones-alta-cliente.js).
--  · Escribir: quien se da de alta no tiene sesión (sube el servidor por
--    él), y una firma o un PDF firmado que alguien con sesión pudiera
--    reemplazar o borrar no sería evidencia.
-- El `drop` limpia la política de lectura de un borrador anterior de esta
-- misma migración, por si llegó a correrse en alguna base.
drop policy if exists altas_lee_personal on storage.objects;

commit;
