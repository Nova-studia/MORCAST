"use client";

import { useId, useState } from "react";
import { FiEye, FiEyeOff } from "react-icons/fi";

/**
 * Campo de contraseña con la opción de verla. Oculta por defecto.
 *
 * POR QUÉ EXISTE
 * La contraseña que Morcast le manda a un cliente nuevo la genera el panel
 * (`admin/solicitudes`) y llega por WhatsApp: es una cadena que nadie se sabe
 * de memoria y que se copia a mano. Escribirla a ciegas, en un teléfono, con
 * el autocorrector encima, es la receta para tres intentos fallidos y una
 * llamada a la oficina. Poder verla mientras se escribe resuelve eso.
 *
 * DETALLES QUE IMPORTAN
 *
 * · Oculta al entrar, SIEMPRE. Nunca se recuerda el estado entre cargas: si
 *   alguien deja el teléfono con la contraseña a la vista, es porque lo acaba
 *   de decidir, no porque el sitio lo recordara de ayer.
 *
 * · El botón es `type="button"`. Sin eso, un botón dentro de un formulario es
 *   de envío por defecto y mostrar la contraseña MANDARÍA EL FORMULARIO.
 *
 * · Se cambia el `type` del MISMO input, no se monta otro. Cambiar de nodo
 *   perdería el foco y la posición del cursor a media palabra, y de paso
 *   confundiría a los gestores de contraseñas.
 *
 * · Se conservan `id`, `name` y `autoComplete="current-password"` para que los
 *   gestores de contraseñas sigan reconociendo el campo y ofreciendo guardar.
 *
 * · Con la contraseña a la vista se apagan autocorrector, mayúsculas
 *   automáticas y revisión ortográfica: con `type="password"` el teclado del
 *   teléfono ya los apaga solo, pero al pasar a texto normal vuelven, y le
 *   cambian la primera letra a la contraseña sin avisar.
 *
 * · El botón mide 44 px: se usa también en el modo chofer, con guantes.
 */
export default function CampoContrasena({
  id,
  value,
  onChange,
  etiqueta = "Contraseña",
  autoComplete = "current-password",
  placeholder = "••••••••",
  required = true,
  ...resto
}) {
  const [visible, setVisible] = useState(false);
  const idAuto = useId();
  const idCampo = id || idAuto;
  const idAviso = `${idCampo}-aviso`;

  return (
    <div className="pt-campo">
      <label htmlFor={idCampo}>{etiqueta}</label>
      <div className="pt-campo-clave">
        <input
          id={idCampo}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          autoCapitalize={visible ? "off" : undefined}
          autoCorrect={visible ? "off" : undefined}
          spellCheck={visible ? false : undefined}
          {...resto}
        />
        <button
          type="button"
          className="pt-ver-clave"
          onClick={() => setVisible((v) => !v)}
          // El nombre accesible dice lo que VA A PASAR al apretarlo, y
          // `aria-pressed` dice en qué estado está ahora. Con solo el icono,
          // un lector de pantalla anunciaría "botón" y nada más.
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={visible}
          aria-controls={idCampo}
          // No debe alcanzarse con Tab entre el campo y el botón de entrar:
          // quien navega con teclado no necesita ver la contraseña, y aquí
          // estorbaría el camino al botón de envío.
          tabIndex={-1}
        >
          {visible ? <FiEyeOff aria-hidden="true" /> : <FiEye aria-hidden="true" />}
        </button>
      </div>
      {/* Región viva: al alternar, un lector de pantalla anuncia el cambio.
          Sin esto el estado cambia en silencio para quien no ve el icono. */}
      <span id={idAviso} className="pt-solo-lectores" role="status">
        {visible ? "Contraseña visible" : "Contraseña oculta"}
      </span>
    </div>
  );
}
