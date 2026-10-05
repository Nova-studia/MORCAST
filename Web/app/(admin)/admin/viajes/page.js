"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Scales,
  Plus,
  X,
  Receipt,
  WarningCircle,
  PencilSimple,
  Trash,
  Lock,
  FileText,
  Truck,
} from "@phosphor-icons/react/dist/ssr";
import {
  listarViajes,
  listarUnidadesViaje,
  listarChoferesViaje,
  recoleccionesParaViaje,
  subirTicket,
  enlaceTicket,
  nombreUnidad,
  guardarViajeDemo,
} from "@/lib/datos-viajes";
import {
  leerKg,
  cuadreDeViaje,
  candidatasParaViaje,
  textoPeso,
  textoKg,
  textoDiferencia,
} from "@/lib/peso.mjs";
import { guardarViaje, fijarFotoTicket, borrarViaje } from "@/app/acciones-peso";
import { obtenerSesionAdmin } from "@/lib/admin-sesion";
import { haySupabaseNavegador } from "@/lib/supabase-navegador";
import { fechaConDia, fechaLarga } from "@/lib/portal-datos";
import { hoyISO } from "@/lib/vencimiento";
import EnPortal from "./EnPortal";

/**
 * PESO REAL (RELLENO) — pedido 11 de los dueños.
 *
 * El relleno sanitario pesa el CAMIÓN completo, una vez por viaje. Aquí se
 * captura ese ticket y se dice qué recolecciones iban en el camión. Desde
 * ese momento los reportes cuentan el peso del ticket en vez de los
 * estimados del chofer (lib/peso.mjs explica por qué sin contar doble).
 */

const esPdf = (ruta) => String(ruta || "").toLowerCase().endsWith(".pdf");

/** Lo que tiene el formulario al abrirlo vacío. */
function formularioNuevo() {
  return {
    id: null,
    fecha: hoyISO(),
    unidadId: "",
    operadorId: "",
    peso: "",
    folio: "",
    notas: "",
    archivo: null,
    fotoTicket: null,
    elegidas: [],
    filtroChofer: "",
    filtroRuta: "",
    filtroUnidad: "",
  };
}

