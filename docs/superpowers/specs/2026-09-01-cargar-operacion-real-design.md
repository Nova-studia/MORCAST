# Cargar la operación real, estados de cliente y modo Hold — diseño

**Fecha:** 1 de septiembre de 2026
**Proyecto:** Morcast del Norte (web)
**Estado:** diseño aprobado, pendiente de plan de implementación

---

## 1. Qué problema resuelve

La base de morcast.mx sigue teniendo **5 clientes de prueba** inventados en agosto
(Luis Yanez, Adrian Marcelo, Andrei Cardenas, Gilberto Mora y una cuenta de prueba
del registro con Google) y **3 rutas cuyas zonas tracé yo a mano**. Mientras tanto,
la operación real de Morcast —42 clientes, 68 puntos de recolección, 64 servicios
contratados y 5 rutas— vive en un Excel que la empresa devolvió el 27 de agosto y
que **nadie ha cargado**.

Este trabajo mete la operación real a la base y saca la de mentira. Pero lo hace
sabiendo que **faltan datos**: no hay un solo precio, 13 clientes no tienen correo
y el domicilio fiscal se llenó mal en 28 de 42. Por eso el trabajo trae dos
conceptos nuevos que hacen honesta la carga parcial:

- **`pendiente-info`**, un estado de cliente para el expediente incompleto.
- **el modo Hold**, un interruptor que dice, dentro del propio sistema, que Morcast
  todavía no está cobrando.

## 2. Qué NO resuelve

Escrito por adelantado para que no haya sorpresas:

- **No se les crea acceso al portal a los 42.** Es una cuenta por empresa y 13 no
  tienen ni correo.
- **No se construye la cobranza mensual.** Sigue bloqueada esperando precios; ver
  la memoria `morcast-saldo-mensual-pendiente`.
- **No se dibujan los polígonos por ruta.** El cuaderno da nombres de colonias, no
  coordenadas.
- **No se tocan las apps de Android y iOS.**
- **No se contestan las 7 preguntas abiertas del cuaderno.** Se guardan pegadas al
  cliente al que le tocan.

## 3. El estado real, medido (no recordado)

Medido contra `MORCAST - Cuaderno de captura LLENO.xlsx` y contra la base de
producción el 1-sep-2026. **Corrige dos cifras que la memoria traía mal.**

### En la base hoy

| | |
|---|---|
| Clientes de prueba | 5 (`MOR-2026-0001` … `0005`), cada uno con perfil de acceso |
| Colgando de ellos | 4 domicilios, 4 suscripciones, 2 solicitudes, 1 movimiento de saldo, 2 recolecciones con fotos en la cubeta, 2 solicitudes de alta |
| Rutas | 3 demo (`RT-CENTRO`, `RT-INDUSTRIAL`, `RT-NORTE`) con zonas trazadas a mano |
| Personal | 1 dueño, 1 chofer |

### En el cuaderno

| | |
|---|---|
| Clientes | 42 únicos (44 renglones, 2 duplicados: `LLANTERA LLANTAS` y `LLANTERA JESUS`) |
| Puntos de recolección | 68 |
| Servicios contratados | 64 |
| Rutas | 5 — RUTA 1 (roll-off, Rafael), RUTA 2 (manual, Jorge), RUTA 3 (compactador, Jair), RUTA 10 (Marco Antonio) y RUTA 11 (Rodolfo) |

### Lo que está roto en el cuaderno

- **21 renglones de punto** apuntan a una empresa que no existe en la hoja de
  clientes. Casi todos por el mismo error: en KARZO y en Nacionales escribieron el
  nombre de la **sucursal** en la columna de empresa.
- **12 servicios** no amarran con su punto: renglones que cubren varios puntos a la
  vez (`CEMEX / PLANTA 1 Y 2`, `CARNE MART / SURCURSAL 01-02-03 Y 04`), los 3 de TPI
  que dicen todos "PLANTA", y 4 de `LLANTERA` cuando en clientes existen **dos**
  llanteras distintas.
