# Sistema de diseño — Morcast del Norte

> Este archivo manda. Antes de cualquier cambio visual en la web pública, léelo.
> Si algo del código no coincide con lo de aquí, el código está mal.
> Creado el 3-sep-2026 con `/design-consultation`.

## Contexto del producto

- **Qué es:** web pública de MORCAST DEL NORTE, S.A. de C.V., manejo integral de
  residuos industriales en Matamoros, Tamaulipas.
- **Para quién:** empresas, no personas. El comprador real es un **gerente de
  planta que tiene que justificarle a su jefe con quién firmó**.
- **Tipo:** sitio de captación (marketing) + portal de clientes + panel de
  administración + modo chofer.
- **Lo que debe quedarle grabado a quien entra:** *esta es una empresa seria y
  formal.* Toda decisión de color, tipografía y espacio sirve a eso.

## Qué se investigó, y qué salió

Se revisaron con capturas: **Caza Residuos** (Reynosa), **TRISA** (con sucursal
en Matamoros), **PASA**, **AMP Robotics** y **Veolia**.

| | Las tres locales | AMP | Veolia |
|---|---|---|---|
| Fondo | Blanco | Negro | Gris carbón |
| Verde | Saturado | **Ninguno** | **Ninguno** |
| Acento | — | Amarillo del chaleco (en la foto) | Rojo |
| Titular | Condensada MAYÚSCULAS | Condensada MAYÚSCULAS | Minúsculas humanista |

**El hallazgo que gobierna este sistema:** en residuos, el verde saturado señala
el *discurso ecológico*, no la operación. Las dos empresas más creíbles de la
categoría no usan verde. Las tres locales sí. Para leerse formal hay que
**gastar el verde en una sola cosa** y no dejarlo decorar la página entera.

Referencia estética que aprobó el cliente: <https://studiocouture.co/>
(hero como cartel, rótulos pequeños y espaciados, mucho aire, el color lo ponen
las fotos).

## Dirección estética

- **Dirección:** industrial/utilitaria cruzada con editorial.
- **Decoración:** mínima. Sin cortes diagonales, sin degradados de dos colores,
  sin manchas, sin iconos en círculos de color, sin carruseles.
- **Ánimo:** una empresa establecida con papeles en regla. La formalidad viene
  de *quitar*: menos color, más aire, y que los números se vean medidos.
- **Tema:** **oscuro**, en todo el sitio. Se evaluó pasar el cuerpo a claro
  editorial y **se descartó** (decisión de Luis, 3-sep-2026).

## Color

**Enfoque: restringido.** Un color de acción y un color de marca. Nada más.

### Superficies
| Token | Valor | Uso |
|---|---|---|
| `--mc-negro` | `#0B0E0F` | Fondo del hero y del pie |
| `--mc-fondo` | `#121516` | Fondo base del cuerpo |
| `--mc-fondo-2` | `#191D1E` | Banda alterna, separa secciones sin líneas |
| `--mc-superficie` | `#1B1F20` | Tarjetas |
| `--mc-linea` | `#2A2F30` | Bordes y separadores. **Nunca sombras para separar** |

### Texto
| Token | Valor | Uso |
|---|---|---|
| `--mc-tinta` | `#ECEDEA` | Texto principal |
| `--mc-gris` | `#9BA3A1` | Texto secundario |
| `--mc-gris-2` | `#6E7877` | Pies de foto, etiquetas apagadas |

### Marca y acción
| Token | Valor | Uso | Contraste sobre `#121516` |
|---|---|---|---|
| `--mc-azul` | `#2A6A99` | **Sólo la acción principal.** Si aparece dos veces en una pantalla, algo se hizo mal | 3.16:1 separación · 5.80:1 el texto blanco |
| `--mc-verde` | `#265421` | Marca. **Sólo como relleno grande** (botón de marca, barras) | — |
| `--mc-verde-txt` | `#6FA867` | El verde **cuando es texto** sobre oscuro | 6.53:1 ✓ |

