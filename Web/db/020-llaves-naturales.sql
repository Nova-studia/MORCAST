-- =====================================================================
--  020 — LAS LLAVES NATURALES DEL CARGADOR, DE VERDAD EN LA BASE
--
--  Se corre con:
--    psql "<cadena>" -v ON_ERROR_STOP=1 --single-transaction -f 020-...sql
--
--  QUE PROBLEMA RESUELVE
--  `scripts/cuaderno/cargar.mjs` promete que se puede volver a correr sin
--  duplicar nada cuando la empresa mande correcciones, y hoy lo cumple: para
--  cada tabla busca por su LLAVE NATURAL (empresa; punto por cliente+alias;
--  suscripcion por cliente+punto) y actualiza si ya existe en vez de
--  insertar de nuevo. Pero esa promesa vive SOLO en el codigo del script. No
--  hay nada en la base que la respalde, y cualquier otro camino de
--  escritura —una migracion futura, una corrida a mano, un bug— puede
--  duplicar sin que nadie se entere hasta que un cliente reciba dos
--  facturas por el mismo servicio.
--
--  Estos tres indices unicos son esas mismas llaves, ahora garantizadas por
--  Postgres y no solo por la buena conducta del script.
--
--  VERIFICADO ANTES DE ESCRIBIR ESTO (1-sep-2026): 0 duplicados en las tres
--  llaves sobre los datos reales ya cargados. Si al aplicar esta migracion
--  Postgres se queja de una llave duplicada, DETENERSE Y REPORTARLO: querria
--  decir que algo se duplico entre esa verificacion y ahora, y hay que
--  mirarlo antes de forzar nada.
-- =====================================================================

create unique index if not exists clientes_empresa_key
  on public.clientes (empresa);

comment on index public.clientes_empresa_key is
  'Llave natural de cargar.mjs: busca el cliente por empresa para decidir si actualiza o inserta. Sin este indice la promesa de "se puede volver a correr sin duplicar" solo vive en la aplicacion.';

create unique index if not exists domicilios_cliente_alias_key
  on public.domicilios (cliente_id, alias);

comment on index public.domicilios_cliente_alias_key is
  'Llave natural de cargar.mjs: un punto se identifica por (cliente, alias). Es la misma llave que obligo a ALIAS_PROPIO en equivalencias.js para KARZO PIPAS / KARZO CONSTITUYENTES.';

create unique index if not exists suscripciones_cliente_domicilio_key
  on public.suscripciones (cliente_id, domicilio_id);

comment on index public.suscripciones_cliente_domicilio_key is
  'Llave natural de cargar.mjs: una suscripcion se identifica por (cliente, punto de recoleccion). Sin este indice, un select() que fallara en guardar() por otra razon podria dejar entrar una segunda fila para el mismo punto.';

-- ---------------------------------------------------------------------
-- LA SEGUNDA MITAD DEL SPEC DE "POR LLAMADA" QUE SE HABIA QUEDADO A MEDIAS
--
-- El spec pedia que un punto "POR LLAMADA" quedara "sin dias fijos Y
-- marcado como servicio a solicitud". La primera mitad ya existia
-- (`dias = '{}'`); la segunda nunca se escribio. Sin esta columna, los 13
-- puntos que se atienden por llamada quedaban INDISTINGUIBLES en la base de
-- los que simplemente no tienen calendario todavia: los dos casos con
-- `dias = '{}'`, que es justo lo que el spec queria evitar.
-- ---------------------------------------------------------------------
alter table public.suscripciones
  add column if not exists por_llamada boolean not null default false;

comment on column public.suscripciones.por_llamada is
  'El punto se atiende cuando el cliente llama, no en un dia fijo. Sale de "POR LLAMADA" en la hoja "1 Rutas" del cuaderno (columna "Dias que pasa"); ver diasDesdeTexto() en normalizar.mjs. No es lo mismo que dias=''{}'' sin este dato: eso solo significa que no hay calendario capturado.';
