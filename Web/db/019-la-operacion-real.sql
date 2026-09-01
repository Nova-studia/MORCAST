-- =====================================================================
--  019 — LA OPERACION REAL
--
--  Prepara la base para recibir el cuaderno que devolvio la empresa el
--  27-ago-2026: 42 clientes, 68 puntos, 64 servicios y 5 rutas de la
--  operacion de verdad, en lugar de los 5 clientes de prueba de agosto.
--
--  Se corre con:
--    psql "<cadena>" -v ON_ERROR_STOP=1 --single-transaction -f 019-...sql
--
--  ES ADITIVA: ensancha un CHECK y agrega dos columnas que ningun codigo
--  desplegado lee ni exige. El sitio en vivo no se entera.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) UN ESTADO NUEVO: 'pendiente-info'
--
-- El cuaderno llego incompleto: de 42 clientes, 13 sin correo, 13 sin
-- telefono, 13 sin persona de contacto. Cargarlos como 'activo' seria
-- mentir; dejarlos fuera seria seguir con una base de mentira.
--
-- NO SE TOCA NINGUNA POLITICA DE RLS, Y ES DELIBERADO. El estado del
-- cliente nunca ha controlado el acceso al portal — eso lo controla tener
-- perfil con rol 'cliente' — y no va a empezar aqui. Mezclar "le falta el
-- telefono" con "puede entrar" es como se cuelan los agujeros de permisos.
-- ---------------------------------------------------------------------
alter table public.clientes drop constraint if exists clientes_estado_check;
alter table public.clientes add constraint clientes_estado_check
  check (estado in ('activo','pendiente-info','suspendido','baja'));

-- ---------------------------------------------------------------------
-- 2) UN LUGAR PARA LAS DUDAS ABIERTAS
--
-- El cuaderno dejo 7 preguntas sin respuesta ("¿KARZO y KARZINI son la
-- misma empresa?", "¿Nacionales son 9 sucursales o 9 clientes?"). Hoy
-- viven en un Excel que nadie va a volver a abrir. Aqui quedan pegadas al
-- cliente al que le tocan.
--
-- Es INTERNA: la ve el personal de Morcast, nunca el cliente. Las
-- politicas de `clientes` ya separan las dos vistas.
-- ---------------------------------------------------------------------
alter table public.clientes add column if not exists nota_interna text;

comment on column public.clientes.nota_interna is
  'Dudas y pendientes sobre el expediente. Interna: no se le muestra al cliente.';

-- ---------------------------------------------------------------------
-- 3) LOS DIAS EN QUE SE VISITA CADA PUNTO
--
-- DE DONDE SALE ESTE DATO, Y CUANTO SE LE PUEDE CREER:
-- La hoja 1 del cuaderno pedia las RUTAS, pero sus renglones 6-45 resultaron
-- ser otra cosa: un calendario de PUNTOS, en el MISMO ORDEN que la hoja 3.
-- Se verifico cruzando la colonia de cada renglon: 39 de 40 coinciden
-- exactas.
--
-- O sea que este dato NO lo declaro la empresa: se dedujo de la POSICION de
-- los renglones. Es bueno —es la materia prima de la agenda del chofer dia
-- por dia— pero quien lo use despues tiene que saber que salio de un cruce y
-- no de una respuesta. Antes de construir la agenda sobre esto, conviene
-- confirmarselo a la empresa.
--
-- Se guarda ahora porque el dato ya esta en el archivo y no guardarlo obliga
-- a rehacer el cruce desde cero mas adelante.
-- ---------------------------------------------------------------------
alter table public.suscripciones add column if not exists dias text[] not null default '{}';

comment on column public.suscripciones.dias is
  'Dias de la semana en que se visita el punto. DEDUCIDO por posicion del cuaderno (hoja 1 renglones 6-45 vs hoja 3), 39/40 verificados. No lo declaro la empresa: confirmar antes de construir la agenda encima.';
