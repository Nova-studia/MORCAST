import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { pesos, fechaLarga, CONSTANCIA_FISCAL, IVA } from "./datos";
import {
  EMPRESA_COTIZACION,
  CONDICIONES_COMERCIALES,
  DATOS_TRANSFERENCIA,
} from "./cotizacion-datos";

const CSS = `
  * { margin:0; padding:0; box-sizing:border-box; font-family:-apple-system, Roboto, Arial, sans-serif; }
  body { color:#1a2221; font-size:12px; }
  .cab { background:#144c4f; padding:20px 28px; position:relative; }
  .cab::after { content:""; position:absolute; left:0; right:0; bottom:0; height:4px; background:#4eb34a; }
  .marca { font-size:20px; font-weight:800; color:#fff; }
  .marca span { color:#4eb34a; }
  .marca small { display:block; font-size:8px; color:#cfe0de; letter-spacing:0.15em; margin-top:2px; }
  .cont { padding:24px 28px; }
  .titulo { font-size:17px; font-weight:800; }
  .folio { color:#6e7a78; font-size:11px; margin-top:3px; }
  .p { color:#6e7a78; font-size:11px; margin:14px 0; }
  .cols { display:flex; gap:24px; margin:16px 0; }
  .col { flex:1; }
  .col h3 { color:#4eb34a; font-size:10px; letter-spacing:0.04em; margin-bottom:8px; }
  .row { display:flex; margin:4px 0; }
  .row .k { color:#6e7a78; width:80px; font-weight:600; font-size:10.5px; }
  .row .v { flex:1; font-size:11px; }
  table { width:100%; border-collapse:collapse; margin:14px 0; }
  th { background:#144c4f; color:#fff; font-size:10px; padding:8px 6px; text-align:left; }
  td { padding:8px 6px; font-size:10.5px; border:1px solid #e1e6e5; }
  .tot { display:flex; justify-content:space-between; padding:4px 0; font-size:11px; }
  .tot.g { font-weight:800; font-size:14px; border-top:1px solid #e1e6e5; padding-top:8px; margin-top:4px; }
  .decl { color:#6e7a78; font-size:10px; margin:18px 0; line-height:1.5; }
  .firmas { display:flex; gap:40px; margin-top:40px; }
  .firma { flex:1; border-top:1px solid #99a; padding-top:6px; text-align:center; font-size:10px; }
  .caja { background:#f4f9f7; border-left:3px solid #4eb34a; padding:10px 12px; font-size:10.5px; color:#3a4a48; margin-top:10px; }
  .subtit { font-size:9.5px; font-weight:800; letter-spacing:0.06em; color:#4eb34a; }
  .pie { margin-top:24px; border-top:1px solid #e1e6e5; padding-top:10px; color:#9aa4a2; font-size:9px; }
`;

const cabecera = `
  <div class="cab">
    <div class="marca">MORCAST <span>DEL NORTE</span><small>MANEJO INTEGRAL DE RESIDUOS</small></div>
  </div>`;

async function generar(html, nombre) {
  const full = `<html><head><meta charset="utf-8"><style>${CSS}</style></head><body>${html}</body></html>`;
  const { uri } = await Print.printToFileAsync({ html: full });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: nombre, UTI: "com.adobe.pdf" });
  }
  return uri;
}

export async function descargarManifiesto(s, cliente) {
  const html = `
    ${cabecera}
    <div class="cont">
      <div class="titulo">Manifiesto de manejo de residuos</div>
      <div class="folio">Folio: ${s.manifiesto}</div>
      <div class="p">Comprobante del protocolo de recolección, transporte y disposición final de residuos.</div>
      <div class="cols">
        <div class="col">
          <h3>GENERADOR</h3>
          <div class="row"><div class="k">Empresa</div><div class="v">${cliente.empresa}</div></div>
          <div class="row"><div class="k">RFC</div><div class="v">${cliente.rfc}</div></div>
          <div class="row"><div class="k">Contrato</div><div class="v">${cliente.id}</div></div>
        </div>
        <div class="col">
          <h3>PRESTADOR DE SERVICIO</h3>
          <div class="row"><div class="k">Empresa</div><div class="v">Morcast del Norte, S.A. de C.V.</div></div>
          <div class="row"><div class="k">RFC</div><div class="v">${CONSTANCIA_FISCAL.rfc}</div></div>
          <div class="row"><div class="k">Operador</div><div class="v">${s.operador}</div></div>
        </div>
      </div>
      <table>
        <tr><th>Fecha</th><th>Tipo de residuo</th><th>Contenedor</th><th>Volumen</th><th>Peso</th></tr>
        <tr><td>${fechaLarga(s.fecha)}</td><td>${s.tipo}</td><td>${s.contenedor}</td><td>${s.volumen}</td><td>${s.peso}</td></tr>
      </table>
      <div class="decl">El generador declara que los residuos entregados corresponden a la descripción anterior. El prestador de servicio confirma su recolección, transporte y disposición final conforme a la normatividad ambiental aplicable.</div>
      <div class="firmas"><div class="firma">Firma del generador</div><div class="firma">Firma del prestador de servicio</div></div>
      <div class="pie">Manifiesto de demostración generado por la app de Morcast del Norte.</div>
    </div>`;
  return generar(html, `Manifiesto ${s.manifiesto}`);
}

