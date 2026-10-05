/**
 * Un PNG de verdad para las pruebas (una "firma": fondo blanco y un trazo en
 * diagonal), armado a mano con zlib para no sumar dependencias. No es una
 * prueba: no termina en `.test.mjs`, así que `npm test` no lo corre solo.
 */
import zlib from "node:zlib";

function trozo(tipo, datos) {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, "ascii"), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(cuerpo));
  return Buffer.concat([largo, cuerpo, crc]);
}

export function pngDePrueba(ancho = 600, alto = 200) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0);
  ihdr.writeUInt32BE(alto, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 2; // RGB
  const filas = Buffer.alloc((ancho * 3 + 1) * alto, 255);
  for (let y = 0; y < alto; y++) {
    filas[y * (ancho * 3 + 1)] = 0; // filtro "ninguno"
    const x0 = Math.floor((y / alto) * ancho);
    for (let x = Math.max(0, x0 - 3); x < Math.min(ancho, x0 + 3); x++) {
      const i = y * (ancho * 3 + 1) + 1 + x * 3;
      filas[i] = 26; filas[i + 1] = 34; filas[i + 2] = 33;
    }
  }
  return new Uint8Array(Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo("IHDR", ihdr),
    trozo("IDAT", zlib.deflateSync(filas)),
    trozo("IEND", Buffer.alloc(0)),
  ]));
}
