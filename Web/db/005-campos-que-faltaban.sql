-- =====================================================================
--  MORCAST — Campos que le faltaban al esquema
--  Se corre DESPUÉS de 004.
-- =====================================================================
--
--  Al pasar los datos de ejemplo a la base salieron huecos: el esquema lo
--  escribí antes de revisar campo por campo lo que las pantallas ya usaban.
--  Se juntan todos aquí para no andar corriendo una migración por cada uno.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) ZONAS PEDIDAS
--    La pantalla guarda más cosas de las que yo había previsto, y maneja
--    un cuarto estado, "en evaluación", que es el más útil de todos:
--    "ya lo vimos, lo estamos pensando".
-- ---------------------------------------------------------------------
alter table public.zonas_pedidas add column if not exists empresa           text;
alter table public.zonas_pedidas add column if not exists colonia           text;
alter table public.zonas_pedidas add column if not exists volumen_estimado  text;
alter table public.zonas_pedidas add column if not exists fecha             date default current_date;

alter table public.zonas_pedidas drop constraint if exists zonas_pedidas_estado_check;
alter table public.zonas_pedidas add constraint zonas_pedidas_estado_check
  check (estado in ('nueva','en-evaluacion','aprobada','descartada'));

-- `nombre` guarda el nombre de la PERSONA que dejó su contacto; la empresa
-- va aparte. Se renombra para que no se confundan al leer la tabla.
alter table public.zonas_pedidas rename column nombre to nombre_contacto;

-- ---------------------------------------------------------------------
-- 2) RUTAS — el chofer, por ahora, es un nombre escrito a mano.
--
--    La tabla ya tiene `chofer_id` apuntando a un perfil, que es lo
--    correcto a futuro. Pero hoy los choferes todavía no tienen cuenta en
--    el sistema, y el panel los captura escribiendo el nombre. Se agrega la
--    columna de texto para no perder ese dato mientras tanto.
--
--    Cuando cada chofer tenga su usuario, se llena `chofer_id` y esta
--    columna queda como respaldo de lo que se escribió.
-- ---------------------------------------------------------------------
alter table public.rutas add column if not exists chofer text;
