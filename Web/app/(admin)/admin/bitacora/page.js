import { listarBitacora, TEXTO_ACCION } from "@/lib/bitacora";

export const metadata = { title: "Bitácora · Morcast" };

// Se lee en el servidor con la sesión del usuario: el RLS deja entrar solo al
// personal. Si un cliente llegara aquí escribiendo la dirección, la consulta
// le devuelve cero filas — no hace falta un candado extra en el código.
export const dynamic = "force-dynamic";

function cuando(iso) {
  const d = new Date(iso);
  return d.toLocaleString("es-MX", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/** Lo que hace falta saber de un movimiento, sin volcarle el JSON encima. */
function resumen(fila) {
  const d = fila.detalle || {};
  const partes = [];
  if (d.folio) partes.push(d.folio);
  if (d.monto != null) {
    partes.push(
      new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(d.monto)
    );
  }
  if (d.nombre) partes.push(d.nombre);
  if (d.rol_nuevo) partes.push(`rol: ${d.rol_nuevo}`);
  if (d.estado) partes.push(d.estado);
  if (d.notas) partes.push(`«${d.notas}»`);
  return partes.join(" · ") || "—";
}

export default async function Bitacora() {
  const filas = await listarBitacora({ limite: 300 });

  return (
    <>
      <div className="pt-page-head">
        <h1>Bitácora</h1>
        <p>
          Quién hizo qué y cuándo. Se guarda sola y no se puede editar desde el
          panel: es la respuesta cuando algo no cuadra.
        </p>
      </div>

      <div className="pt-card">
        <div className="pt-card-head">
          <h2>Últimos movimientos ({filas.length})</h2>
        </div>

        {filas.length === 0 ? (
          <div className="pt-vacio">
            Todavía no hay movimientos registrados. Aquí van a aparecer las
            aplicaciones de saldo, las confirmaciones de recolección y los
            cambios de rol.
          </div>
        ) : (
          <div className="pt-tabla-wrap">
            <table className="pt-tabla" style={{ minWidth: 760 }}>
              <thead>
                <tr>
                  <th>Cuándo</th>
                  <th>Quién</th>
                  <th>Qué hizo</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{cuando(f.creado)}</td>
                    <td>{f.actor_correo || "—"}</td>
                    <td>{TEXTO_ACCION[f.accion] || f.accion}</td>
                    <td>{resumen(f)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
