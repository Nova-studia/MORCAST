# Manual de usuario
## Panel de Morcast del Norte

Corte: 14 de agosto de 2026

**Para quién es:** el personal de Morcast que opera el sistema desde la oficina.
**Qué cubre:** todo lo que se puede hacer desde el Panel de administración, más lo
que ve el cliente y lo que ve el chofer, para entender de dónde sale cada cosa.

---

## Antes de empezar: cómo está armado esto

Morcast tiene **tres accesos distintos**, cada uno con su propia pantalla de entrada:

| Quién | Dónde entra | Qué ve |
|---|---|---|
| **La empresa** | morcast.mx/admin/login | Todo: rutas, solicitudes, clientes, saldos, reportes |
| **El cliente** | morcast.mx/portal/login | Solo lo suyo: su saldo, su historial, sus recolecciones |
| **El chofer** | morcast.mx/chofer/login | Solo su recorrido del día |

**Los tres funcionan igual desde la página y desde la app del celular.** La app no
hace nada que la página no haga; es la misma cosa, más cómoda de traer en la mano.
El chofer normalmente usará el teléfono, pero si un día se queda sin batería puede
entrar desde cualquier computadora y seguir trabajando.

Los tres trabajan sobre la misma información. Lo que tú marcas en el panel es lo que
el cliente ve en su portal y lo que al chofer le aparece en el teléfono. **No hay que
capturar nada dos veces.**

### Cómo entrar

1. Abre el navegador y ve a **morcast.mx/admin/login**.
2. Escribe tu correo y tu contraseña.
3. Entras al **Panel**, que es la pantalla de resumen.

Del lado izquierdo está el menú con todo lo que puedes hacer. Si estás en un celular,
el menú se esconde detrás del botón de las tres rayitas, arriba a la izquierda.

Para salir, hasta abajo del menú está **Cerrar sesión**. Conviene usarlo si la
computadora la usa más gente.

---

## El día a día (por dónde empezar)

Si nunca has usado el sistema, este es el orden en que las cosas pasan:

1. Alguien pide informes por el formulario del sitio → te llega a **Solicitudes de
   cotización**. Si en vez de eso se dio de alta directo, te llega a **Altas de
   clientes** (y además por correo).
2. Le hablas, le cotizas y si cierra el trato → le creas su **acceso al portal**
   desde **Solicitudes**.
3. Defines por dónde pasa su camión en **Rutas** (y le dibujas la zona en el mapa).
4. El cliente empieza a pedir sus recolecciones → te caen en **Recolecciones**.
5. Tú las confirmas → pasan solas a **Servicios**, que es la agenda de la flota.
6. El chofer las ve en su teléfono y las levanta con foto y peso.
7. El cliente carga saldo → verificas su comprobante en **Saldos de clientes**.

---

## Rutas

Aquí es donde se define **por dónde pasa cada camión y qué días**. Es la pantalla más
importante del sistema: de lo que se marque aquí depende lo que el cliente ve cuando
pregunta si le damos servicio.

La pantalla tiene dos partes: el **mapa** a la izquierda y los **datos de la ruta** a
la derecha.

### Los tres tipos de ruta

| Tipo | Para qué es |
|---|---|
| **Manual** | Recolección a mano, para comercios y contenedores chicos |
| **Industrial (Roll Off)** | Movimiento de tolvas y compactadores con unidad roll off |
| **Compactador trasero** | Carga trasera compactada, para alto volumen de basura común |

### Cómo dibujar la zona de una ruta

Esto es lo que hace que un cliente vea "sí llegamos a tu zona". Mientras una ruta no
tenga zona dibujada, **no le aparece a nadie**.

1. En la lista de la derecha, da clic en la ruta que quieres marcar. Su zona se
   resalta en el mapa.
2. Arriba del mapa, da clic en **Dibujar zona**.
3. **Ve dando clic en el mapa, en las esquinas del área que cubre la ruta.** Como si
   estuvieras poniendo tachuelas. Cada clic pone un punto y se van uniendo solos.
