# Trabaja con nosotros — vacantes y solicitudes de empleo

**Fecha:** 2 de septiembre de 2026
**Estado:** diseño aprobado, sin implementar
**Pedido por:** la empresa, a través de Luis

---

## 1. Qué problema resuelve

Morcast contrata gente —sobre todo choferes y ayudantes de recolección— y hoy no
tiene por dónde recibirla. Quien quiere trabajar ahí tiene que dar con el
teléfono de la oficina o pasar a dejar un papel.

Se quieren dos cosas, y son distintas:

1. Que **la empresa publique sus vacantes** cuando las tenga, sin depender de que
   alguien le mueva el código.
2. Que **cualquiera pueda dejar su solicitud**, haya o no una vacante abierta,
   para que Morcast tenga a quién llamar cuando se abra una.

## 2. Cómo se llama y dónde vive

**"Trabaja con nosotros"**, en `morcast.mx/empleo`.

Se descartaron "Bolsa de trabajo", "Vacantes" y "Contrataciones" por una razón
práctica: **la mayor parte del año Morcast va a tener cero vacantes abiertas**.
Una sección llamada "Vacantes" con la lista vacía se lee como una página rota o
abandonada. "Trabaja con nosotros" sigue teniendo sentido con cero vacantes,
porque ahí lo que invita es dejar la solicitud. "Contrataciones" suena al
departamento interno, no a una invitación.

**Dónde se enlaza:** en el pie de página, junto a Nosotros y Contacto, y con una
banda al final de `/equipo` — quien busca trabajo de chofer ya está ahí mirando
los camiones. **No entra al menú principal**, que tiene seis entradas a
propósito y no debe competir con los servicios.

## 3. Decisiones tomadas, y qué se descartó

| Decisión | Se eligió | Se descartó, y por qué |
|---|---|---|
| Qué pide la solicitud | Datos en el formulario + **currículum opcional** | Currículum obligatorio: en Matamoros el chofer o el ayudante no trae un PDF. Exigirlo deja fuera justo al candidato que más se necesita |
| Quién lo ve en Morcast | **Dueño y administrador** | "Auxiliares sólo publican": ese papel **no existe** en la base (ver §7). Crearlo es otro proyecto |
| Cuánto se guarda | **12 meses**, y se borran solos | "Hasta que alguien las borre": en la práctica nadie borra, y en dos años son cientos de currículums de particulares |
| Quién borra a los 12 meses | **Tarea programada diaria** | Borrar al abrir la pantalla: cero infraestructura, pero si nadie entra en tres meses, la promesa del Aviso de Privacidad es mentira |
| Dónde viven las solicitudes | **En el sistema**, bajo llave | Sólo por correo: no evita guardar datos personales, sólo los muda a una bandeja de Gmail donde viven para siempre, sin permisos y sin quién los borre |

## 4. Lo que ve la gente

Una sola página, tres bloques.

**a) Por qué trabajar en Morcast.** Dos o tres líneas: empresa de Matamoros,
flota propia, permisos vigentes.

**b) Vacantes abiertas.** Cada una con puesto, área (operación u oficina), tipo
(tiempo completo, medio tiempo o temporal), requisitos y un botón **"Aplicar a
esta vacante"**.

Sin vacantes abiertas **no se pinta un hueco**: se pinta la verdad — *"Ahora
mismo no tenemos vacantes abiertas, pero déjanos tus datos y te buscamos cuando
se abra una."*— y debajo el formulario.

**c) La solicitud.** **Un solo formulario** para los dos casos: si se llega desde
una vacante viene con el puesto puesto y guarda a qué vacante aplicó; si se llega
directo, es la solicitud general. No son dos cosas que mantener.

| Campo | Obligatorio | Nota |
|---|---|---|
| Nombre | Sí | |
| Teléfono | Sí | Es por donde Morcast contacta de verdad |
| Correo | **No** | Exigirlo deja fuera al candidato operativo |
| Puesto que busca | Sí | Los puestos abiertos + "Cualquiera" |
| Experiencia | Sí | Texto libre. Aquí es donde de verdad se filtra |
| Currículum | No | PDF, JPG o PNG, máximo 5 MB |
| Acepto el Aviso de Privacidad | Sí | Casilla. Sin ella no se guarda nada |

