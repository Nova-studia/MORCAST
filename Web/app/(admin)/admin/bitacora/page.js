import { listarBitacoraDia, textoDeAccion, TEXTO_ACCION } from "@/lib/bitacora";
import { diaEnMatamoros, diaPedido, nombreDelDia, rangoDelDia, resumenBitacora } from "@/lib/bitacora-vista.mjs";
import SelectorDia from "./SelectorDia";

export const metadata = { title: "Bitácora · Morcast" };

// Se lee en el servidor con la sesión del usuario: el RLS deja entrar solo al
// personal. Si un cliente llegara aquí escribiendo la dirección, la consulta
// le devuelve cero filas — no hace falta un candado extra en el código.
export const dynamic = "force-dynamic";

/** La hora (y nada más: el día ya está arriba), en la hora de Matamoros. */
function hora(iso) {
  return new Date(iso).toLocaleTimeString("es-MX", {
    hour: "2-digit", minute: "2-digit", timeZone: "America/Matamoros",
  });
}

/**
 * POR DÍA (pedido de Luis, 6-oct-2026): al abrir se ve solo lo de HOY en
 * Matamoros; `?dia=AAAA-MM-DD` lleva a otro y `?accion=` filtra dentro del
 * día. El día se vuelve rango de instantes en lib/bitacora-vista.mjs y la
 * consulta filtra en la base, no aquí.
 */
export default async function Bitacora({ searchParams }) {
  const p = await searchParams;
  const hoy = diaEnMatamoros();
  const dia = diaPedido(typeof p?.dia === "string" ? p.dia : "", hoy);
  const accion = typeof p?.accion === "string" && TEXTO_ACCION[p.accion] ? p.accion : "";
  const rango = rangoDelDia(dia);
  const { filas, total, error } = await listarBitacoraDia({ ...rango, accion, limite: 300 });

  const opciones = Object.keys(TEXTO_ACCION).map((id) => ({ id, texto: textoDeAccion({ accion: id }) }));
  const nombre = nombreDelDia(dia, hoy);

  return (
    <>
      <div className="pt-page-head">
        <h1>Bitácora</h1>
        <p>
          Quién hizo qué y cuándo. Se guarda sola y no se puede editar desde el
          panel: es la respuesta cuando algo no cuadra.
        </p>
      </div>

      <SelectorDia dia={dia} hoy={hoy} accion={accion} opciones={opciones} />

      <div className="pt-card">
        <div className="pt-card-head">
          <h2>
            {nombre}{nombre === "Hoy" || nombre === "Ayer" ? ` · ${nombreDelDia(dia, "")}` : ""} ({total}
            {total === 1 ? " movimiento" : " movimientos"})
          </h2>
        </div>

        {error ? (
          <div className="pt-vacio">No se pudo leer la bitácora. Recarga la página.</div>
        ) : filas.length === 0 ? (
          <div className="pt-vacio">
            Sin movimientos este día{accion ? " con esa acción" : ""}.
          </div>
        ) : (
          <div className="pt-tabla-wrap">
            <table className="pt-tabla" style={{ minWidth: 760 }}>
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Quién</th>
                  <th>Qué hizo</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{hora(f.creado)}</td>
                    <td>{f.actor_correo || "—"}</td>
                    <td>{textoDeAccion(f)}</td>
                    <td>{resumenBitacora(f)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {total > filas.length && (
              <p style={{ fontSize: "0.82rem", color: "var(--mc-gris)", margin: "0.6rem 0 0" }}>
                Se enseñan los {filas.length} más recientes de {total}. Filtra por acción para ver los demás.
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
