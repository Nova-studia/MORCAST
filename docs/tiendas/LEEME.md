# Material para las tiendas

Todo lo que se necesita para publicar la app. Empieza por
**`SUBIR-A-PLAY-paso-a-paso.md`**: es la guía de arriba a abajo.

| Archivo | Qué es |
|---|---|
| `SUBIR-A-PLAY-paso-a-paso.md` | La guía. Textos para copiar y pegar, y qué archivo va en cada campo |
| `ficha-play-store.md` | Los textos largos de la ficha y las respuestas del formulario de Seguridad de los datos |
| `icono-512.png` | Ícono de la app, 512 × 512 |
| `feature-graphic-1024x500.png` | Gráfico destacado, 1024 × 500 |
| `politica-privacidad.html` | Fuente de lo que está publicado en [morcast.mx/privacidad](https://morcast.mx/privacidad) |
| `QR-ExpoGo-Morcast.png` | QR para abrir la app en Expo Go, para probar sin instalar nada |

## Lo que NO está aquí

**El `.aab` que se sube a Google (57 MB) no va en git.** Es un archivo compilado,
no código: git guardaría una copia entera cada vez que se genere uno nuevo y el
repo crecería sin necesidad.

Vive en `Downloads\Proyectos Claude\MORCAST Tiendas\MORCAST-v1.0.0-vc3.aab`, y si
se pierde se vuelve a generar con EAS Build desde `App Android/`.

**Las capturas de pantalla** tampoco. Están en
`Downloads\Capturas app\listas-para-play\`, ya ajustadas a 1204 × 2408 para
cumplir el límite de proporción de Google.

## Estado

El `.aab` está compilado y revisado — declara solo permisos justificables
(cámara, galería, red y vibración). Falta que Google apruebe la cuenta de
desarrollador de la empresa para poder enviar la ficha.