4. Necesitas **mínimo 3 puntos**. Abajo del mapa te va diciendo cuántos llevas.
5. Si te equivocaste en el último punto, dale a **Deshacer**.
6. Cuando el área ya quede como quieres, dale a **Guardar zona**.

> **Consejo:** no hace falta que sea exacta calle por calle. Marca el área general por
> donde sí pasa el camión; unas 5 a 8 esquinas suelen bastar. Es mejor dejar la zona un
> poco chica que prometer de más: si un cliente queda fuera, el sistema te avisa y
> decides si vale la pena extenderla.

Para rehacer una zona, simplemente vuelve a dibujarla: la nueva reemplaza a la anterior.

### Cerrar una ruta o eliminarla

Abajo de los datos de la ruta, después de **Guardar cambios**, hay dos cosas más:

**Cerrar ruta.** Es lo que casi siempre quieres. La ruta deja de aparecer en el
mapa de cobertura y quien viva ahí pasa a "fuera de cobertura", pero **no se
pierde nada**: sus clientes, sus servicios y su zona siguen guardados, y se
reabre con un clic. Sirve para cuando se descompone la unidad, se va el chofer, o
se suspende una zona por temporada. En la lista de arriba las rutas cerradas
aparecen marcadas como **· cerrada**.

**Eliminar.** Borra la ruta de verdad, y pide confirmación. **Solo se permite si
ningún cliente ni servicio depende de ella** — si los hay, te lo dice con los
números en la mano y te sugiere cerrarla.

> **Por qué no se deja borrar una ruta con historial.** Si se borrara, las
> suscripciones de sus clientes se quedarían sin ruta y los servicios ya hechos
> perderían el registro de por dónde se hicieron. No daría ningún error: se
> perdería el rastro en silencio, que es la peor forma de perderlo. Por eso
> existe *Cerrar*: consigue lo mismo sin romper nada.

### Dónde se cambia la cobertura (y dónde se nota)

**La cobertura se cambia en un solo lugar: aquí, en Rutas → Dibujar zona.** No hay
otro sitio, ni un archivo aparte, ni hay que avisarle a nadie.

Lo que dibujes aquí es lo que ve todo el mundo, al momento:

| Dónde | Qué cambia |
|---|---|
| **Cotización/Alta** (la página pública) | A quien marca su domicilio se le dice "sí llegamos" o "todavía no" según tu zona |
| **Cobertura** (portal del cliente) | El mapa que ve un cliente con su cuenta |
| **Altas de clientes** | El "En ruta / Fuera" de cada solicitud que llega |
| **El correo de aviso** | El asunto dice si está en cobertura o no |

No hay que republicar nada ni esperar: dibujas, guardas, y la siguiente persona que
entre a la página ya obtiene la respuesta nueva.

> **Ojo con desactivar una ruta.** Si le quitas el estatus de activa, su zona
> **desaparece del mapa público** y quien viva ahí pasa a "fuera de cobertura".
> Sirve para cerrar una ruta temporalmente, pero cuidado con hacerlo sin querer.

> **Lo que ya se guardó no se recalcula.** Cada alta que llega guarda si estaba en
> cobertura **el día que la mandaron**. Si mañana extiendes la zona, las altas viejas
> siguen diciendo lo que se le contestó a esa persona ese día — así no se pierde el
> rastro de qué se le prometió a quién.

### Cómo agregar una ruta nueva

1. Arriba de la lista de rutas, da clic en **Nueva ruta**.
2. Nace con un nombre provisional y **sin zona**, así que todavía no le aparece a
   ningún cliente. El sistema te lo dice con un aviso en naranja.