🔴 **Regla que no se rompe:** `#265421` **no se usa nunca como texto sobre fondo
oscuro.** Da 2.07:1 y el ojo no lo separa del fondo. Para texto va `#6FA867`.
El `#265421` es el tono que eligió Luis y se respeta tal cual donde sí funciona.

🔴 **Fuera de la web pública:** `--mc-teal` (`#144c4f`) y `--mc-naranja`
(`#db652d`) sobreviven **sólo dentro** de `/portal` y `/admin` como identidad de
esas áreas. En la portada y en las páginas públicas no aparecen.

### Estado (semántico, no es color de marca)
| Token | Valor |
|---|---|
| `--mc-ok` | `#6FA867` |
| `--mc-alerta` | `#D6A44A` |
| `--mc-error` | `#D9776B` |

Sólo en formularios y avisos. No decoran nada.

## Tipografía

Dos familias. Una para leer, otra para medir. Las dos gratuitas en Google Fonts.

| Rol | Familia | Peso | Tamaño | Notas |
|---|---|---|---|---|
| Titulares | **Instrument Sans** | 400 | `clamp(28px, 4.1vw, 52px)` | **MAYÚSCULAS**, `letter-spacing: .07em`, `line-height: 1.16` |
| Títulos de sección | **Instrument Sans** | 400 | `clamp(22px, 2.7vw, 34px)` | MAYÚSCULAS, `.08em`, máx. 22ch |
| Cuerpo, menú, botones | **Instrument Sans** | 400 · 500 | 16px / 1.65 | Máx. **62 caracteres** por renglón |
| Botones | Instrument Sans | 500 | 11px | MAYÚSCULAS, `.14em` |
| Cifras y códigos | **JetBrains Mono** | 400 · 500 | 10.5–30px | |
| Rótulos (eyebrow) | JetBrains Mono | 400 | 10.5px | MAYÚSCULAS, `.16em`–`.18em` |

Carga: `https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400;0,500;0,600;1,400&family=JetBrains+Mono:wght@400;500&display=swap`

🔴 **Regla dura de la monoespaciada:** sólo números, códigos de permiso, medidas
y fechas. En cuanto se use para una frase completa, la página se ve
"tecnológica" y se pierde lo formal.

🔴 **Los títulos van en mayúsculas pero espaciados.** El titular anterior gritaba
a 96px en condensada negra. A 52px con `.07em` ocupa un ancho parecido y deja de
gritar: **el aire entre letras es lo que lo vuelve formal en vez de agresivo.**

**Descartadas y por qué:** Instrument Serif (elegante pero Luis la rechazó),
Cabinet Grotesk y General Sans (buenas, pero meten una familia de pago externa),
**NATS** (es la de Studio Couture y **no existe en Google Fonts**, es de licencia
comercial: la API responde `400 Font family not found`), Jost (funcionaba, no fue
la elegida).

## Vidrio esmerilado

El material de la marca. Se usa en **tres sitios y en ninguno más**, o deja de
significar algo: el rótulo del hero, la acción principal y la acción secundaria.

### Receta del vidrio pulido (acción principal)
```css
background: linear-gradient(180deg, rgba(78,152,205,.52) 0%, rgba(35,92,136,.40) 100%);
border: 1px solid rgba(140,200,240,.40);
backdrop-filter: blur(20px) saturate(1.7);
border-radius: 8px;
box-shadow:
  inset 0 1px 0 rgba(255,255,255,.34),   /* luz de arriba */
  inset 0 -1px 0 rgba(0,0,0,.20),        /* sombra de abajo */
  0 6px 20px rgba(0,0,0,.34);            /* sombra exterior */
```

🔑 **La luz interior de 1px arriba y la sombra abajo son lo que lo vuelven
material.** Sin ellas queda un recuadro translúcido plano. Y son lo que hace que
el botón siga teniendo cuerpo **sobre fondo plano**, donde el desenfoque no tiene
nada que desenfocar.

### Vidrio neutro (acción secundaria y rótulo del hero)
```css
background: rgba(255,255,255,.10);
border: 1px solid rgba(255,255,255,.16);   /* el rótulo del hero va SIN borde */
backdrop-filter: blur(16px) saturate(1.4);
box-shadow: inset 0 1px 0 rgba(255,255,255,.20);
```

