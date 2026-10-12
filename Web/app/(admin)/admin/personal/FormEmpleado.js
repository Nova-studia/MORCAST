"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Image as IconoImagen } from "@phosphor-icons/react/dist/ssr";
import { TIPOS_EMPLEADO, TIPOS_SANGRE } from "@/lib/personal.mjs";
import { prepararFoto } from "@/lib/foto-gafete";
import { guardarEmpleado } from "./acciones";
import { Foto } from "./piezas";
import s from "./personal.module.css";

/**
 * El formulario de un empleado: alta (sin `empleado`) o edición.
 *
 * La foto se recorta y se achica en el navegador antes de subirla
 * (lib/foto-gafete.js). Se toma con la cámara del sistema (`<input
 * capture>`) o se escoge de los archivos: la web tiene prohibida la cámara
 * en vivo (Permissions-Policy en next.config.mjs).
 *
 * `jefes` son los administrativos activos a quien puede reportar.
 */

const VACIO = {
  numero: "", nombre: "", apellido_paterno: "", apellido_materno: "", puesto: "", area: "", tipo: "general",
  reporta_a: "", tipo_sangre: "", alergias: "", contacto_emergencia: "", telefono_emergencia: "", permiso_emergencia: false,
};

const CAMPOS = Object.keys(VACIO);