3. Llénale los datos:
   - **Nombre** — como le dicen en la operación ("Ruta Norte", "Industrial 2").
   - **Tipo de ruta** — de los tres de la tabla de arriba.
   - **Unidad** — cuál de los camiones la hace.
   - **Días** — da clic a cada día que pasa. Se pintan de naranja los elegidos. Solo
     hay de lunes a sábado; el domingo no se opera.
   - **Chofer** — quién la maneja.
   - **Cupo por día** — cuántas paradas aguanta esa ruta en un día. Sirve para no
     comprometer más servicios de los que caben.
4. Dibújale la zona con los pasos de arriba.

### Cómo cambiar una ruta que ya existe

Da clic en la ruta en la lista y edita el campo que quieras. Los cambios se ven al
momento. Si le quitas todos los días, la ruta deja de ofrecer fechas al cliente.

---

## Recolecciones

Aquí llega **todo lo que piden los clientes** desde su portal o desde la app. Ninguna
recolección se programa sola: siempre pasa por aquí para que alguien de Morcast la
autorice.

Arriba te dice de un vistazo cuántas están esperando respuesta.

### Qué significa cada estado

| Estado | Qué quiere decir |
|---|---|
| **Solicitada** | El cliente la pidió y está esperando tu respuesta |
| **Confirmada** | Ya la autorizaste; entra a la agenda y al recorrido del chofer |
| **En ruta** | El camión ya va en camino |
| **Completada** | Ya se hizo |
| **Rechazada** | No se pudo, con el motivo que se le explicó al cliente |

Los botones de arriba filtran la lista. **Solicitada** es el que más vas a usar: te
deja solo lo que falta atender.

### Cómo confirmar una recolección

1. Revisa los datos: quién la pide, en qué domicilio, para qué día, y si es de su ruta
   normal o es un servicio extra.
2. Si el cliente dejó una nota, aparece en cursivas abajo. Léela: muchas veces ahí dice
   por qué necesita el servicio extra.
3. Da clic en **Confirmar**.

Listo. La solicitud cambia a *Confirmada* y ya le aparece al chofer en su recorrido del
día.

### Cómo rechazar una recolección

1. **Antes de rechazar, escribe el motivo** en el campo de en medio. Por ejemplo: "no
   hay cupo el sábado, se pasa al lunes".
2. Da clic en **Rechazar**.

El motivo le queda visible al cliente. Si lo dejas en blanco, el sistema pone "Sin cupo
en la ruta", que dice poco: **siempre conviene escribirlo tú**, así el cliente sabe qué
sigue y no vuelve a llamar preguntando.

### De ruta contra Extra

- **De ruta** — el cliente eligió uno de los días en que ya pasa su camión. Casi siempre
  se confirma sin problema.
- **Extra** — pide un servicio fuera de sus días. Aquí sí conviene revisar el cupo de la
  ruta antes de decir que sí.

---

## Zonas pedidas

Esta pantalla vale dinero: te dice **dónde hay gente pidiendo servicio a la que todavía
no llegamos**.

Cuando alguien se da de alta y su domicilio queda fuera de todas las rutas, en vez de
perderlo, el sistema guarda su solicitud aquí con sus datos de contacto.

### Cómo leer el mapa

- Las áreas **verdes** son las zonas que ya cubren tus rutas.
- Los **puntos naranjas** son los que quedaron fuera.
- El mapa se acomoda solo para que quepan todos los puntos, aunque estén lejos.

**Donde veas varios puntos juntos, ahí conviene abrir una ruta nueva.** Ese es todo el
chiste de la pantalla: en vez de adivinar hacia dónde crecer, lo ves.

Si pasas el cursor encima de un punto, te dice de quién es.

### Cómo darles seguimiento

Cada solicitud trae la empresa, la colonia, cuánto volumen calculan, y el nombre y
teléfono de quien la pidió — para que alguien les hable.

Márcala según cómo vaya:

| Estado | Cuándo ponerlo |
|---|---|
| **Nueva** | Recién llegó, nadie la ha visto |
| **En evaluación** | Ya se está viendo si conviene |
| **Aprobada** | Sí se va a abrir ruta para allá |
| **Descartada** | Queda muy lejos o no da el volumen |