🔴 **La acción principal nunca es de vidrio neutro.** Si el principal y el
secundario tienen el mismo peso, el visitante no sabe qué tocar.

🔴 **Degradados:** sólo verticales y sutiles, imitando cómo cae la luz sobre un
material. El degradado diagonal de dos colores es la marca de casa de las
plantillas genéricas y baja el registro formal.

## Espaciado

- **Base:** 8px. **Densidad:** amplia.
- **Escala:** `8 · 16 · 24 · 32 · 48 · 64 · 96 · 120`
- **Sección a sección:** 120px en escritorio, 64px en teléfono.
- **Columnas de una sección:** 96px de calle.
- **Ancho máximo de contenido:** 1240px.
- **Ancho máximo de una columna de texto:** **62 caracteres.**

## Disposición

- **Híbrida.** El hero es un **cartel**: foto a sangre, una sola idea, ocupa la
  primera pantalla. De ahí para abajo, rejilla editorial con columnas
  asimétricas (`1fr / 1.12fr`, alternando el lado).
- **Menú:** logo **centrado a 40px**, tres enlaces de cada lado.
  `Portafolio · Equipo · Contenedores │ LOGO │ Scrap · Permisos · Empleo · Iniciar sesión`
  **"Inicio" no aparece a propósito: el logo es el enlace a la portada.**
- **Radios:** botones y tarjetas `8px`, fotos `10px`, píldoras y rótulos `4px`.
  🔴 **Nada de píldoras completas** (`999px`): es lo que tenía la página antes y
  se lee a app de celular.

## Movimiento

- **Enfoque:** intencional pero quieto.
- **Entrada:** aparecer + subir 12px, 400ms, `ease-out`, **una sola vez**.
  🔴 Hoy las animaciones se repiten en cada scroll; una animación que se repite
  se siente inquieta y se lee barata.
- **Botones:** `translateY(-1px)` en hover, 260ms `cubic-bezier(.4,0,.2,1)`.
- Nada de escalas ni rotaciones.

## Bitácora de decisiones

| Fecha | Decisión | Por qué |
|---|---|---|
| 3-sep-2026 | Tema **oscuro** en todo el sitio | Se probó el cuerpo claro editorial y Luis lo descartó |
| 3-sep-2026 | Titular en **Instrument Sans MAYÚSCULAS** espaciadas | Luis pidió algo más minimalista y espaciado que el serif |
| 3-sep-2026 | Acción principal **azul acero**, no verde ni ámbar | Un botón verde sobre marca verde desaparece; el ámbar no le gustó; el azul no compite con el rojo de los contenedores |
| 3-sep-2026 | Verde de marca **`#265421`** (lo eligió Luis) | Más oscuro y olivo que el `#1D6B3A` propuesto |
| 3-sep-2026 | Verde de **texto** aclarado a `#6FA867` | `#265421` da 2.07:1 sobre oscuro y no se lee |
| 3-sep-2026 | Azul aclarado a `#2A6A99` | `#1B4A6B` da 1.96:1 de separación y el botón se hundía en el fondo |
| 3-sep-2026 | **Vidrio pulido** en la acción principal | Luis lo pidió; la luz y la sombra interiores lo hacen funcionar también sobre fondo plano |
| 3-sep-2026 | Vidrio **sólo** en 3 sitios | Con todo de vidrio se pierde la jerarquía y no se sabe qué tocar |
| 3-sep-2026 | Fuera teal y naranja de la web pública | Tres acentos peleándose era el problema de origen |
| 3-sep-2026 | "Inicio" fuera del menú | Con logo centrado, el logo es el enlace a la portada |

## Vista previa

Los archivos de esta consultoría están en
`~/.gstack/projects/Nova-studia-MORCAST/designs/design-system-20260903/`

- `morcast-final.html` — la portada completa con el sistema aplicado
- `acabados.html` · `botones-vidrio.html` · `botones.html` — cómo se llegó al botón
- `titulares.html` — las tipografías comparadas
- `rotulos.html` — los seis tratamientos del rótulo
- `tonos.html` — la comparación de contraste
