import { WarningCircle } from "@phosphor-icons/react/dist/ssr";

/**
 * "No se pudo cargar" con Reintentar (Entrega 4, 9-oct-2026). Antes un
 * error de red se veía como una lista vacía ("Todavía no tienes…") y el
 * cliente creía que no tenía nada.
 */
export default function ErrorCarga({ mensaje, onReintentar }) {
  return (
    <div className="pt-login-error" role="alert" style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap", marginBottom: "1rem" }}>
      <WarningCircle aria-hidden="true" />
      <span style={{ flex: "1 1 200px" }}>{mensaje || "No se pudo cargar. Revisa tu conexión."}</span>
      {onReintentar && (
        <button type="button" className="pt-btn" onClick={onReintentar}>Reintentar</button>
      )}
    </div>
  );
}