Cuando marques una como **Aprobada**, el siguiente paso es ir a **Rutas**, crear la ruta
nueva y dibujarle la zona que incluya ese punto. En cuanto la zona quede dibujada, ese
cliente ya verá que sí le damos servicio.

---

## Solicitudes de cotización

Son las que llegan del **formulario del sitio web**: gente que pidió informes. Es el
embudo comercial.

Cada una trae la empresa, el contacto, el servicio que le interesa, la frecuencia y el
mensaje que escribió. Da clic en la fila para abrirla completa.

### Cómo darles seguimiento

Cambia el estado conforme avanza el trato:

| Estado | Cuándo ponerlo |
|---|---|
| **Nueva** | Acaba de llegar |
| **Contactada** | Ya se le habló |
| **Cotizada** | Ya se le mandó precio |
| **Ganada** | Cerró, es cliente |
| **Perdida** | No se logró |

### Cómo crearle su acceso al portal

Esto es lo que convierte a un prospecto en cliente con cuenta:

1. Abre la solicitud que ya ganaste.
2. Abajo aparece la sección para generar el acceso.
3. El sistema propone un correo de acceso y una contraseña. Puedes usar el botón de
   generar contraseña, o darle a **Editar credenciales** y ponerlas tú.
4. Guarda.

**El sistema no le manda nada al cliente.** Esas credenciales las tienes que enviar tú,
por WhatsApp o por correo. Está hecho así a propósito, para que quede en tu control a
quién y cuándo se le abre el acceso.

---

## Clientes

El padrón completo. Arriba te resume cuántos son, cuántos están activos y **cuánto te
deben en total**.

De cada cliente ves su empresa, contacto, correo, teléfono, desde cuándo es cliente, su
plan, su saldo y lo que tiene por pagar.

Los planes son: **Contrato anual**, **Contrato mensual** y **Por evento**.

También puedes dar de alta un cliente a mano desde **Alta de cliente**, sin esperar a
que llegue por el formulario del sitio.

---

## Saldos de clientes

Aquí se verifica que **el dinero sí llegó** antes de abonarlo a la cuenta del cliente.

El cliente sube su comprobante de pago desde su portal, y aquí aparece pendiente de
revisión.

### Quién puede aplicar un saldo

Esto tiene un candado a propósito: **solo la persona asignada como responsable, o un
Administrador**, pueden confirmar que el pago llegó. Si tu cuenta no tiene ese permiso,
verás las recargas pero no podrás aplicarlas.

Arriba se ve quién es el responsable asignado. **Cada aplicación deja registrado quién
la hizo y cuándo**, así que siempre se puede saber quién dio por bueno un pago.

### Cómo verificar una recarga

1. En **Recargas por verificar**, abre la que quieras revisar.
2. Revisa el comprobante: banco, referencia, monto, fecha y la imagen que subió.
3. **Compara contra el estado de cuenta del banco.** El sistema no puede saber si el
   dinero entró: eso lo confirmas tú.
4. Si todo cuadra, dale a **Aplicar**. El saldo se le abona al cliente al momento.
5. Si no cuadra, dale a **Rechazar**.

> **Nunca apliques un saldo sin haber visto el movimiento en el banco.** Un comprobante
> se puede editar; el estado de cuenta no.

---

## Servicios (la agenda)

Aquí ves **todo junto**: los servicios de siempre y las recolecciones que tú confirmaste
en la pantalla de Recolecciones.

En cuanto le das **Confirmar** a una solicitud, aparece sola en esta lista con su folio
`REC-…`, y hereda la **unidad y el chofer de la ruta** que le toca. No hay que
capturarla dos veces.

Los filtros de arriba son: Todos, Programados, En ruta y Completados.

### El comprobante fotográfico

