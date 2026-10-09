/**
 * UNA ACCIÓN A LA VEZ (revisión 9-oct-2026). La guarda `if (enviando) return`
 * lee el estado del render: dos toques en el mismo cuadro pasaban los dos y,
 * p. ej., se creaban dos recolecciones. Este candado vive fuera del render
 * (en un `useRef`). Si ya hay una corriendo, devuelve `null` sin correr nada.
 */
export function crearCandado() {
  let ocupado = false;
  return async (hacer) => {
    if (ocupado) return null;
    ocupado = true;
    try {
      return await hacer();
    } finally {
      ocupado = false;
    }
  };
}