Al enviar, confirmación con su folio (`EMP-2026-0001`).

**El modo Hold no afecta a nada de esto**: el Hold apaga cifras de dinero y aquí
no hay dinero.

## 5. Lo que ve Morcast

**Una sola entrada en el rail, "Trabaja con nosotros", con dos pestañas.** Una
entrada y no dos: el rail ya tiene doce. No hace falta esconderla de nadie
porque hoy al panel **sólo entran dueño y administrador** — el chofer y el
cliente tienen sus propias puertas.

**Pestaña "Vacantes".** Alta, edición, cerrar y reabrir.
🔑 **Una vacante con candidatos no se puede borrar, sólo cerrar.** Si se
borrara, sus solicitudes apuntarían al vacío y se perdería a qué aplicó cada
quien.

**Pestaña "Candidatos".** Bandeja con los mismos estados que el resto del panel
—**nueva → revisada → contactada → descartada**—, filtrable por vacante. Al abrir
uno: su experiencia completa, botón para escribirle **por WhatsApp** (que es como
Morcast trabaja), y **"Ver currículum"** si lo trajo. Cada cambio de estado va a
la Bitácora con quién lo hizo.

## 6. Arquitectura

### 6.1 Tablas (migración `db/021-trabaja-con-nosotros.sql`)

**`vacantes`**

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid, pk | |
| `puesto` | text, not null | "Chofer de roll off" |
| `area` | text, not null | `operacion` \| `oficina` |
| `tipo` | text, not null | `tiempo-completo` \| `medio-tiempo` \| `temporal` |
| `descripcion` | text | |
| `requisitos` | jsonb, default `[]` | Lista de líneas |
| `estado` | text, not null, default `abierta` | `abierta` \| `cerrada` |
| `creada_por` | uuid → perfiles | Para la Bitácora |
| `creado` | timestamptz, default now() | |

**`solicitudes_empleo`**

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid, pk | |
| `folio` | text, unique, not null | `EMP-<año>-<consecutivo>`. El consecutivo **reinicia cada año**, como el de clientes. Lo pone la base |
| `nombre` | text, not null | |
| `telefono` | text, not null | |
| `correo` | text | Puede ir vacío a propósito |
| `puesto` | text, not null | Lo que escribió o escogió |
| `vacante_id` | uuid → vacantes, **null** | Null = solicitud general |
| `experiencia` | text, not null | |
| `cv_ruta` | text | Ruta dentro de la cubeta. Null si no subió |
| `estado` | text, not null, default `nueva` | `nueva` \| `revisada` \| `contactada` \| `descartada` |
| `notas` | text, default `''` | Lo que anota Morcast |
| `aviso_aceptado_en` | timestamptz, not null | Cuándo aceptó |
| `aviso_version` | text, not null | Qué versión del aviso aceptó. Sale de una constante en el código (`AVISO_PRIVACIDAD.version`, la fecha de su última modificación), no de la fecha del día: dos personas que aceptan el mismo texto en días distintos aceptaron **lo mismo** |
| `creado` | timestamptz, default now() | |

Índices por `creado desc`, por `estado` y por `vacante_id`.

`vacante_id` va con `on delete set null` **además** del candado de la aplicación:
si alguna vez se borra una vacante por SQL directo, la solicitud sobrevive.

### 6.2 Permisos (RLS)

- **`vacantes`**: `select`, `insert`, `update` y `delete` sólo para
  `es_personal()` (que ya existe y significa `rol in ('dueno','admin')`).
  **Sin política para anónimos**: la página pública las lee desde el servidor
  (§6.3).
- **`solicitudes_empleo`**: `select` y `update` para `es_personal()`.
  **Sin política de `insert`, a propósito** — la escribe el servidor con la llave
  de servicio. Es exactamente lo que ya hace `solicitudes_alta`: si se abriera al
  público, cualquiera podría llenar la tabla desde fuera.

### 6.3 Cómo viaja el dato

**Lo que hace distinto a esto de todo lo que ya existe: quien aplica no tiene
sesión.** Hoy el chofer sube su foto y el cliente su comprobante desde el
navegador porque están dentro del sistema. Aquí no hay nadie dentro.

