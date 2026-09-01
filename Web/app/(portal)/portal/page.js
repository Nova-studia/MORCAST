"use client";

import IconoAnimado from "@/components/IconoAnimado";

import { useEffect, useState } from "react";

import Link from "next/link";
import {
  Truck,
  CurrencyDollar,
  CalendarBlank,
  ArrowRight,
  Clock,
  PlusCircle,
} from "@phosphor-icons/react/dist/ssr";
import {
  CLIENTE,
  CUENTA,
  MOVIMIENTOS,
  SERVICIOS_CLIENTE,
  COMPOSICION_RESIDUOS,
  pesos,
  fechaLarga,
  estatusInfo,
} from "@/lib/portal-datos";
import { resumenCliente } from "@/lib/datos-panel";
import { listarSolicitudes, misServicios } from "@/lib/datos-solicitudes";
import { haySupabaseNavegador } from "@/lib/supabase-navegador";
import { enHold } from "@/lib/estado-sistema";

/** Estados que el cliente ve como "todavía va a pasar". */
const PENDIENTES = ["solicitada", "confirmada", "en-ruta"];

const COLORES = ["#4EB34A", "#2DA529", "#144C4F", "#DB652D", "#7a8f8c"];

export default function PanelPortal() {
  const [resumen, setResumen] = useState(null);
  const [solicitudes, setSolicitudes] = useState(null);
  const [servicios, setServicios] = useState(null);
  const [cargando, setCargando] = useState(true);

  // Sin variables de Supabase el sitio sigue navegable con el cliente de
  // ejemplo. Con ellas, TODO lo de esta pantalla sale de la base.
  const real = haySupabaseNavegador();

  // `allSettled`, no `all`: si UNA de las tres consultas falla —una racha de
  // red, un token que se está renovando— con `all` no se cumple ninguna, el
  // estado se queda en null y la pantalla se caía al cliente de EJEMPLO. Se
  // vio en vivo: un cliente recién entrado veía "$18,450 de saldo" y una
  // línea de crédito de $60,000 que eran de otra empresa.
  useEffect(() => {
    let vivo = true;
    Promise.allSettled([resumenCliente(), listarSolicitudes(), misServicios({ conFotos: false })]).then(
      ([r, s, sv]) => {
        if (!vivo) return;
        if (r.status === "fulfilled") setResumen(r.value);
        if (s.status === "fulfilled") setSolicitudes(s.value);
        if (sv.status === "fulfilled") setServicios(sv.value);
        setCargando(false);

        // El resumen es el que trae el saldo y el nombre de la empresa. Si
        // justo esa falló —pasa en la primerísima carga después de entrar,
        // mientras el token se acomoda— se reintenta una vez. Sin esto la
        // pantalla se queda diciendo "tu empresa" hasta que el cliente
        // recarga a mano.
        if (r.status !== "fulfilled") {
          setTimeout(() => {
            if (!vivo) return;
            resumenCliente().then((r2) => { if (vivo && r2) setResumen(r2); }).catch(() => {});
          }, 900);
        }
      }
    );
    return () => { vivo = false; };
  }, []);

  // Con Supabase configurado NUNCA se enseña la cuenta de ejemplo: mientras
  // no llegue la de verdad se enseña en ceros. Un cero de más se entiende;
  // el saldo de otra empresa, no.
  const CUENTA_VACIA = { saldoActual: 0, porPagar: 0, porVerificar: 0, limiteCredito: 0, diasCredito: 0 };
  const cuenta = real ? (resumen?.cuenta ?? CUENTA_VACIA) : CUENTA;
  const movimientos = real ? (resumen?.movimientos ?? []) : MOVIMIENTOS;

  const empresa = real ? (resumen?.empresa || "tu empresa") : CLIENTE.empresa;
  const contacto = real ? (resumen?.contacto || "") : CLIENTE.contacto;
  const saludo = contacto ? contacto.split(" ").slice(-1)[0] : "qué tal";

  const completados = real ? (servicios ?? []) : SERVICIOS_CLIENTE.filter((s) => s.estatus === "completado");
  const proximos = real
    ? (solicitudes ?? [])
        .filter((s) => PENDIENTES.includes(s.estado))
        .map((s) => ({
          folio: s.folio,
          fecha: s.fechaConfirmada || s.fechaPedida,
          tipo: s.rutaNombre,
          unidad: s.unidad,
          estatus: s.estado,
        }))
    : SERVICIOS_CLIENTE.filter((s) => s.estatus !== "completado");
  const recientes = completados.slice(0, 4);
  const usoCredito = cuenta.limiteCredito
    ? Math.min(100, Math.round((cuenta.porPagar / cuenta.limiteCredito) * 100))
    : 0;

  /**
   * Composición: se arma con el PESO real que registró el chofer, agrupado
   * por tipo de servicio. La base no guarda "qué residuo era" — eso lo daría
   * el manifiesto — así que se enseña lo que de verdad hay medido, en vez de
   * unos porcentajes de adorno.
   */
  const composicion = real
    ? (() => {
        const porTipo = {};
        let total = 0;
        for (const s of completados) {
          const kg = Number(String(s.peso).replace(/[^\d.]/g, "")) || 0;
          if (!kg) continue;
          porTipo[s.tipo] = (porTipo[s.tipo] || 0) + kg;
          total += kg;
        }
        if (!total) return [];
        return Object.entries(porTipo)
          .sort((a, b) => b[1] - a[1])
          .map(([tipo, kg], i) => ({
            tipo,
            porcentaje: Math.round((kg / total) * 100),
            color: COLORES[i % COLORES.length],
          }));
      })()
    : COMPOSICION_RESIDUOS;

  // Dona: acumula porcentajes para el conic-gradient
  let acumulado = 0;
  const tramos = composicion.map((c) => {
    const desde = acumulado;
    acumulado += c.porcentaje;
    return `${c.color} ${desde}% ${acumulado}%`;
  }).join(", ");

  return (
    <>
      <div className="pt-page-head">
        <h1>{cargando && real ? "Hola 👋" : `Hola, ${saludo} 👋`}</h1>
        <p>{cargando && real ? "Cargando el resumen de tu cuenta…" : `Resumen de la cuenta de ${empresa}.`}</p>
      </div>

      {/* Saldo + KPIs */}
      {/* ⚠️ Las proporciones van en CSS (`.pt-panel-resumen`), NO en un
          `style` en linea. El estilo en linea LE GANA A LA MEDIA QUERY, asi
          que con `gridTemplateColumns` aqui las tarjetas se quedaban en dos
          columnas en el telefono y se cortaban a media palabra. Es la CUARTA
          vez que este repo tropieza con lo mismo. */}
      <div className="pt-grid pt-panel-resumen">
        <div className="pt-saldo">
          <div className="pt-saldo-etiqueta">Saldo a favor / crédito disponible</div>
          <div className="pt-saldo-monto">{enHold() ? "—" : pesos(cuenta.saldoActual)}</div>
          {/* La barra de uso de crédito es un porcentaje de dos cifras que
              todavía no existen: en Hold no hay nada que medir, así que se
              quita en vez de enseñar una barra llena o vacía sin sentido. */}
          {!enHold() && (
            <div className="pt-saldo-barra">
              <span style={{ width: `${100 - usoCredito}%` }} />
            </div>
          )}
          <div className="pt-saldo-fila">
            {enHold() ? (
              <span>Sin cobros todavía</span>
            ) : (
              <>
                <span>Línea de crédito {pesos(cuenta.limiteCredito)}</span>
                <span>{cuenta.diasCredito} días</span>
              </>
            )}
          </div>
          <Link href="/portal/agregar-saldo" prefetch={false} className="mc-btn mc-btn-verde" style={{ marginTop: "1rem", width: "100%", justifyContent: "center", padding: "0.6rem" }}>
            <PlusCircle /> Agregar saldo
          </Link>
        </div>

        <div className="pt-grid pt-panel-kpis">
          <div className="pt-stat">
            <div className="pt-stat-icono desnudo"><IconoAnimado nombre="por-pagar" tam={44} /></div>
            <div className="pt-stat-etiqueta">Por pagar</div>
            <div className="pt-stat-valor">{enHold() ? "—" : pesos(cuenta.porPagar)}</div>
            <div className="pt-stat-sub">
              {enHold()
                ? "Sin cobros todavía"
                : real
                  ? (cuenta.diasCredito ? `Crédito a ${cuenta.diasCredito} días` : "Pago de contado")
                  : `Corte: ${fechaLarga(CUENTA.proximoCorte)}`}
            </div>
          </div>
          <div className="pt-stat">
            <div className="pt-stat-icono desnudo"><IconoAnimado nombre="servicios" tam={44} /></div>
            <div className="pt-stat-etiqueta">Servicios</div>
            <div className="pt-stat-valor">{completados.length}</div>
            <div className="pt-stat-sub">Completados (12 meses)</div>
          </div>
          <div className="pt-stat">
            <div className="pt-stat-icono desnudo"><IconoAnimado nombre="programados" tam={44} /></div>
            <div className="pt-stat-etiqueta">Programados</div>
            <div className="pt-stat-valor">{proximos.length}</div>
            <div className="pt-stat-sub">Próximos servicios</div>
          </div>
        </div>
      </div>

      {/* Próximos servicios + composición */}
      <div className="pt-grid pt-grid-2" style={{ marginBottom: "1.1rem", "--pt-cols": "2fr 1.3fr" }}>
        <div className="pt-card">
          <div className="pt-card-head">
            <h2>Próximos servicios</h2>
            <Link href="/portal/historial" prefetch={false} className="pt-btn">
              Ver historial <ArrowRight />
            </Link>
          </div>
          {proximos.length === 0 ? (
            <div className="pt-vacio">No hay servicios programados.</div>
          ) : (
            <div className="pt-tabla-wrap">
              <table className="pt-tabla" style={{ minWidth: 480 }}>
                <thead>
                  <tr>
                    <th>Folio</th>
                    <th>Fecha</th>
                    <th>Servicio</th>
                    <th>Unidad</th>
                    <th>Estatus</th>
                  </tr>
                </thead>
                <tbody>
                  {proximos.map((s) => {
                    const est = estatusInfo(s.estatus);
                    return (
                      <tr key={s.folio}>
                        <td className="folio">{s.folio}</td>
                        <td>{fechaLarga(s.fecha)}</td>
                        <td>{s.tipo}</td>
                        <td>{s.unidad}</td>
                        <td><span className={`pt-badge ${est.clase}`}>{est.texto}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="pt-card">
          <div className="pt-card-head">
            <h2>Composición de residuos</h2>
          </div>
          {composicion.length === 0 ? (
            <div className="pt-vacio">
              Aquí verás de qué se compone tu residuo en cuanto tengas
              recolecciones con peso registrado.
            </div>
          ) : (
            <div className="pt-donut-wrap">
              <div className="pt-donut" style={{ background: `conic-gradient(${tramos})` }}>
                <div className="pt-donut-centro">
                  <strong>100%</strong>
                  <span>12 meses</span>
                </div>
              </div>
              <div className="pt-leyenda">
                {composicion.map((c) => (
                  <div className="pt-leyenda-item" key={c.tipo}>
                    <span className="pt-leyenda-punto" style={{ background: c.color }} />
                    <span>{c.tipo}</span>
                    <span>{c.porcentaje}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Servicios recientes + movimientos */}
      <div className="pt-grid pt-grid-2" style={{ "--pt-cols": "1fr 1fr" }}>
        <div className="pt-card">
          <div className="pt-card-head">
            <h2>Últimos servicios</h2>
            <Link href="/portal/historial" prefetch={false} className="pt-btn">Todos <ArrowRight /></Link>
          </div>
          {recientes.length === 0 ? (
            <div className="pt-vacio">Todavía no tienes servicios completados.</div>
          ) : (
            recientes.map((s) => (
              <div key={s.folio} style={{ display: "flex", alignItems: "center", gap: "0.8rem", padding: "0.6rem 0", borderBottom: "1px solid var(--mc-linea)" }}>
                <div className="pt-stat-icono" style={{ margin: 0, width: 36, height: 36 }}><Clock /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ fontSize: "0.92rem" }}>{s.tipo}</strong>
                  <div style={{ color: "var(--mc-gris)", fontSize: "0.8rem" }}>
                    {fechaLarga(s.fecha)}
                    {s.peso && s.peso !== "—" ? ` · ${s.peso}` : s.volumen && s.volumen !== "—" ? ` · ${s.volumen}` : ""}
                  </div>
                </div>
                <span className="folio" style={{ fontSize: "0.8rem" }}>{s.folio}</span>
              </div>
            ))
          )}
        </div>

        <div className="pt-card">
          <div className="pt-card-head">
            <h2>Movimientos recientes</h2>
          </div>
          <div className="pt-tabla-wrap">
            <table className="pt-tabla" style={{ minWidth: 380 }}>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Concepto</th>
                  <th className="num">Monto</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="pt-vacio" style={{ textAlign: "center" }}>
                      Todavía no hay movimientos en tu cuenta.
                    </td>
                  </tr>
                ) : (
                  // La clave lleva el índice porque un movimiento puede no
                  // tener folio, y dos sin folio chocarían entre sí.
                  movimientos.slice(0, 5).map((m, i) => (
                    <tr key={m.folio || `mov-${i}`}>
                      <td style={{ whiteSpace: "nowrap" }}>{fechaLarga(m.fecha)}</td>
                      <td>{m.concepto}</td>
                      <td className="num">
                        <span className={`pt-mov ${m.tipo}`}>
                          {m.tipo === "abono" ? "+" : "−"}{pesos(m.monto)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
