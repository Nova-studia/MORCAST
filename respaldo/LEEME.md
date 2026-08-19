# Respaldos de Morcast

Toda la operación de Morcast vive en Supabase. Hay cosas ahí que **no se pueden
volver a capturar**: las fotos de antes y después de cada recolección son la
prueba de que el servicio se hizo. Si se pierden, no hay forma de rehacerlas.

Esto respalda las dos mitades y **comprueba que el respaldo sirve**.

## Los dos comandos

```bash
node respaldo/respaldar.mjs            # saca el respaldo
node respaldo/probar-restauracion.mjs  # comprueba que se puede recuperar
```

El segundo no es opcional. Un respaldo que nunca se restauró no es un respaldo,
es una suposición.

## Qué respalda

| Mitad | Qué incluye |
|---|---|
| Base de datos | Las tablas del negocio (`public`), las **cuentas de acceso** (`auth`) y el índice de archivos (`storage`) |
| Archivos | Todas las cubetas del Storage, archivo por archivo: fotos de recolección y comprobantes de pago |

## Dónde quedan

`..\Respaldos Morcast\<fecha-y-hora>\` — **fuera del repositorio y dentro de la
carpeta que Syncthing replica al escritorio**, así que cada respaldo queda en dos
computadoras distintas sin hacer nada extra.

Se conservan los **14 más recientes**; los anteriores se borran solos.

Cada carpeta trae:

- `base-de-datos.dump` — el volcado, para `pg_restore`
- `base-de-datos.sql` — el mismo volcado en texto, por si hay que leerlo o rescatar una sola tabla a mano
- `archivos/<cubeta>/…` — las fotos y comprobantes tal cual
- `MANIFIESTO.json` — cuántas filas tenía cada tabla y la huella SHA-256 de cada pieza
- `PRUEBA-DE-RESTAURACION.json` — el resultado de la comprobación (lo escribe el segundo comando)

## Cómo comprueba que sirve

`probar-restauracion.mjs` **no revisa que el archivo exista**. Hace esto:

1. Recalcula la huella SHA-256 de cada pieza y la compara con el manifiesto —
   detecta corrupción silenciosa.
2. Levanta un **Postgres temporal aparte** (puerto 55432, carpeta temporal
   propia). No toca Supabase ni ningún Postgres instalado.
3. Crea ahí los roles que Supabase da por hechos (`anon`, `authenticated`,
   `service_role`…). Sin ellos, cada política de seguridad que diga
   `TO authenticated` falla al restaurar.
4. Restaura el volcado y **cuenta las filas de cada tabla**, comparándolas contra
   las que había en Supabase.
5. Comprueba que las **cuentas de acceso** (`auth.users`) volvieron. Si no
   vuelven, la base está pero nadie puede entrar.
6. Apaga y borra el Postgres temporal.

Sale con código 0 solo si todo cuadró.

## Requisitos

- **PostgreSQL 15 o mayor** instalado (por `pg_dump`, `pg_restore`, `initdb`).
  `winget install --id PostgreSQL.PostgreSQL.17 --source winget`
- `Web/.env.local` con `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`
- `Web/.env.db-password` con la contraseña de Postgres

## Detalles que cuestan de redescubrir

- **El acceso directo a la base (`db.<ref>.supabase.co`) ya solo tiene IPv6.**
  Desde una red IPv4 no resuelve. Hay que entrar por el *session pooler*
  (`aws-N-<región>.pooler.supabase.com:5432`), que sí acepta `pg_dump`. El
  prefijo de región cambió con el tiempo, por eso el script prueba `aws-0` y
  `aws-1` y se queda con el que responda.
- **El pooler de transacciones (puerto 6543) NO sirve para `pg_dump`.** Tiene que
  ser el de sesión, puerto 5432.
- Sin `--no-owner --no-privileges` el volcado arrastra roles que solo existen
  dentro de Supabase y no se puede restaurar en ningún otro Postgres.
- El respaldo de la base **no incluye los archivos del Storage**. Son dos
  sistemas distintos; por eso el script hace las dos cosas.