export default function ViajesAdmin() {
  const [viajes, setViajes] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [choferes, setChoferes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [yo, setYo] = useState(null);
  const [aviso, setAviso] = useState(null); // { tipo: "ok" | "error", texto }

  const [form, setForm] = useState(null);
  const [candidatas, setCandidatas] = useState([]);
  const [cargandoCand, setCargandoCand] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState("");
  const [confirmarBorrar, setConfirmarBorrar] = useState(false);

  const [ticket, setTicket] = useState(null); // { viaje, url }

  const recargar = () =>
    listarViajes().then((v) => {
      setViajes(v);
      setCargando(false);
    });

  useEffect(() => {
    let vivo = true;
    Promise.all([listarViajes(), listarUnidadesViaje(), listarChoferesViaje(), obtenerSesionAdmin()]).then(
      ([v, u, c, s]) => {
        if (!vivo) return;
        setViajes(v);
        setUnidades(u);
        setChoferes(c);
        setYo(s);
        setCargando(false);
      }
    );
    return () => { vivo = false; };
  }, []);

  // Las recolecciones de la fecha del viaje. Se vuelven a pedir al cambiar la
  // fecha: el camión va al relleno el mismo día que recoge.
  const fechaForm = form?.fecha;
  const idForm = form?.id;
  useEffect(() => {
    let vivo = true;
    if (!fechaForm) return () => { vivo = false; };
    setCargandoCand(true);
    recoleccionesParaViaje(fechaForm, idForm).then((r) => {
      if (!vivo) return;
      setCandidatas(r);
      setCargandoCand(false);
    });
    return () => { vivo = false; };
  }, [fechaForm, idForm]);

  // Quién puede registrar: dueño y administradores. Esto solo pinta los
  // botones; la regla de verdad la ponen `acciones-peso.js` y el RLS.
  const puedeEditar = haySupabaseNavegador() ? ["dueno", "admin"].includes(yo?.rolId) : true;

  // Cualquier cambio en el formulario borra el error: si no, "el peso tiene
  // que ser mayor que cero" se quedaba en pantalla con el peso ya corregido.
  const set = (patch) => {
    setErrorForm("");
    setForm((f) => ({ ...f, ...patch }));
  };

  const abrirNuevo = () => {
    setErrorForm("");
    setConfirmarBorrar(false);
    setForm(formularioNuevo());
  };
  const abrirEditar = (v) => {
    setErrorForm("");
    setConfirmarBorrar(false);
    setForm({
      ...formularioNuevo(),
      id: v.id,
      fecha: v.fecha,
      unidadId: v.unidadId || "",
      operadorId: v.operadorId || "",
      peso: String(v.pesoRealKg ?? ""),
      folio: v.folioTicket || "",
      notas: v.notas || "",
      fotoTicket: v.fotoTicket,
      elegidas: v.recolecciones.map((r) => r.id),
    });
  };

  /* ------------------------- Lista y totales ------------------------- */

  const filas = useMemo(
    () => viajes.map((v) => ({ ...v, cuadre: cuadreDeViaje(v, v.recolecciones) })),
    [viajes]
  );
  const totalReal = filas.reduce((t, v) => t + (v.pesoRealKg || 0), 0);
  // La diferencia global solo con los viajes que tienen recolecciones con
  // estimado: uno sin recolecciones no tiene contra qué compararse.
  const comparables = filas.filter((v) => v.cuadre.diferenciaKg !== null);
  const difTotal = comparables.reduce((t, v) => t + v.cuadre.diferenciaKg, 0);
  const estTotal = comparables.reduce((t, v) => t + v.cuadre.estimadoKg, 0);
  const sinRecolecciones = filas.filter((v) => v.recolecciones.length === 0).length;

  /* ------------------------- Formulario ------------------------------ */

  const { libres, enOtroViaje } = useMemo(
    () =>
      form
        ? candidatasParaViaje(candidatas, {
            fecha: form.fecha,
            choferId: form.filtroChofer,
            rutaClave: form.filtroRuta,
            unidadId: form.filtroUnidad,
            viajeId: form.id,
          })
        : { libres: [], enOtroViaje: [] },
    [form, candidatas]
  );
  // Las elegidas se ven SIEMPRE, aunque el filtro las esconda o sean de otro
  // día: algo que va a guardarse no puede estar fuera de la vista.
  const visibles = useMemo(() => {
    if (!form) return [];
    const ids = new Set(libres.map((r) => r.id));
    const extra = candidatas.filter((r) => form.elegidas.includes(r.id) && !ids.has(r.id));
    return [...extra, ...libres];
  }, [form, libres, candidatas]);
  const rutasDelDia = useMemo(() => {
    const m = new Map();
    for (const r of candidatas) if (r.rutaClave && r.fecha === form?.fecha) m.set(r.rutaClave, r.rutaNombre);
    return [...m];
  }, [candidatas, form?.fecha]);

  const elegidasObj = candidatas.filter((r) => form?.elegidas.includes(r.id));
  const pesoForm = form ? leerKg(form.peso) : {};
  const cuadreForm = cuadreDeViaje({ pesoRealKg: pesoForm.kg || 0 }, elegidasObj);

  const alternar = (id) =>
    set({ elegidas: form.elegidas.includes(id) ? form.elegidas.filter((x) => x !== id) : [...form.elegidas, id] });
  const elegirVisibles = () => set({ elegidas: [...new Set([...form.elegidas, ...libres.map((r) => r.id)])] });

  const guardar = async () => {
    setErrorForm("");
    if (!form.fecha) return setErrorForm("Falta la fecha del viaje.");
    if (pesoForm.error) return setErrorForm(pesoForm.error);

    setGuardando(true);
    const datos = {
      id: form.id,
      fecha: form.fecha,
      unidadId: form.unidadId || null,
      operadorId: form.operadorId || null,
      pesoRealKg: form.peso,
      folioTicket: form.folio,
      notas: form.notas,
      recoleccionIds: form.elegidas,
    };
    const r = await guardarViaje(datos);
    if (!r.ok) {
      setGuardando(false);
      return setErrorForm(r.motivo || "No se pudo guardar. Intenta de nuevo.");
    }

    if (r.demo) {
      // Sin base: se guarda en la demo de esta pestaña.
      const id = form.id || `v-demo-${Date.now()}`;
      const u = unidades.find((x) => x.id === form.unidadId);
      guardarViajeDemo(
        {
          id,
          fecha: form.fecha,
          unidadId: form.unidadId || null,
          unidad: nombreUnidad(u),
          operadorId: form.operadorId || null,
          chofer: choferes.find((c) => c.id === form.operadorId)?.nombre || "",
          pesoRealKg: pesoForm.kg,
          folioTicket: form.folio.trim(),
          fotoTicket: form.fotoTicket,
          notas: form.notas.trim(),
        },
        form.elegidas
      );
      await recargar();
      setGuardando(false);
      setForm(null);
      setAviso({
        tipo: "ok",
        texto: form.archivo
          ? "Viaje guardado (demostración). En modo demostración la foto del ticket no se sube."
          : "Viaje guardado (demostración).",
      });
      return;
    }

    // La foto va DESPUÉS, porque su carpeta es el id del viaje, que en un
    // alta apenas acaba de nacer.
    const avisos = r.aviso ? [r.aviso] : [];
    if (form.archivo) {
      const sub = await subirTicket(r.id, form.archivo);
      if (!sub.ok) avisos.push(`la foto del ticket no se subió (${sub.motivo})`);
      else {
        const fij = await fijarFotoTicket(r.id, sub.ruta);
        if (!fij.ok) avisos.push(`la foto se subió pero no quedó amarrada al viaje (${fij.motivo})`);
      }
    }

    await recargar();
    setGuardando(false);
    setForm(null);
    setAviso(
      avisos.length
        ? { tipo: "error", texto: `Ojo: ${avisos.join("; ")}` }
        : { tipo: "ok", texto: form.id ? "Viaje actualizado." : "Viaje registrado. Los reportes ya cuentan su peso real." }
    );
  };

  const borrar = async () => {
    setGuardando(true);
    const r = await borrarViaje(form.id);
    if (!r.ok) {
      setGuardando(false);
      return setErrorForm(r.motivo || "No se pudo borrar.");
    }
    if (r.demo) guardarViajeDemo({ id: form.id, borrar: true }, []);
    await recargar();
    setGuardando(false);
    setForm(null);
    setAviso({ tipo: "ok", texto: "Viaje borrado. Sus recolecciones vuelven a contar con su propio peso." });
  };

  const verTicket = async (v) => {
    setTicket({ viaje: v, url: "cargando" });
    const url = await enlaceTicket(v.fotoTicket);
    setTicket({ viaje: v, url: url || null });
  };

  /* ------------------------- Pantalla -------------------------------- */

  return (
    <>
      <div className="pt-page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1>Peso real (relleno)</h1>
          <p>
            El peso que anota el chofer es un estimado. Aquí se registra el del ticket de
            báscula del relleno, que pesa el camión completo por viaje, y qué recolecciones
            iban en él.
          </p>
        </div>
        {puedeEditar && (
          <button type="button" className="pt-btn pt-btn-verde" onClick={abrirNuevo}>
            <Plus /> Registrar viaje
          </button>
        )}
      </div>

      {aviso && (
        <div
          className={aviso.tipo === "error" ? "pt-login-error" : "pt-card"}
          role={aviso.tipo === "error" ? "alert" : "status"}
          style={{ marginBottom: "1rem", display: "flex", gap: "0.6rem", alignItems: "flex-start", justifyContent: "space-between", fontSize: "0.88rem" }}
        >
          <span>{aviso.texto}</span>
          <button type="button" className="pt-btn" onClick={() => setAviso(null)} aria-label="Cerrar aviso"><X /></button>
        </div>
      )}

      {!puedeEditar && !cargando && (
        <p className="pt-nota-demo" style={{ marginBottom: "1rem" }}>
          <Lock /> Tu cuenta puede consultar los viajes, pero registrar el peso real lo hacen el dueño y los administradores.
        </p>
      )}

      <div className="pt-grid pt-grid-3" style={{ marginBottom: "1.1rem" }}>
        <div className="pt-stat">
          <div className="pt-stat-icono"><Truck /></div>
          <div className="pt-stat-etiqueta">Viajes registrados</div>
          <div className="pt-stat-valor">{filas.length}</div>
          <div className="pt-stat-sub">
            {sinRecolecciones
              ? `${sinRecolecciones} sin recolecciones amarradas`
              : "Todos con sus recolecciones"}
          </div>
        </div>
        <div className="pt-stat">
          <div className="pt-stat-icono teal"><Scales /></div>
          <div className="pt-stat-etiqueta">Peso real (báscula)</div>
          <div className="pt-stat-valor">{textoPeso(totalReal)}</div>
          <div className="pt-stat-sub">Suma de los tickets de la lista</div>
        </div>
        <div className="pt-stat">
          <div className="pt-stat-icono naranja"><Receipt /></div>
          <div className="pt-stat-etiqueta">Real contra estimado</div>
          <div className="pt-stat-valor">{comparables.length ? textoDiferencia(difTotal) : "—"}</div>
          <div className="pt-stat-sub">
            {comparables.length && estTotal > 0
              ? `El chofer estimó ${textoPeso(estTotal)} (${difTotal >= 0 ? "+" : "−"}${Math.abs(Math.round((difTotal / estTotal) * 100))}%)`
              : "Sin viajes con estimados para comparar"}
          </div>
        </div>
      </div>

      <div className="pt-card">
        <div className="pt-card-head"><h2>Viajes al relleno</h2></div>
        {cargando ? (
          <div className="pt-vacio">Cargando viajes…</div>
        ) : filas.length === 0 ? (
          <div className="pt-vacio">
            Todavía no hay viajes registrados. Cuando llegue el primer ticket del relleno,
            regístralo con “Registrar viaje”.
          </div>
        ) : (
          <div className="pt-tabla-wrap">
            <table className="pt-tabla pt-tabla-compacta" style={{ minWidth: 860 }}>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Unidad</th>
                  <th>Chofer</th>
                  <th className="num">Peso real</th>
                  <th>Ticket</th>
                  <th className="num">Recolecciones</th>
                  <th className="num">Estimado</th>
                  <th className="num">Diferencia</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filas.map((v) => (
                  <tr key={v.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{fechaConDia(v.fecha)}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {v.unidadNumero ? (
                        <>
                          <strong>{v.unidadNumero}</strong>
                          {v.unidadPlacas && <div style={{ color: "var(--mc-gris)", fontSize: "0.76rem" }}>{v.unidadPlacas}</div>}
                        </>
                      ) : (
                        <span style={{ color: "var(--mc-gris)" }}>Sin unidad</span>
                      )}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>{v.chofer || <span style={{ color: "var(--mc-gris)" }}>—</span>}</td>
                    <td className="num">
                      <strong>{textoPeso(v.pesoRealKg)}</strong>
                      {v.pesoRealKg >= 1000 && (
                        <div style={{ color: "var(--mc-gris)", fontSize: "0.76rem" }}>{textoKg(v.pesoRealKg)}</div>
                      )}
                    </td>
                    <td>
                      <span className="folio">{v.folioTicket || "—"}</span>
                      {v.fotoTicket && (
                        <button type="button" className="pt-btn" style={{ marginLeft: 8, padding: "0.3rem 0.6rem" }} onClick={() => verTicket(v)}>
                          <Receipt /> Foto
                        </button>
                      )}
                    </td>
                    <td className="num">
                      {v.recolecciones.length ? (
                        v.recolecciones.length
                      ) : (
                        // Un viaje sin recolecciones no suma en los reportes
                        // (si sumara, contaría doble): hay que decirlo.
                        <span className="pt-badge mal" title="No cuenta en los reportes hasta que se le amarren sus recolecciones">
                          Sin amarrar
                        </span>
                      )}
                    </td>
                    <td className="num">
                      {v.cuadre.recolecciones ? textoPeso(v.cuadre.estimadoKg) : "—"}
                      {v.cuadre.sinEstimado > 0 && (
                        <div style={{ color: "var(--mc-alerta)", fontSize: "0.74rem" }}>
                          {v.cuadre.sinEstimado} sin peso del chofer
                        </div>
                      )}
                    </td>
                    <td className="num">
                      {textoDiferencia(v.cuadre.diferenciaKg)}
                      {v.cuadre.diferenciaPct !== null && (
                        <div style={{ color: "var(--mc-gris)", fontSize: "0.76rem" }}>
                          {v.cuadre.diferenciaPct > 0 ? "+" : v.cuadre.diferenciaPct < 0 ? "−" : ""}
                          {Math.abs(v.cuadre.diferenciaPct)}%
                        </div>
                      )}
                    </td>
                    <td>
                      {puedeEditar && (
                        <button type="button" className="pt-btn" onClick={() => abrirEditar(v)} aria-label={`Editar el viaje del ${fechaLarga(v.fecha)}`}>
                          <PencilSimple /> Editar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p style={{ fontSize: "0.8rem", color: "var(--mc-gris)", margin: "0.9rem 0 0" }}>
          Diferencia = peso real − suma de lo que estimó el chofer. Positiva quiere decir
          que el camión pesó más de lo estimado.
        </p>
      </div>

      {/* ------------------------- Alta / edición ------------------------- */}
      {form && (
        <EnPortal>
          <div className="pt-modal-fondo" onClick={() => !guardando && setForm(null)}>
            <div className="pt-modal" style={{ width: "min(860px, 100%)" }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={form.id ? "Editar viaje" : "Registrar viaje"}>
              <div className="pt-modal-head">
                <div>
                  <strong>{form.id ? "Editar viaje al relleno" : "Registrar viaje al relleno"}</strong>
                  <span>Los datos del ticket de báscula y las recolecciones que iban en el camión.</span>
                </div>
                <button type="button" className="pt-btn" onClick={() => setForm(null)} disabled={guardando} aria-label="Cerrar"><X /></button>
              </div>

              <div style={{ padding: "1.2rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0 1rem" }}>
                  <div className="pt-campo">
                    <label htmlFor="v-fecha">Fecha del viaje</label>
                    <input id="v-fecha" type="date" value={form.fecha} max={hoyISO()} onChange={(e) => set({ fecha: e.target.value })} />
                  </div>
                  <div className="pt-campo">
                    <label htmlFor="v-peso">Peso real del ticket (kg)</label>
                    <input
                      id="v-peso"
                      inputMode="decimal"
                      placeholder="Ej. 3480"
                      value={form.peso}
                      onChange={(e) => set({ peso: e.target.value })}
                      style={{ fontFamily: "var(--fuente-mono), 'JetBrains Mono', monospace" }}
                    />
                  </div>
                  <div className="pt-campo">
                    <label htmlFor="v-folio">Folio del ticket</label>
                    <input id="v-folio" placeholder="Ej. R-20931" value={form.folio} maxLength={60} onChange={(e) => set({ folio: e.target.value })} />
                  </div>
                  <div className="pt-campo">
                    <label htmlFor="v-unidad">Unidad</label>
                    <select id="v-unidad" className="pt-input" value={form.unidadId} onChange={(e) => set({ unidadId: e.target.value })}>
                      <option value="">Sin unidad</option>
                      {unidades.map((u) => (
                        <option key={u.id} value={u.id}>{nombreUnidad(u)}{u.estado === "taller" ? " (en taller)" : ""}</option>
                      ))}
                    </select>
                    {unidades.length === 0 && (
                      <p style={{ fontSize: "0.76rem", color: "var(--mc-alerta)", margin: "0.35rem 0 0" }}>
                        Aún no hay unidades en el inventario. Puedes registrar el viaje sin unidad
                        y ponérsela después.
                      </p>
                    )}
                  </div>
                  <div className="pt-campo">
                    <label htmlFor="v-chofer">Chofer</label>
                    <select id="v-chofer" className="pt-input" value={form.operadorId} onChange={(e) => set({ operadorId: e.target.value })}>
                      <option value="">Sin chofer</option>
                      {choferes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </div>
                  <div className="pt-campo">
                    <label htmlFor="v-foto">Foto del ticket</label>
                    <input
                      id="v-foto"
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => set({ archivo: e.target.files?.[0] || null })}
                      style={{ padding: "0.5rem" }}
                    />
                    {form.fotoTicket && !form.archivo && (
                      <p style={{ fontSize: "0.76rem", color: "var(--mc-gris)", margin: "0.35rem 0 0" }}>
                        Ya tiene foto. Si eliges otra, la anterior se queda guardada como respaldo.
                      </p>
                    )}
                  </div>
                </div>
                <div className="pt-campo">
                  <label htmlFor="v-notas">Notas</label>
                  <textarea
                    id="v-notas"
                    className="pt-input"
                    rows={2}
                    maxLength={1000}
                    value={form.notas}
                    onChange={(e) => set({ notas: e.target.value })}
                    placeholder="Opcional: algo raro en el ticket, si fue un segundo viaje del día…"
                  />
                </div>

                {/* ---------------- Recolecciones del viaje ---------------- */}
                <div style={{ borderTop: "1px solid var(--mc-linea)", paddingTop: "1rem", marginTop: "0.2rem" }}>
                  <strong style={{ display: "block", marginBottom: 4 }}>¿Qué recolecciones iban en este viaje?</strong>
                  <p style={{ fontSize: "0.82rem", color: "var(--mc-gris)", margin: "0 0 0.8rem" }}>
                    Las completadas del {fechaLarga(form.fecha)}. Al amarrarlas, los reportes cuentan
                    el peso del ticket una sola vez en lugar de sus estimados.
                  </p>

                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.7rem" }}>
                    <select className="pt-input" style={{ width: "auto", flex: "1 1 160px" }} value={form.filtroChofer} onChange={(e) => set({ filtroChofer: e.target.value })} aria-label="Filtrar por chofer">
                      <option value="">Todos los choferes</option>
                      {choferes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                    <select className="pt-input" style={{ width: "auto", flex: "1 1 160px" }} value={form.filtroRuta} onChange={(e) => set({ filtroRuta: e.target.value })} aria-label="Filtrar por ruta">
                      <option value="">Todas las rutas</option>
                      {rutasDelDia.map(([clave, nombre]) => <option key={clave} value={clave}>{nombre}</option>)}
                    </select>
                    <select className="pt-input" style={{ width: "auto", flex: "1 1 160px" }} value={form.filtroUnidad} onChange={(e) => set({ filtroUnidad: e.target.value })} aria-label="Filtrar por unidad">
                      <option value="">Todas las unidades</option>
                      {unidades.map((u) => <option key={u.id} value={u.id}>{nombreUnidad(u)}</option>)}
                    </select>
                  </div>

                  <div style={{ border: "1px solid var(--mc-linea)", borderRadius: 8, maxHeight: 280, overflowY: "auto" }}>
                    {cargandoCand ? (
                      <div className="pt-vacio" style={{ padding: "1.2rem" }}>Buscando recolecciones…</div>
                    ) : visibles.length === 0 ? (
                      <div className="pt-vacio" style={{ padding: "1.2rem" }}>
                        No hay recolecciones completadas ese día{form.filtroChofer || form.filtroRuta || form.filtroUnidad ? " con esos filtros" : ""}.
                      </div>
                    ) : (
                      visibles.map((r) => (
                        <label
                          key={r.id}
                          style={{ display: "flex", gap: "0.7rem", alignItems: "flex-start", padding: "0.6rem 0.8rem", borderBottom: "1px solid var(--mc-linea)", cursor: "pointer" }}
                        >
                          <input type="checkbox" checked={form.elegidas.includes(r.id)} onChange={() => alternar(r.id)} style={{ marginTop: 4 }} />
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: "block" }}>
                              <span className="folio" style={{ fontFamily: "var(--fuente-mono), 'JetBrains Mono', monospace", fontSize: "0.82rem" }}>{r.folio}</span>
                              {"  "}{r.cliente}
                            </span>
                            <span style={{ display: "block", fontSize: "0.78rem", color: "var(--mc-gris)" }}>
                              {[r.rutaNombre, r.chofer, r.fecha !== form.fecha ? fechaConDia(r.fecha) : null].filter(Boolean).join(" · ")}
                            </span>
                          </span>
                          <span style={{ whiteSpace: "nowrap", fontFamily: "var(--fuente-mono), 'JetBrains Mono', monospace", fontSize: "0.82rem", color: r.estimadoKg ? "var(--mc-tinta)" : "var(--mc-alerta)" }}>
                            {r.estimadoKg ? textoKg(r.estimadoKg) : "sin peso"}
                          </span>
                        </label>
                      ))
                    )}
                  </div>

                  {enOtroViaje.length > 0 && (
                    <p style={{ fontSize: "0.78rem", color: "var(--mc-gris)", margin: "0.5rem 0 0" }}>
                      {enOtroViaje.length === 1 ? "1 recolección de ese día ya va" : `${enOtroViaje.length} recolecciones de ese día ya van`} en
                      otro viaje ({enOtroViaje.map((r) => r.folio).join(", ")}).{" "}
                      {enOtroViaje.length === 1
                        ? "Para moverla aquí, primero quítala de aquel viaje."
                        : "Para mover alguna aquí, primero quítala del viaje en que va."}
                    </p>
                  )}

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.7rem", flexWrap: "wrap", marginTop: "0.7rem" }}>
                    <button type="button" className="pt-btn" onClick={elegirVisibles} disabled={!libres.length}>
                      Marcar todas las que se ven
                    </button>
                    <span style={{ fontSize: "0.84rem", color: "var(--mc-gris)" }}>
                      {form.elegidas.length} elegida{form.elegidas.length === 1 ? "" : "s"} · estimado{" "}
                      <strong style={{ color: "var(--mc-tinta)" }}>{textoPeso(cuadreForm.estimadoKg)}</strong>
                      {pesoForm.kg && cuadreForm.diferenciaKg !== null && (
                        <> · diferencia <strong style={{ color: "var(--mc-tinta)" }}>{textoDiferencia(cuadreForm.diferenciaKg)}</strong></>
                      )}
                    </span>
                  </div>
                  {form.elegidas.length === 0 && (
                    <p style={{ fontSize: "0.78rem", color: "var(--mc-alerta)", margin: "0.5rem 0 0" }}>
                      Sin recolecciones amarradas el viaje se guarda, pero no cuenta en los reportes.
                    </p>
                  )}
                </div>

                {errorForm && (
                  <div className="pt-login-error" role="alert" style={{ marginTop: "1rem" }}>
                    <WarningCircle style={{ marginRight: 6, verticalAlign: "-2px" }} />
                    {errorForm}
                  </div>
                )}

                <div style={{ display: "flex", gap: "0.5rem", justifyContent: "space-between", flexWrap: "wrap", marginTop: "1.1rem" }}>
                  <div>
                    {form.id && (confirmarBorrar ? (
                      <span style={{ display: "inline-flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "0.82rem", color: "var(--mc-error)" }}>¿Borrar el viaje?</span>
                        <button type="button" className="pt-btn" onClick={() => setConfirmarBorrar(false)} disabled={guardando}>No</button>
                        <button type="button" className="pt-btn" style={{ color: "var(--mc-error)", borderColor: "var(--mc-error)" }} onClick={borrar} disabled={guardando}>
                          Sí, borrar
                        </button>
                      </span>
                    ) : (
                      <button type="button" className="pt-btn" onClick={() => setConfirmarBorrar(true)} disabled={guardando}>
                        <Trash /> Borrar viaje
                      </button>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button type="button" className="pt-btn" onClick={() => setForm(null)} disabled={guardando}>Cancelar</button>
                    <button type="button" className="pt-btn pt-btn-verde" onClick={guardar} disabled={guardando}>
                      <Scales /> {guardando ? "Guardando…" : form.id ? "Guardar cambios" : "Registrar viaje"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </EnPortal>
      )}

      {/* ------------------------- Foto del ticket ------------------------ */}
      {ticket && (
        <EnPortal>
          <div className="pt-modal-fondo" onClick={() => setTicket(null)}>
            <div className="pt-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Foto del ticket">
              <div className="pt-modal-head">
                <div>
                  <strong>Ticket {ticket.viaje.folioTicket || "sin folio"}</strong>
                  <span>{fechaLarga(ticket.viaje.fecha)} · {textoPeso(ticket.viaje.pesoRealKg)}</span>
                </div>
                <button type="button" className="pt-btn" onClick={() => setTicket(null)} aria-label="Cerrar"><X /></button>
              </div>
              <div style={{ padding: "1.2rem" }}>
                <div className="pt-modal-comprobante">
                  {/* La cubeta es privada: se pide un enlace firmado que caduca. */}
                  {ticket.url === "cargando" ? (
                    <div className="pt-modal-sinimg"><FileText /><span>Abriendo el ticket…</span></div>
                  ) : ticket.url ? (
                    esPdf(ticket.viaje.fotoTicket) ? (
                      <a href={ticket.url} target="_blank" rel="noopener noreferrer" className="pt-btn"><FileText /> Abrir el PDF del ticket</a>
                    ) : (
                      <a href={ticket.url} target="_blank" rel="noopener noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={ticket.url} alt={`Ticket de báscula ${ticket.viaje.folioTicket || ""}`} />
                      </a>
                    )
                  ) : (
                    <div className="pt-modal-sinimg"><WarningCircle /><span>No se pudo abrir la foto del ticket.</span></div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </EnPortal>
      )}
    </>
  );
}