export async function descargarConstancia() {
  const c = CONSTANCIA_FISCAL;
  const html = `
    ${cabecera}
    <div class="cont">
      <div class="titulo">Constancia de Situación Fiscal</div>
      <div class="folio">${c.rfc}</div>
      <div class="p">Datos fiscales del prestador de servicio para efectos de facturación.</div>
      <div class="row"><div class="k">Razón social</div><div class="v">${c.razonSocial}</div></div>
      <div class="row"><div class="k">RFC</div><div class="v">${c.rfc}</div></div>
      <div class="row"><div class="k">Régimen</div><div class="v">${c.regimen}</div></div>
      <div class="row"><div class="k">Domicilio</div><div class="v">${c.domicilio}</div></div>
      <div class="caja">Documento de demostración. Para trámites oficiales, solicite la Constancia de Situación Fiscal emitida por el SAT.</div>
      <div class="pie">Constancia de demostración generada por la app de Morcast del Norte.</div>
    </div>`;
  return generar(html, "Constancia fiscal");
}

export async function descargarReporte(titulo, filas, cliente) {
  const totalVol = filas.reduce((a, f) => a + f.volumen, 0);
  const totalMonto = filas.reduce((a, f) => a + f.monto, 0);
  const cuerpo = filas.map((f) => `
    <tr><td>${f.periodo}</td><td>${f.volumen.toLocaleString("es-MX")} m³</td><td>${pesos(f.monto)}</td></tr>`).join("");
  const html = `
    ${cabecera}
    <div class="cont">
      <div class="titulo">${titulo}</div>
      <div class="folio">${cliente.empresa} · ${cliente.id}</div>
      <table>
        <tr><th>Periodo</th><th>Volumen</th><th>Monto</th></tr>
        ${cuerpo}
        <tr><td style="font-weight:800">Total</td><td style="font-weight:800">${totalVol.toLocaleString("es-MX")} m³</td><td style="font-weight:800">${pesos(totalMonto)}</td></tr>
      </table>
      <div class="pie">Reporte de demostración generado por la app de Morcast del Norte.</div>
    </div>`;
  return generar(html, titulo);
}

export async function descargarReporteNegocio(titulo, filas) {
  const total = filas.reduce((a, f) => a + f.monto, 0);
  const cuerpo = filas.map((f) => `<tr><td>${f.periodo}</td><td>${pesos(f.monto)}</td></tr>`).join("");
  const html = `
    ${cabecera}
    <div class="cont">
      <div class="titulo">${titulo}</div>
      <div class="folio">Reporte interno · Morcast del Norte</div>
      <table>
        <tr><th>Periodo</th><th>Ingresos</th></tr>
        ${cuerpo}
        <tr><td style="font-weight:800">Total</td><td style="font-weight:800">${pesos(total)}</td></tr>
      </table>
      <div class="pie">Reporte de demostración generado por la app de Morcast del Norte.</div>
    </div>`;
  return generar(html, titulo);
}

export async function descargarCotizacion(items, cliente) {
  const subtotal = items.reduce((a, it) => a + it.precio * it.cant, 0);
  const iva = subtotal * IVA;
  const total = subtotal + iva;
  // Los datos bancarios se imprimen vacíos mientras el cliente no los entregue.
  const t = DATOS_TRANSFERENCIA;
  const val = (v) => (t.pendiente || !v ? t.leyendaPendiente : v);
  const banco = val(t.banco);
  const clabe = val(t.clabe);
  const cuenta = val(t.cuenta);
  const filas = items.map((it) => `
    <tr><td>${it.servicio}</td><td>${it.unidad}</td><td>${it.cant}</td><td>${pesos(it.precio)}</td><td>${pesos(it.precio * it.cant)}</td></tr>`).join("");
  const html = `
    ${cabecera}
    <div class="cont">
      <div class="titulo">Cotización de servicios</div>
      <div class="folio">${cliente.empresa} · ${fechaLarga("2026-07-18")}</div>
      <table>
        <tr><th>Concepto</th><th>Unidad</th><th>Cant.</th><th>P. unitario</th><th>Importe</th></tr>
        ${filas}
      </table>
      <div style="width:55%; margin-left:45%">
        <div class="tot"><span>Subtotal</span><span>${pesos(subtotal)}</span></div>
        <div class="tot"><span>IVA (16%)</span><span>${pesos(iva)}</span></div>
        <div class="tot g"><span>Total</span><span>${pesos(total)}</span></div>
      </div>
      <div class="caja">Precios de referencia sujetos a confirmación según volumen, frecuencia y condiciones del sitio.</div>
      <div style="display:flex; gap:18px; margin-top:14px">
        <div style="flex:1">
          <div class="subtit">CONDICIONES COMERCIALES</div>
          <ul style="margin:6px 0 0 16px; padding:0; font-size:11px; line-height:1.5">
            ${CONDICIONES_COMERCIALES.lista.map((c) => `<li>${c}</li>`).join("")}
          </ul>
        </div>
        <div style="flex:1">
          <div class="subtit">DATOS PARA TRANSFERENCIA</div>
          <table style="font-size:11px; margin-top:6px">
            <tr><td>Beneficiario</td><td>${DATOS_TRANSFERENCIA.beneficiario}</td></tr>
            <tr><td>Banco</td><td>${banco}</td></tr>
            <tr><td>CLABE</td><td>${clabe}</td></tr>
            <tr><td>Cuenta</td><td>${cuenta}</td></tr>
          </table>
        </div>
      </div>
      <div class="pie">Representante legal: ${EMPRESA_COTIZACION.representanteLegal}.</div>
    </div>`;
  return generar(html, "Cotización");
}
