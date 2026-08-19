# Subir Morcast a Google Play — paso a paso

Todo lo que necesitas está en esta misma carpeta. Ve tachando.

---

## ⚠️ ANTES DE EMPEZAR — revisa esto primero

En Play Console entra a **Configuración → Detalles de la cuenta de desarrollador**
y mira si dice **Organización** o **Personal**.

- **Organización** → puedes publicar directo a producción. Sigue esta guía tal cual.
- **Personal** → Google exige **12 probadores durante 14 días** en prueba cerrada
  antes de dejarte publicar. No es opcional y no se puede saltar.

**Si sale "Personal", avísame antes de llenar nada** y cambiamos el plan
(los 12 probadores pueden ser tú, tu socio y gente de Morcast; es lento pero
no difícil). No tiene caso llenar 40 campos para toparte con esto al final.

---

## 1. Crear la app

**Todas las apps → Crear app**

| Campo | Valor |
|---|---|
| Nombre | `Morcast del Norte` |
| Idioma predeterminado | Español (México) |
| Tipo | App |
| ¿Gratis o de pago? | **Gratis** ← no se puede cambiar después |

---

## 2. Ficha de Play Store

**Crecimiento → Presencia en Play Store → Ficha principal**

**Descripción breve** (76 car.):
```
Portal de clientes de Morcast: recolección y manejo de residuos industriales.
```

**Descripción completa** — está en `ficha-play-store.md`, sección 3.
Copia todo lo que está entre las comillas triples.

**Gráficos:**
| Recurso | Archivo |
|---|---|
| Ícono | `icono-512.png` |
| Gráfico destacado | `feature-graphic-1024x500.png` |
| Capturas de teléfono | Las 6 de `Downloads\Capturas app\listas-para-play\` |

---

## 3. Configuración de la app (el checklist gris de la izquierda)

### Acceso a la app
**Sí, hay partes restringidas.** Agrega estas credenciales para el revisor:

```
Usuario:    cliente@demo.com
Contraseña: 0011002
```

En instrucciones pon:
```
Cuenta de cliente con saldo y servicios de ejemplo. Al entrar se ve el
inicio, el saldo con movimientos y el historial de recolecciones.
```

### Anuncios
**No, la app no tiene anuncios.**

### Clasificación de contenido
Cuestionario IARC → categoría **Utilidad / Productividad / Negocios**.
Todo en **No** (violencia, sexo, apuestas, drogas). Sale **Para todos**.

### Público objetivo
**18 años o más.** No dirigida a niños.

### Seguridad de los datos
Es la sección más larga. Las respuestas exactas están en
`ficha-play-store.md`, sección 5. Los puntos clave:

- Sí recopila datos · Sí cifrados en tránsito · Sí se pueden eliminar
- Recopila: nombre, correo, teléfono, RFC, comprobante de pago, fotos, historial
- **Nada** se comparte con terceros
- **NO** marques: ubicación, contactos, publicidad, analítica, identificadores

### Apps de gobierno
**No.**

### Funciones financieras
**No.** (La app muestra saldo, pero no procesa pagos.)

### Política de privacidad
```
https://morcast.mx/privacidad
```

---

## 4. La versión de producción

**Versiones → Producción → Crear versión**

1. **Firma de apps:** deja que Google la administre (opción por defecto).
2. **Sube:** `MORCAST-v1.0.0-vc3.aab`
3. **Nombre de la versión:** `1.0.0`
4. **Notas de la versión:**
```
Primera versión de la app de Morcast del Norte.

Consulta de recolecciones, saldo y movimientos, envío de comprobantes
de pago y solicitud de servicios.
```
5. **Países:** México (o los que quieras).

---

## 5. Enviar

**Revisar versión → Iniciar lanzamiento a producción**

Revisión de Google: **de 1 a 7 días** para una cuenta nueva.
Las primeras suelen tardar más que las siguientes.

---

## Si Google rechaza algo

Casi siempre es una de tres:

1. **La política de privacidad no coincide con Data Safety** — que lo que
   marcaste en la sección 5 diga lo mismo que morcast.mx/privacidad.
2. **No pudieron entrar** — verifica que `cliente@demo.com` siga funcionando.
   **Esa cuenta no se toca ni se le cambia la contraseña.**
3. **Permisos que la app no justifica** — poco probable. Estos son los que
   declara el `.aab` que vas a subir (verificados el 13-ago-2026):

   | Permiso | Para qué |
   |---|---|
   | CAMERA | Escanear el QR del contenedor y tomar evidencia |
   | READ / WRITE_EXTERNAL_STORAGE | Adjuntar el comprobante desde la galería |
   | INTERNET · ACCESS_NETWORK_STATE | Conectarse al servidor |
   | VIBRATE | Vibración al tocar botones |
   | BIND_JOB_SERVICE · DUMP | Internos de Expo; el sistema nunca se los da a
   una app de tienda y no le aparecen al usuario |

   **Ninguno es de los que Google pide justificar con un formulario aparte.**
   Ya no trae RECORD_AUDIO ni SYSTEM_ALERT_WINDOW — los quitamos justo porque
   contradecían el aviso de privacidad.

Me dices qué dijeron y lo resolvemos.
