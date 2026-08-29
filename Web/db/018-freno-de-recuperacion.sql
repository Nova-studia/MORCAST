-- =====================================================================
--  MORCAST DEL NORTE — 018: freno para la recuperación de contraseña
--  Se corre DESPUES de 017-registro-abierto.sql.
-- =====================================================================
--
--  QUE PROBLEMA RESUELVE
--  ---------------------
--  La pantalla de "olvide mi contrasena" es publica: cualquiera teclea un
--  correo y se manda un enlace. Sin freno, es un boton para bombardear el
--  buzon de cualquier cliente, y para quemar la cuota de Resend.
--
--  POR QUE UNA TABLA Y NO LEER `auth.users.recovery_sent_at`
--  ---------------------------------------------------------
--  El primer intento leia esa columna con `admin.listUsers({perPage: 200})`.
--  Tenia dos defectos graves:
--
--   1. Solo pedia la PRIMERA pagina. Pasados los 200 usuarios, a quien no
--      cupiera se le decia "te mandamos un enlace" y no le llegaba NUNCA, sin
--      un solo renglon en el registro. Y como GoTrue ordena por fecha de alta
--      descendente, los que se quedaban fuera eran los clientes MAS ANTIGUOS.
--   2. Leer y luego escribir no es atomico: dos peticiones a la vez leen lo
--      mismo y las dos pasan.
--
--  Esta tabla arregla los dos: el `insert ... on conflict ... where` de abajo
--  decide en UNA sola sentencia, y no depende de cuantos usuarios haya.
--
--  QUE NO GUARDA
--  -------------
--  Solo el correo y la hora del ultimo intento. No dice si ese correo tiene
--  cuenta —se anota igual exista o no, justamente para no filtrar nada— ni
--  guarda tokens ni enlaces.
-- =====================================================================

begin;

create table if not exists public.intentos_recuperacion (
  correo text primary key,
  ultimo timestamptz not null default now()
);

-- Nadie con sesión de cliente tiene por qué leer esto: la escribe la acción de
-- servidor con la llave de servicio, que se salta el RLS. Con RLS encendido y
-- sin políticas, la tabla queda cerrada a todo el mundo, que es lo que se
-- quiere: si se pudiera leer, seria una lista de correos.
alter table public.intentos_recuperacion enable row level security;

-- Los intentos viejos no le sirven a nadie. El indice permite barrerlos.
create index if not exists intentos_recuperacion_ultimo_idx
  on public.intentos_recuperacion (ultimo);

comment on table public.intentos_recuperacion is
  'Freno de la pantalla publica de recuperar contrasena. Un renglon por correo, exista o no la cuenta.';

-- ---------------------------------------------------------------------
--  La decision, en UNA sola sentencia.
--
--  Devuelve true si se puede mandar el enlace, y de paso anota el intento.
--  El `where` del `on conflict` es lo que lo hace atomico: si otra peticion
--  acaba de escribir, esta no encuentra fila que actualizar, `returning` no
--  devuelve nada, y contesta false. Dos peticiones a la vez no pueden pasar
--  las dos.
--
--  SECURITY DEFINER para que solo se pueda usar por aqui: la tabla tiene RLS
--  encendido y ninguna politica, asi que nadie la lee ni la escribe a mano.
-- ---------------------------------------------------------------------
create or replace function public.puede_pedir_recuperacion(p_correo text, p_espera_segundos int default 60)
returns boolean
language sql
security definer
set search_path = public
as $$
  with intento as (
    insert into public.intentos_recuperacion as i (correo, ultimo)
    values (lower(trim(p_correo)), now())
    on conflict (correo) do update
      set ultimo = now()
      where i.ultimo < now() - make_interval(secs => p_espera_segundos)
    returning 1
  )
  select exists (select 1 from intento);
$$;

-- Que solo la pueda llamar el servidor. `anon` y `authenticated` no.
revoke all on function public.puede_pedir_recuperacion(text, int) from public, anon, authenticated;
grant execute on function public.puede_pedir_recuperacion(text, int) to service_role;

commit;