- **Un renglón de instrucciones del cuaderno se coló entre los servicios**
  ("RECOLECCIONES AL MES es el dato que más importa…"). No es un servicio: se
  descarta, no se mapea.
- **NINGUNO de los 42 clientes tiene domicilio fiscal.** Medido el 1-sep-2026
  contra el volcado, sobre los 42 únicos: **29** traen el RÉGIMEN en esa columna
  ("General de Ley Personas Morales", "Personas Físicas con Actividades
  Empresariales"), **11** están vacíos y **2** dicen literalmente `"N-A"`.
  Morcast **no puede facturarle a ningún cliente** hasta que la empresa entregue
  esos datos. Ya se los pidieron en la hoja 3 de
  `MORCAST - Lo que falta del cuaderno.xlsx`.

> **Corrección a la memoria:** decía 23 puntos huérfanos, 70 puntos y 64 servicios.
> Lo medido es **21**, **68** y **65 renglones, de los cuales 64 son servicios**.

### Dónde queda la vara de "completo"

Se eligió **contacto + teléfono + correo**: es lo que hace falta para *operar*
—saber a quién llamar y a dónde mandarle su acceso— y deja lo fiscal aparte.

| Criterio | Activos | Pendientes |
|---|---|---|
| Sólo correo | 31 | 11 |
| **Contacto + teléfono + correo** | **26** | **16** |
| + RFC | 18 | 24 |
| + domicilio fiscal real | **0** | 42 |

El último renglón es la razón de la decisión: exigir domicilio fiscal dejaría
**CERO clientes activos de 42**, porque la empresa llenó mal esa columna en
todos. Lo fiscal sirve para facturar, no para operar.

> Corregido el 1-sep-2026 al medirlo con la regla real de `esRegimen()`. La
> primera medición decía "28 de 42" y que 2 tenían dirección; se le habían
> escapado 3 regímenes escritos como "Personas Físicas con Actividades
> Empresariales", y los 2 supuestos domicilios dicen `"N-A"`.

## 4. El modelo de datos

Una migración, `db/019-la-operacion-real.sql`, con tres cambios.

### 4.1 `clientes.estado` acepta un valor nuevo

```sql
check (estado in ('activo','pendiente-info','suspendido','baja'))
```

`pendiente-info` en la base, **"Pendiente por información"** en pantalla.

**No toca RLS, y es deliberado.** El estado del cliente nunca ha controlado el
acceso al portal —lo controla tener perfil con rol `cliente` y contraseña— y no va
a empezar a hacerlo aquí. Mezclar "le falta el teléfono" con "puede entrar" es
exactamente cómo se cuelan los agujeros de permisos.

### 4.2 `clientes.nota_interna text`

Para las dudas abiertas del cuaderno, pegadas al cliente al que le tocan:
*"¿KARZO y KARZINI son la misma empresa?"*, *"¿Nacionales son 9 sucursales o 9
clientes?"*. Hoy esas preguntas viven en un Excel que nadie va a volver a abrir.
Es interna: la ve el personal de Morcast, nunca el cliente.

**Lo que le falta a un cliente NO se guarda en una columna**: se calcula al momento
mirando qué campos están vacíos. Guardarlo sería una copia que se desincroniza en
cuanto alguien llene el teléfono.

### 4.3 `suscripciones.dias text[]`

La hoja 1 del cuaderno resultó ser **un calendario de puntos disfrazado**: sus
renglones 6–45 van en el mismo orden que la hoja 3, verificado cruzando la colonia
(39 de 40 coinciden exactas). Eso regala **el día de la semana de cada punto**, que
el cuaderno no pedía en ningún lado, y es la materia prima de la agenda del chofer.

Se guarda ahora porque es gratis —el dato ya está en el archivo— y porque no
guardarlo obliga a rehacer ese cruce desde cero más adelante.

> **La migración debe llevar escrito, en un comentario, que este dato sale de un
> cruce por posición y no de algo que la empresa haya declarado.** Quien lo use
> después tiene que saber su nivel de confianza.

**No se construye la agenda del chofer en este trabajo.** Sólo se guarda el dato.

### 4.4 Dos cambios de código que la migración obliga

**`DIAS_SEMANA` gana el domingo** (`lib/rutas-datos.js`). La regla "se opera de
lunes a sábado, nunca domingo" era una suposición mía, y el cuaderno la desmiente:
RUTA 10 y RUTA 11 (las de TPI) trabajan "LUNES A DOMINGO". Como
`/admin/rutas` filtra los días contra esa constante, **un domingo guardado en la
base se borraría solo, sin avisar, la primera vez que alguien abriera esa ruta en
el panel.**

**Las etiquetas de `/admin/clientes`.** Hoy la pantalla pinta
`estatus === "activo" ? "Activo" : "Moroso"`. Sin tocarlo, **los 16 pendientes
aparecerían en vivo acusados de morosos**. Pasa a tres etiquetas: Activo (verde) ·
Pendiente por información (ámbar, con lo que le falta al pasar el ratón) ·
Suspendido. El conteo del tablero (`lib/datos-panel.js`) cuenta hoy
`estado = 'activo'`; se le agrega el conteo de pendientes.

## 5. El modo Hold

### 5.1 Dónde vive el interruptor

Un archivo nuevo, `lib/estado-sistema.js`:

```js
export const HOLD = {
  activo: true,
  titulo: "Sistema en preparación",
  motivo: "Estamos cargando la operación y afinando la lista de precios. " +
          "Todavía no se generan cobros.",
  desde: "2026-09-01",
};
```

**Por qué en un archivo y no en una tabla con un switch en el panel:** el Hold se
apaga exactamente el día que lleguen los precios reales, y los precios también
viven en un archivo (`CATALOGO_COTIZADOR` en `lib/portal-datos.js`). Apagar el Hold
y meter los precios son, inevitablemente, el mismo commit. Una tabla daría un
interruptor que de todos modos no se puede accionar solo, porque apagar el Hold sin
precios cargados rompe el cotizador. Sigue el precedente que ya existe en el
proyecto: `DATOS_DEPOSITO.demo`.

**El motivo va junto al interruptor a propósito.** Dentro de tres meses, quien lo
encuentre encendido va a querer saber por qué, y la respuesta no puede estar sólo en
una conversación.

### 5.2 El aviso

Un componente `<AvisoHold/>` montado en los dos shells. **Banda ámbar, no modal:**
informa sin estorbar. En el portal muestra el motivo; en el panel agrega *"los
clientes ven este aviso"*, para que el equipo de Morcast sepa qué está viendo su
cliente.

### 5.3 Qué se apaga, y qué no

La distinción es **por quién mira**, no por si la pantalla habla de dinero.

**Del lado del cliente se apaga todo** — ahí es donde una cifra falsa hace daño:

| Superficie | Durante el Hold |
|---|---|
| `/portal/cotizador` | No calcula ni muestra montos. Aviso + enlace para contactar a Morcast |
| PDF de cotización (`lib/portal-pdf.js`) | **No se genera.** Un PDF con membrete y precios inventados sobrevive al Hold y anda suelto para siempre |
| `/portal/agregar-saldo` | Ya oculta la CLABE falsa; ahora también el resto de las cifras |
| Tarjeta de saldo de `/portal` | El aviso en lugar de los montos |
| `/portal/reportes` | Los importes en `—` y sin PDF. **Los servicios y sus fechas se quedan: son ciertos** |

> `/portal/reportes` se agregó a esta tabla al revisar el plan contra el spec.
> Se me había pasado: la pantalla llama a `pesos()` y baja un PDF. La regla no
> cambia —del lado del cliente se apaga todo el dinero—, sólo faltaba el
> renglón.

**Del lado de Morcast se quedan las cifras, con el banner encima** —
`/admin/saldos`, `/admin/clientes`, el tablero y reportes. Son sumas reales de la
base, no inventadas, y después de borrar los clientes de prueba van a estar en cero
de todos modos. Esconderle a Morcast sus propios números no protege a nadie y les
quita la herramienta de verificar un depósito si alguien deposita.

### 5.4 Un límite conocido

Las apps de Android y iOS **no comparten código con la web**: tienen sus propias
copias de los datos de cotización (`App IOS/src/cotizacion-datos.js`,
`App Android/src/…`). **El banner del Hold no les llega.** Hoy no importa porque
ningún cliente real tiene acceso, pero si se le entrega la app a alguien antes de
quitar el Hold, verá los precios viejos. Queda anotado, no resuelto.

## 6. Las zonas de cobertura

Las 5 rutas reales entran con su tipo, días, chofer, unidad y las colonias en
texto, **pero sin polígono propio**: el cuaderno da nombres de colonias, no
coordenadas.

El verificador de cobertura de la página pública —el que capta prospectos y los
guarda en `zonas_pedidas`— pasa a usar **una sola zona que cubre la ciudad de
Matamoros**. Es la verdad operativa, sigue captando prospectos y no miente. Si las
5 rutas entraran con zona vacía, el verificador diría que **nadie** tiene cobertura,
incluida gente que sí la tiene.

**De dónde sale ese polígono y dónde vive.** Se arma unificando las 3 zonas que hoy
existen, que en agosto ya se habían ampliado a toda la ciudad de Matamoros: el
contorno resultante es la misma superficie que el sitio viene declarando desde
entonces, así que no cambia la promesa que ya se le hizo a nadie.

**Vive como constante en el código, no como fila en `rutas`.** Es la única forma de
que sobreviva al borrado de las 3 rutas demo, y además dice la verdad sobre lo que
es: una zona de cobertura de la empresa, no la zona de ninguna ruta en particular.
`zonasDeCobertura()` —que ya es la vía por la que el mapa público y `/portal/cobertura`
obtienen las zonas— pasa a devolver esta única zona mientras dure la carencia de
polígonos reales.

Los polígonos por ruta se dibujan cuando la empresa los dé, y ese día
`zonasDeCobertura()` vuelve a leer de `rutas`.

## 7. El script de carga

Va en `Web/scripts/cuaderno/`, en cuatro piezas con una sola responsabilidad cada
una, para que la parte con reglas se pueda probar sin base de datos ni Excel.

### 7.1 `extraer.py` → `cuaderno.json`

Vuelca el `.xlsx` **tal cual, sin ninguna regla**: hojas, renglones, celdas. El JSON
**se sube al repo**.

El `.xlsx` es un binario que vive fuera del repo y que nadie puede revisar en un
diff. Con el JSON dentro, la carga es reproducible y auditable: dentro de seis meses
se ve exactamente con qué datos se pobló la base.

Se usa Python porque `openpyxl` ya está disponible y el proyecto no tiene librería
de Excel en `package.json`. No se agrega una dependencia nueva para un paso de una
sola vez.

### 7.2 `normalizar.mjs` — funciones puras, sin red ni disco

Todas las reglas viven aquí, y aquí aplica TDD. Cada regla nace de un renglón real
del cuaderno, y ese renglón es su prueba:

- `N-A`, `NA`, `NO`, `-` → `null` de verdad, no la cadena `"N-A"`.
- Teléfonos: `(868)1490531` → `8681490531`.
- **El régimen se muda, no se tira.** Los 29 regímenes mal puestos en la
  columna de domicilio pasan a `clientes.regimen`, que existe y está vacía;
  `domicilio_fiscal` queda en `null`. Es un dato bueno guardado en el cajón
  equivocado.
- El renglón de instrucciones colado entre los servicios se descarta por lo que es.
- `roll off` / `ROLL -OFF` → `roll-off`; `RUTA10` → `RUTA 10`.
- `"LUNES Y JUEVES"`, `"LUNES A SABADO"`, `"LUNES A DOMINGO"`, `"POR LLAMADA"` →
  arreglo de días. **"Por llamada" no es un día:** queda sin días fijos y marcado
  como servicio a solicitud, que es lo que realmente es.
- El estado: `activo` si tiene contacto + teléfono + correo; si no, `pendiente-info`.
- `frecuencia` se deriva de las recolecciones al mes, y el número exacto se conserva
  en `suscripciones.servicios_por_mes`.

### 7.3 `equivalencias.js` — la tabla escrita a mano

Los 21 puntos huérfanos y los 12 servicios sueltos se resuelven aquí, un renglón por
caso, con el nombre del cuaderno a la izquierda y el cliente real a la derecha.

**Sin parecido de texto, sin adivinar.** Lo que no esté en esta tabla **detiene el
script**, que imprime la lista y sale con error. Vale más que falle diez veces a que
le cuelgue un servicio a la empresa equivocada — eso es facturarle a quien no era.

**Los casos que el script no resuelve y se le presentan a Luis como preguntas:** las
4 `LLANTERA` (existen dos llanteras distintas en clientes) y la relación entre
`KARZO` y `KARZINI`.

### 7.4 `cargar.mjs` — lo único que toca la base

- **`--ensayo` es el modo por omisión.** Enseña el informe completo —qué crea, qué
  actualiza, quién queda activo, quién pendiente y por qué— y **no escribe nada**.
  Para escribir hay que pedirlo con `--de-verdad`.
- **Idempotente.** Busca por llave natural (empresa normalizada; punto por
  cliente + alias) y actualiza si ya existe. Se puede volver a correr cuando la
  empresa mande las correcciones, sin duplicar nada.
- **Cuenta las filas devueltas en cada escritura**, no confía en la ausencia de
  error: un INSERT que el RLS bloquea responde 200 y no inserta nada. Esa ya mordió
  antes en este proyecto.

## 8. El borrado de los datos de prueba

Va en `respaldar.mjs` + `limpiar.mjs`, **separado de la carga a propósito**: dos
comandos distintos, para que nadie borre producción creyendo que sólo cargaba.

1. **Respaldo primero.** Volcado JSON de todas las tablas y de la lista de archivos
   de la cubeta, con fecha, **fuera del repo**. Sin respaldo escrito, no borra.
2. **El perfil se desengancha antes de borrar la empresa.** `perfiles.cliente_id` es
   `ON DELETE CASCADE` hacia `clientes`: borrar la empresa **se lleva por delante el
   perfil de una persona real**, dejándola sin poder entrar nunca más. Se pone
   `cliente_id = null`, se cuentan las filas, y sólo entonces se borra la empresa.
3. **Las fotos también.** Las 2 recolecciones de prueba tienen imágenes en la
   cubeta; borrar sólo las filas deja archivos huérfanos que nadie podrá relacionar
   con nada.
4. **Orden respetando las llaves:** recolecciones → solicitudes → movimientos →
   suscripciones → domicilios → desenganchar perfiles → usuarios de Supabase →
   clientes.
5. **Verificación después:** vuelve a contar y enseña el antes y el después. Ya pasó
   en este proyecto dar por fallido algo que sí se había ejecutado.

**Alcance:** los 5 clientes de prueba (los 4 de agosto + `MOR-2026-0005`, la cuenta
de prueba del registro con Google) con todo lo que cuelga de ellos, y las 2
solicitudes de alta. **Se conservan la cuenta de dueño y la del chofer.** Las 3
rutas demo se van al entrar las 5 reales.

> Borrar `MOR-2026-0005` deja al proyecto sin cuenta de cliente de prueba. Cuando se
> pruebe la recuperación de contraseña desde el teléfono, hay que volver a crear una
> registrándose con Google — lo cual, de paso, vuelve a probar ese flujo.

## 9. Pruebas

**`normalizar.mjs` se escribe con TDD**, con `node --test`, como los 4 archivos que
ya hay en `tests/`. Cada prueba se nombra por el renglón real que la obligó a
existir —"el domicilio fiscal que en realidad es el régimen", "POR LLAMADA no es un
día", "el renglón de instrucciones no es un servicio"— igual que las 12 pruebas de
`origen.mjs`, que quedaron nombradas por el agujero que cerraban y por eso siguen
siendo legibles.

La regla de completitud también se prueba: **un cliente con contacto y teléfono pero
sin correo tiene que salir `pendiente-info`**. Esa prueba es la que impide que un
cambio futuro deje entrar a los 16 por descuido.

`equivalencias.js` y `cargar.mjs` no llevan pruebas automáticas: uno es una tabla de
datos que revisa Luis, el otro habla con la base y su prueba real es el ensayo.

## 10. Puesta en marcha

**No hay ambiente de pruebas.** Esta base es producción, y levantar un Supabase
paralelo es más trabajo que la tarea entera. Lo que juega a favor: **hoy no hay un
solo cliente real con acceso**; los únicos usuarios son Luis y Claude. Es el momento
más barato de la vida del proyecto para hacer esto, y no vuelve.

El orden importa:

1. **Migración `019` por `psql`.** Es aditiva —ensancha un CHECK y agrega dos
   columnas nuevas que ningún código existente lee ni exige—: el sitio que está
   corriendo no se entera.
2. **Código primero, datos después.** El Hold y las tres etiquetas se despliegan
   **antes** de tocar los datos. Al revés habría una ventana en la que los 16
   pendientes salen en vivo etiquetados como **"Morosos"**.
3. **Respaldo** completo a JSON.
4. **Ensayo**, revisado **junto con Luis** antes de escribir nada: los 26 activos,
   los 16 pendientes con lo que le falta a cada uno, y las preguntas que el script no
   pudo resolver solo.
5. **Limpiar** los 5 de prueba.
6. **Cargar** de verdad.
7. **Verificar:** conteos antes/después, tres clientes abiertos a mano en el panel,
   los 16 pendientes bien etiquetados, el cotizador apagado y el mapa de cobertura
   todavía dibujando.

**Nada se empuja a `main` sin autorización de Luis.** En Vercel el push *es* el
despliegue, así que se le pide el visto bueno **dos veces**: una para el código y
otra antes de escribir en la base.

**Si algo sale mal:** el respaldo JSON restituye, y la migración es aditiva, así que
quedarse a la mitad no rompe nada — deja la base con dos columnas de más que nadie
lee.

**Lo que el respaldo NO devuelve, y hay que saberlo antes de empezar:** los usuarios
de Supabase borrados no se restituyen con su misma contraseña. Si hubiera que echar
atrás, las 5 cuentas de prueba se vuelven a crear, no se resucitan. No es pérdida
real —son cuentas de prueba y sus contraseñas están en los tres `.txt` de la raíz del
repo— pero conviene no descubrirlo a media reversión.

## 11. Decisiones tomadas y por qué

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Vara = contacto + teléfono + correo | Exigir también domicilio fiscal | Dejaría 2 activos de 42, por un error de captura de la empresa |
| Hold en un archivo | Tabla `configuracion` + switch en el panel | El Hold se apaga en el mismo commit que entran los precios; el switch no se podría usar solo |
| Cifras visibles del lado de Morcast | Apagarlas también en el panel | Son sumas reales, no inventadas; esconderlas no protege a nadie |
| Zona única "Matamoros" | Que Claude trace 5 polígonos | Serían trazos inventados otra vez, el mismo problema que ya hay |
| Script en 4 piezas + JSON en el repo | Migración SQL con los INSERT | Las reglas de limpieza quedan legibles y el script se vuelve a correr cuando lleguen las correcciones |
| Tabla de equivalencias a mano | Parecido de texto | Amarrar un servicio a la empresa equivocada es facturarle a quien no era |
| `pendiente-info` sin efecto en RLS | Que el estado controle el acceso | Mezclar "le falta el teléfono" con "puede entrar" es cómo se cuelan los agujeros |