- **Leer las vacantes de la página pública**: acción de servidor que consulta con
  la llave de servicio y devuelve **sólo** puesto, área, tipo, requisitos y
  descripción de las abiertas. Es la misma vía que ya usa `zonasDeCobertura()`
  para el mapa de cobertura de la página pública.
- **Mandar la solicitud**: acción de servidor. El navegador **nunca** toca
  Supabase.
- **Cubeta `curriculums`**: privada, **sin una sola política de acceso público**.
  Nadie de fuera escribe ni lee en ella, ni adivinando la ruta. Sube el servidor
  con la llave de servicio; el panel la lee con un **enlace temporal firmado**,
  con la misma maquinaria de `enlaceTemporal()` que ya usan las evidencias.
- **Folio**: lo pone un disparador de la base con `pg_advisory_xact_lock`,
  calcado de `asignar_folio_cliente()` (db/014), que existe justo para que dos
  solicitudes simultáneas no choquen.

### 6.4 Correos

- **A Morcast**, cada solicitud: quién, qué teléfono, a qué vacante, y si trajo
  currículum. Se reusa la maquinaria de `lib/correo.js`.
- **Al candidato**, sólo si dejó correo: acuse con su folio.

### 6.5 El borrado a los 12 meses

Una **ruta protegida por un secreto** (`/api/tareas/purgar-empleo`), llamada una
vez al día por una **tarea programada de Vercel** declarada en `vercel.json`.
Borra **primero los archivos** de la cubeta y **después** los registros: al
revés quedarían currículums huérfanos que ya nadie sabe de quién son.

Borra **todas** las solicitudes de más de 12 meses, sin importar su estado —
también las `contactada`. Guardar más tiempo a quien ya se contactó sería
inventarse una excepción que el Aviso de Privacidad no dice.

⚠️ **Depende del socio.** `vercel.json` despliega en su proyecto de Vercel. Si
tuviera las tareas programadas apagadas en su plan, hay que pedírselo. **Esto
hay que confirmarlo antes de empezar**, porque el Aviso de Privacidad va a
prometer ese borrado.

## 7. El papel que no existe

Se pidió que los auxiliares pudieran publicar vacantes sin ver currículums. **No
se puede hoy:** "Auxiliar de administrador" y "Facturación" son etiquetas
escritas a mano en la pantalla de Usuarios; la base sólo acepta `dueno`, `admin`,
`operador`, `cliente` y `pendiente`, y todos los permisos del panel se deciden
con `es_personal()` = dueño o admin.

Crear ese papel de verdad toca los permisos de **todo** el panel y es su propio
proyecto. Esta función se construye para dueño y administrador; **el día que ese
papel exista, las vacantes se enganchan cambiando una función de la base**, no
las pantallas.

## 8. Cuando algo sale mal

**La regla que este proyecto ya pagó cara.** En agosto de 2026 el formulario de
contacto estuvo **un mes** diciendo "Gracias" sin mandar un correo, y nadie se
enteró. Por eso aquí:

- **Se guarda primero, se manda el correo después.** Si el correo falla, la
  solicitud ya está en la bandeja: no se pierde y no se le miente a nadie. El
  fallo se anota.
- **"Gracias" sólo si de verdad se guardó.**

**El archivo.**
- Se valida **en el servidor**, no sólo en el navegador: PDF, JPG o PNG, máximo
  5 MB. Lo que valida el navegador es cortesía; lo que manda es el servidor.
- **Se sube el archivo primero y se escribe el registro después.** Si el registro
  falla, **el archivo se borra** — si no, quedan currículums huérfanos en la
  cubeta.

**Que no se llene de basura.** Tope de **3 solicitudes por teléfono cada 24
horas**.

Ojo: **no** se reusa la tabla de la recuperación de contraseña. Esa
(`intentos_recuperacion`) guarda un renglón por correo con la hora del último
intento, y sirve para permitir **uno** por ventana; aquí hacen falta **tres**, o
sea un contador. Se reusa la **técnica**, que es lo que vale: tabla nueva
`intentos_empleo (telefono, intentos, ventana)`, cerrada con RLS encendido y sin
políticas, y la decisión en **una sola sentencia** con `on conflict … where`,
que es lo que la hace atómica — dos solicitudes al mismo tiempo no pueden
saltarse el tope. Al cuarto intento se le dice que Morcast ya tiene su
solicitud.