Los servicios marcados como **Completado** traen un iconito de cámara. Da clic en la
fila y se abre el comprobante que levantó el chofer desde su teléfono: el contenedor con
su código QR, la ubicación GPS, la foto de antes, la de después, el peso y la firma.

Eso es lo que respalda el servicio ante el cliente si algún día lo reclama.

---

## Panel (la pantalla de resumen)

Es lo primero que ves al entrar. No se opera nada desde aquí, solo se mira:

- **Ingresos de los últimos 12 meses**, en gráfica.
- **Embudo de solicitudes** — cuántas van en cada etapa comercial.
- **Solicitudes recientes** — lo último que entró por el formulario del sitio.

Sirve para el vistazo de la mañana: si el embudo tiene muchas *Nuevas* sin mover, es
que nadie está hablándole a los prospectos.

---

## Reportes del negocio

Ingresos y desempeño comercial de los últimos 12 meses, en gráfica y en tabla con el
detalle mes por mes.

---

## Altas de clientes

**Aquí llega quien llena *Cotización/Alta* en la página.** Es la pantalla pública
`morcast.mx/portal/alta`, la que se le pasa a alguien que quiere contratar.

### Cómo te enteras

**No hace falta estar mirando el panel.** En cuanto alguien manda el formulario
pasan tres cosas, al momento:

1. **Te llega un correo a contacto@morcast.mx.** El asunto trae el nombre de la
   empresa y avisa de una vez si el domicilio **queda dentro de tus rutas o no**.
   Puedes responder ese correo directo y le llega al interesado.
2. **La solicitud aparece en el panel**, en **Altas de clientes**.
3. **Al interesado le llega un acuse** con su folio, para que sepa que sí se
   mandó y tenga con qué referirse cuando llame.

Cada alta trae un folio tipo **ALTA-2026-WRT3**. Ese folio lo tienen los tres:
tú en el correo, tú en el panel, y él en su acuse.

### Qué trae cada alta

Todo lo que llenó, en un solo lugar: empresa y contacto, teléfono y correo,
domicilio con **el punto exacto que marcó en el mapa** (hay un enlace para
abrirlo en Google Maps), los tipos de residuo, el equipo que pidió, **cuántas
recolecciones al mes necesita**, y sus datos de facturación (razón social, RFC,
uso de CFDI, forma de pago).

También dice **si cae en cobertura o no**, calculado en el momento en que la
mandó. Eso importa: si más adelante redibujas la zona, aquí sigue guardado lo
que se le dijo a esa persona ese día.

### Cómo trabajarlas

Arriba hay filtros: **Sin atender**, Contactada, Aprobada, Rechazada y Todas.
Abres una y del lado derecho sale el detalle completo, con botones para
**llamar, mandar correo o escribir por WhatsApp** sin copiar el número a mano.

Abajo del detalle marcas en qué va: **Contactada** cuando ya le hablaste,
**Aprobada** cuando se cierra el trato, **Rechazada** si no se hizo.

> Aprobar aquí **no le crea todavía su acceso al portal**. Eso se hace desde
> **Solicitudes**, con *Crearle su acceso al portal*. Aprobar es para que tú
> lleves el control de en qué va cada quien.

### Recolecciones al mes: por qué es un número y no "semanal"

Antes se preguntaba la frecuencia con una lista (semanal, quincenal, mensual) y
no servía: casi ningún negocio genera lo mismo todas las semanas.

Ahora el cliente dice **cuántas recolecciones necesita al mes en total** y él
decide cómo repartirlas. Puede pedir 15 al mes y usar 2 la primera semana, 4 la
segunda, 3 la tercera y 6 la última, según cómo se le junte el residuo. Lo que
se contrata es **el total del mes**; el reparto es cosa suya.

---

## Bitácora

Es la respuesta a *"¿quién hizo esto?"*.