export default function FormEmpleado({ empleado = null, jefes = [], alGuardar, alCancelar }) {
  const [f, setF] = useState(() => {
    const inicial = { ...VACIO };
    for (const campo of CAMPOS) if (empleado?.[campo] != null) inicial[campo] = empleado[campo];
    return inicial;
  });
  const [foto, setFoto] = useState(null); // { archivo, vista }
  const [errores, setErrores] = useState({});
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const camara = useRef(null);
  const archivo = useRef(null);
  const esAlta = !empleado?.id;

  // La vista previa es una dirección `blob:` que hay que soltar al cambiarla.
  useEffect(() => () => { if (foto?.vista) URL.revokeObjectURL(foto.vista); }, [foto]);

  const cambia = (campo) => (e) => setF({ ...f, [campo]: e.target.value });

  const escogerFoto = async (elegido) => {
    if (!elegido) return;
    setAviso("");
    try {
      const lista = await prepararFoto(elegido, elegido.name || "foto.jpg");
      setFoto({ archivo: lista, vista: URL.createObjectURL(lista) });
      setErrores((e) => ({ ...e, foto: undefined }));
    } catch {
      setErrores((e) => ({ ...e, foto: "No se pudo leer esa imagen. Prueba con una foto JPG o PNG." }));
    }
  };

  const enviar = async (evento) => {
    evento.preventDefault();
    setOcupado(true);
    setAviso("");
    const datos = new FormData();
    if (empleado?.id) datos.set("id", empleado.id);
    for (const campo of CAMPOS) datos.set(campo, campo === "permiso_emergencia" ? (f[campo] ? "si" : "no") : f[campo] ?? "");
    if (foto) datos.set("foto", foto.archivo);
    let r;
    try {
      r = await guardarEmpleado(datos);
    } catch {
      r = { ok: false, motivo: "No se pudo guardar. Revisa tu conexión e inténtalo de nuevo." };
    }
    setOcupado(false);
    if (!r.ok) {
      setErrores(r.errores || {});
      setAviso(r.motivo);
      return;
    }
    setErrores({});
    setFoto(null);
    alGuardar?.(r);
  };

  // Se llama como función y no como <Componente>: definido aquí adentro,
  // React lo vería como un componente NUEVO en cada render y desmontaría el
  // campo con cada letra (se pierde el foco al teclear).
  const conEtiqueta = ({ campo, etiqueta, ancho, children }) => (
    <div className={`pt-campo ${s.campo} ${ancho ? s.ancho : ""}`}>
      <label htmlFor={`e-${campo}`}>{etiqueta}</label>
      {children}
      {errores[campo] && <span className={s.error}>{errores[campo]}</span>}
    </div>
  );

  return (
    // noValidate: los errores los dice validarEmpleado(), en español y junto
    // a cada campo, no el globo del navegador en el idioma del sistema.
    <form onSubmit={enviar} noValidate className={s.forma}>
      <div className={s.conFoto}>
        <div className={s.cajaFoto}>
          <Foto empleado={empleado} vista={foto?.vista} tam="grande" />
          <div className={s.acciones} style={{ justifyContent: "center" }}>
            <button type="button" className="pt-btn" onClick={() => camara.current?.click()} disabled={ocupado}>
              <Camera /> Tomar
            </button>
            <button type="button" className="pt-btn" onClick={() => archivo.current?.click()} disabled={ocupado}>
              <IconoImagen /> Archivo
            </button>
          </div>
          <input ref={camara} type="file" accept="image/*" capture="user" hidden
            onChange={(e) => { escogerFoto(e.target.files?.[0]); e.target.value = ""; }} />
          <input ref={archivo} type="file" accept="image/jpeg,image/png,image/webp" hidden
            onChange={(e) => { escogerFoto(e.target.files?.[0]); e.target.value = ""; }} />
          {errores.foto
            ? <span className={s.error} role="alert">{errores.foto}</span>
            : <small>De frente, con fondo claro y sin gorra ni lentes oscuros. Se recorta sola.</small>}
        </div>

        <div className={s.campos}>
          {conEtiqueta({ campo: "nombre", etiqueta: "Nombre(s)", children: (
            <input id="e-nombre" className="pt-input" value={f.nombre} onChange={cambia("nombre")} autoFocus={esAlta} autoComplete="off" />
          ) })}
          {conEtiqueta({ campo: "numero", etiqueta: "Número de empleado", children: (
            <input id="e-numero" className={`pt-input ${s.mono}`} value={f.numero} onChange={cambia("numero")}
              placeholder={esAlta ? "Se pone solo si lo dejas vacío" : ""} autoComplete="off" autoCapitalize="characters" />
          ) })}
          {conEtiqueta({ campo: "apellido_paterno", etiqueta: "Apellido paterno", children: (
            <input id="e-apellido_paterno" className="pt-input" value={f.apellido_paterno} onChange={cambia("apellido_paterno")} autoComplete="off" />
          ) })}
          {conEtiqueta({ campo: "apellido_materno", etiqueta: "Apellido materno", children: (
            <input id="e-apellido_materno" className="pt-input" value={f.apellido_materno} onChange={cambia("apellido_materno")} autoComplete="off" />
          ) })}
          {conEtiqueta({ campo: "puesto", etiqueta: "Puesto (va impreso en el gafete)", children: (
            <input id="e-puesto" className="pt-input" value={f.puesto} onChange={cambia("puesto")} placeholder="Operador de recolección" autoComplete="off" />
          ) })}
          {conEtiqueta({ campo: "area", etiqueta: "Área, ruta o planta", children: (
            <input id="e-area" className="pt-input" value={f.area} onChange={cambia("area")} placeholder="Ruta Norte" autoComplete="off" />
          ) })}
          {conEtiqueta({ campo: "tipo", etiqueta: "Tipo", children: (
            <select id="e-tipo" className="pt-input" value={f.tipo} onChange={cambia("tipo")}>
              {TIPOS_EMPLEADO.map((t) => <option key={t.id} value={t.id}>{t.texto}</option>)}
            </select>
          ) })}
          {conEtiqueta({ campo: "reporta_a", etiqueta: "Reporta a (jefe directo)", children: (
            <select id="e-reporta_a" className="pt-input" value={f.reporta_a || ""} onChange={cambia("reporta_a")}>
              <option value="">Nadie / no aplica</option>
              {jefes.map((j) => <option key={j.id} value={j.id}>{j.nombre}{j.puesto ? ` · ${j.puesto}` : ""}</option>)}
            </select>
          ) })}
        </div>
      </div>

      <div>
        <h2 className={s.seccion}>En caso de emergencia</h2>
        <p className={s.nota}>
          Opcional. Esto solo se enseña a quien escanee el gafete <strong>y</strong> teclee el PIN impreso atrás, y solo
          si la persona firmó su permiso. Sin permiso se guarda aquí, pero no sale en ninguna página.
        </p>
      </div>
      <div className={s.campos}>
        {conEtiqueta({ campo: "tipo_sangre", etiqueta: "Tipo de sangre", children: (
          <select id="e-tipo_sangre" className="pt-input" value={f.tipo_sangre || ""} onChange={cambia("tipo_sangre")}>
            <option value="">No se sabe</option>
            {TIPOS_SANGRE.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        ) })}
        {conEtiqueta({ campo: "alergias", etiqueta: "Alergias", children: (
          <input id="e-alergias" className="pt-input" value={f.alergias || ""} onChange={cambia("alergias")} placeholder="Penicilina" autoComplete="off" />
        ) })}
        {conEtiqueta({ campo: "contacto_emergencia", etiqueta: "A quién avisar (nombre y parentesco)", children: (
          <input id="e-contacto_emergencia" className="pt-input" value={f.contacto_emergencia || ""} onChange={cambia("contacto_emergencia")} placeholder="María López (esposa)" autoComplete="off" />
        ) })}
        {conEtiqueta({ campo: "telefono_emergencia", etiqueta: "Teléfono de emergencia", children: (
          <input id="e-telefono_emergencia" className={`pt-input ${s.mono}`} type="tel" inputMode="tel" value={f.telefono_emergencia || ""} onChange={cambia("telefono_emergencia")} placeholder="868 123 4567" autoComplete="off" />
        ) })}
        <div className={s.ancho}>
          <label className={s.casilla}>
            <input type="checkbox" checked={Boolean(f.permiso_emergencia)} onChange={(e) => setF({ ...f, permiso_emergencia: e.target.checked })} />
            <span>
              Firmó el permiso para mostrar estos datos con el PIN
              <small>Márcalo solo con el permiso firmado en la mano: son datos de salud.</small>
            </span>
          </label>
          {errores.permiso_emergencia && <span className={s.error}>{errores.permiso_emergencia}</span>}
        </div>
      </div>

      {aviso && <div className="pt-login-error" role="alert" style={{ margin: 0 }}>{aviso}</div>}

      <div className={s.pie}>
        <button type="submit" className="pt-btn pt-btn-naranja" disabled={ocupado}>
          {ocupado ? "Guardando…" : esAlta ? "Dar de alta y emitir su gafete" : "Guardar cambios"}
        </button>
        {alCancelar && <button type="button" className="pt-btn" onClick={alCancelar} disabled={ocupado}>Cancelar</button>}
      </div>
    </form>
  );
}