**Casos raros que sí van a pasar.**
- **La vacante se cierra mientras llenaban el formulario**: la solicitud **entra
  igual**, como solicitud general, y se le avisa que ese puesto acaba de
  cerrarse. No se tira el trabajo de esa persona.
- **Supabase no responde**: se le dice que no se pudo y que lo intente otra vez.
  Nunca "Gracias".

**El consentimiento se guarda con fecha y versión del aviso**, no sólo la
casilla: si algún día alguien pregunta bajo qué términos entregó sus datos, la
respuesta está en la base.

**Modo demostración.** Las pantallas nuevas llevan su respaldo sin base de datos,
como todas las demás. No es un capricho: es lo que permite revisarlas sin tocar
producción.

## 9. Cómo se prueba

**Automático** (se suma a las 78 pruebas que ya corren con `npm test`):

- El folio no se repite con dos solicitudes simultáneas.
- Los límites de texto recortan y no revientan.
- El corte de los 12 meses cuenta bien los días.
- Una vacante con candidatos **no** se puede borrar.
- El freno de 3 por día cuenta correcto y no cuenta de más.
- La conversión de fila de base a fila de pantalla no imprime `undefined` ni
  separadores colgando cuando faltan campos.

**A mano, con el navegador, en teléfono y escritorio:**

- Mandar una solicitud **con** currículum y **sin** currículum.
- Que llegó a la bandeja y que el enlace del currículum abre.
- **Que el correo salió de verdad**, no que la pantalla dijo que salió.
- Que la cubeta está cerrada: intentar leer un currículum sin sesión y confirmar
  que no se puede.

## 10. Lo que hay que tocar fuera de la función

- **Aviso de Privacidad de la web** (`/aviso-de-privacidad`): sección nueva —
  qué se recaba de un candidato, para qué, cuánto se guarda (12 meses) y cómo
  pedir que se borre. La versión del aviso se guarda con cada solicitud.
- **`vercel.json`**: no existe todavía; nace con la tarea programada.
- El **Aviso de Privacidad de la aplicación** (`/privacidad`) **no se toca**:
  esto es sólo web.

## 11. Lo que queda fuera a propósito

- Que el candidato entre a ver el estado de su solicitud. No hay para qué: se le
  llama por WhatsApp.
- Adjuntar el currículum al correo que recibe Morcast. Se abre desde el panel,
  con enlace temporal, para que el archivo no se multiplique en bandejas.
- Filtros por experiencia, calificaciones o etapas de entrevista. Morcast contrata
  poco; con cuatro estados sobra.
- Vacantes en las apps de Android y iPhone. Esto es web.

## 12. Dónde vive cada cosa

Nada de esto existe todavía; se crea siguiendo la estructura que ya tiene el
proyecto.

| Qué | Dónde |
|---|---|
| Migración de la base | `Web/db/021-trabaja-con-nosotros.sql` |
| Página pública | `Web/app/(claro)/empleo/page.js` |
| Formulario (componente de navegador) | `Web/components/FormularioEmpleo.js` |
| Acciones de servidor | `Web/app/acciones-empleo.js` |
| Lectura para el panel | `Web/lib/datos-empleo.js` |
| Pantalla del panel | `Web/app/(admin)/admin/empleo/page.js` |
| Entrada del rail | `Web/components/admin/AdminShell.js` (arreglo `ENLACES`) |
| Enlace del pie | `Web/components/Footer.js` |
| Datos de ejemplo (modo demostración) | `Web/lib/empleo-datos.js` |
| Subida y enlace del currículum | `Web/lib/datos-archivos.js` (se le agregan `subirCurriculum` y `enlaceCurriculum`, junto a los que ya hay) |
| Ruta de la tarea programada | `Web/app/api/tareas/purgar-empleo/route.js` |
| Declaración de la tarea | `Web/vercel.json` (nuevo) |
| Texto del Aviso de Privacidad | `Web/app/(claro)/aviso-de-privacidad/page.js` |
| Pruebas | `Web/tests/empleo.test.mjs` |

**Un secreto nuevo en el entorno:** `CRON_SECRET`, que protege la ruta de la
tarea. Va en Vercel y en `.env.local`, y **no** se sube al repo — que es
público.