Cada vez que alguien **aplica o rechaza un depósito** o **confirma o rechaza una
recolección**, queda anotado solo: la fecha y hora, el correo de quien lo hizo, qué
hizo y sobre qué. No hay que apuntar nada.

Sirve para lo que tarde o temprano pasa: un cliente dice que su depósito no se
aplicó, o aparece confirmado un servicio que nadie recuerda haber autorizado. En vez
de preguntar de mesa en mesa, se abre la bitácora.

> **No se puede editar ni borrar desde el panel, a propósito.** Una bitácora que el
> interesado puede corregir no prueba nada. Ni siquiera un Administrador puede
> cambiarla. Los clientes no la ven.

---

## Usuarios y roles

Aquí se administran las cuentas del equipo. Se ve el nombre, correo, rol, estatus y
cuándo entró cada quien por última vez.

Para agregar a alguien, usa **Invitar usuario al equipo**: nombre completo, correo y el
rol que le toca.

### Qué puede hacer cada rol

| Rol | Alcance |
|---|---|
| **Administrador** | Acceso total: solicitudes, clientes, servicios, reportes, facturación y usuarios |
| **Auxiliar de administrador** | Solicitudes, clientes y servicios. **No** administra usuarios ni facturación |
| **Facturación** | Clientes, saldos, reportes y documentos fiscales |
| **Operaciones** | Agenda de servicios y manifiestos. Sin acceso comercial |
| **Chofer / Operador** | Solo su agenda del día, desde el celular o desde la página |

> **Da el rol más chico que le sirva a cada quien.** Si alguien solo va a programar
> camiones, dale *Operaciones*, no *Administrador*. El candado de los saldos, por
> ejemplo, depende de esto.

---

## Lo que ve el cliente

No son pantallas tuyas, pero conviene conocerlas: de ahí sale casi todo lo que te
aparece en el panel.

### Cotización/Alta

Un negocio que todavía no es cliente entra a la página, da clic en **Cotización/Alta** y
llena una sola forma: sus datos de contacto, **su domicilio marcado en el mapa**, qué
residuos genera, qué equipo necesita, **cuántas recolecciones al mes necesita** y sus
datos de facturación.

Al marcar el pin, el sistema le contesta **en ese momento**:

- **Si cae dentro de una de tus zonas** — le dice qué ruta le toca y qué días pasa.
- **Si cae fuera de todas** — se lo dice con honestidad y queda registrada su zona.

En los dos casos **su alta te llega**: por correo a contacto@morcast.mx y al panel,
en **Altas de clientes**. Ver esa sección para el detalle.

> **Importante:** el sistema **nunca le pide banco, cuenta ni CLABE al cliente.** Solo
> RFC, razón social, domicilio fiscal, uso de CFDI y cómo prefiere pagar. Morcast cobra
> a su propia cuenta, así que no hace falta guardar datos bancarios de nadie — y no
> guardarlos evita responsabilidades legales por manejo de datos personales. Si algún
> día alguien pide agregar ese campo, esta es la razón de por qué no está.

### Cobertura

El cliente ya registrado puede volver a entrar y consultar el mapa cuando abre una
sucursal nueva, para ver si esa dirección también le queda cubierta.

### Agendar

Desde ahí pide sus recolecciones, y es lo que te cae en **Recolecciones**.

### Lo demás de su portal

Su saldo y estado de cuenta, su historial de servicios con los comprobantes
fotográficos, sus reportes de kilos recolectados, sus documentos fiscales y un
cotizador para armar una cotización él mismo.

### En la app del celular

El cliente tiene **lo mismo en la app**, en el menú **Más**:

- **Cobertura** — el mismo mapa, con las mismas zonas que tú dibujaste.
- **Agendar recolección** — elige uno de los días de su ruta y manda la solicitud.

Es el mismo sistema: lo que dibujas en el panel se ve al momento en los dos lados.

En la app, el servicio **extra** no se pide desde ahí: se pide por teléfono, como se ha
manejado siempre. Desde la página sí se puede pedir extra.

---

## Lo que ve el chofer

El chofer entra con su propia cuenta —desde la app del celular o desde
**morcast.mx/chofer/login**— y **solo ve su recorrido del día**. No ve precios, ni
saldos, ni a los demás clientes.

En cada parada lo lleva de la mano por cinco pasos, y no lo deja avanzar hasta que
cumple el anterior:

| Paso | Qué hace |
|---|---|
| 1. **Identificar el contenedor** | En la app apunta al código QR de la calcomanía. Desde la página lo escribe a mano |
| 2. **Foto antes** | El contenedor lleno. Queda con su hora |
| 3. **Recolectar** | Marca *Ya recolecté* cuando termina la maniobra |
| 4. **Foto después** | El contenedor vacío. También con su hora |
| 5. **Finalizar** | Captura el peso recolectado, **en kilos** |

> **El peso va en KILOS, no en toneladas.** Si se anotan toneladas, el número queda
> mil veces más chico de lo real y todos los reportes salen mal. La app también deja
> escribir el código del contenedor a mano: las calcomanías se despegan, se ensucian
> y con el sol de frente el lector no engancha, y sin esa salida el chofer se queda
> atorado sin poder registrar un servicio que sí hizo.

Eso arma el comprobante que tú ves en **Servicios** y que el cliente ve en su historial.
Por eso importa que el chofer no se salte las fotos: es la prueba del servicio.

---

## La página pública

Además del panel, el sitio tiene sus páginas de cara al público: Inicio,
Portafolio, Equipo, Contenedores, **Scrap** y Permisos.

### Scrap

Es una pestaña **de aviso**: dice *"Próximamente venta y compra de scrap"* y
deja un botón para dejar datos y otro de WhatsApp. Se publicó así a propósito,
porque la pestaña ya tenía que verse en el menú aunque el servicio todavía no
arranque. **No promete nada ni pone precios.**

Cuando tengan definido qué materiales compran, a qué precios o con qué
condiciones, esa página se reemplaza por el contenido real. Mientras tanto, lo
que llegue por ahí cae en **Solicitudes de cotización**, igual que el resto del
formulario de contacto.

---

## Preguntas que suelen salir

**¿Se pierde lo que capturo si cierro el navegador?**
No. Todo se guarda en la base de datos en el momento en que le das Guardar, y ahí
sigue cuando vuelvas a entrar desde donde sea. Además se respalda solo.

**¿Y si alguien borra algo por error?**
Hay respaldo de toda la base y de todas las fotos, y ya se probó que restaura de
verdad — no es un archivo que nadie ha abierto nunca. Además la **Bitácora** guarda
quién hizo cada cambio, así que se puede ver qué pasó y deshacerlo a mano.

**Dibujé mal una zona, ¿la puedo borrar?**
Vuelve a dibujarla encima; la nueva reemplaza a la vieja.

**Un cliente dice que sí le pasamos pero el sistema dice que no.**
Casi siempre es que la zona de esa ruta quedó chica. Ábrela en Rutas y extiéndela.

**El cliente ya pagó pero no le aparece el saldo.**
El saldo no se abona solo: alguien tiene que verificar el comprobante en **Saldos de
clientes** y darle Aplicar. Revisa si está pendiente ahí.

**Confirmé una recolección pero el chofer no la ve.**
Revisa que la ruta tenga chofer asignado en **Rutas**. Si dice "sin chofer asignado", la
recolección no le llega a nadie.

**¿Puedo mandarle yo las claves del portal a un cliente?**
Sí, y de hecho es lo único que funciona: el sistema genera las credenciales pero **no
las envía**. Se las mandas tú por WhatsApp o correo.

**¿Por qué no puedo aplicar un saldo?**
Porque tu cuenta no es la responsable asignada ni tiene rol de Administrador. Es un
candado a propósito.

---

*Morcast del Norte, S.A. de C.V. — documento interno.*
