# -*- coding: utf-8 -*-
"""
EL CUADERNO DE LA EMPRESA -> JSON, SIN NINGUNA REGLA.

POR QUE EXISTE ESTE PASO
El .xlsx es un binario que vive fuera del repositorio y que nadie puede
revisar en un diff. Con el JSON adentro, la carga es reproducible y
auditable: dentro de seis meses se ve exactamente con que datos se poblo la
base de Morcast.

ESTE ARCHIVO NO LIMPIA NADA. Ni recorta espacios, ni convierte "N-A" en nulo,
ni arregla nombres. Todas las reglas viven en `normalizar.mjs`, que es puro y
esta probado. Si la limpieza se colara aqui, dejaria de haber una copia fiel
de lo que la empresa entrego.

POR QUE SALEN DOS ARCHIVOS, NO UNO
El repositorio `Nova-studia/MORCAST` es PUBLICO, y el volcado fiel trae
correos, telefonos, RFC (uno con la fecha de nacimiento adentro), personas de
contacto y razones sociales de 31 negocios y personas reales de Matamoros. No
se puede versionar tal cual, pero tampoco se puede vaciar sin mas: es el
archivo que lee `cargar.mjs`, y sin datos la carga dejaria de ser reproducible
y todos los clientes saldrian como pendientes.

Por eso:
  - `cuaderno.json`      el volcado completo, TAL COMO SE ESCRIBIA ANTES.
                         Se queda LOCAL (esta en .gitignore) y es el que lee
                         `cargar.mjs`. Nunca se sube.
  - `cuaderno-auditoria.json`  la misma hoja de clientes con las columnas
                         personales vaciadas. ESTA SI se versiona: es lo que
                         permite ver dentro de seis meses con que datos se
                         pobló la base, sin exponer a nadie.

Lo que se vacia en `cuaderno-auditoria.json`, y SOLO eso: en la hoja
"2 Clientes", las columnas 1 (persona de contacto), 2 (telefono), 3 (correo),
4 (razon social), 5 (RFC), 6 (domicilio fiscal) y 7 (CP), y solo en los
renglones de datos (los que carga.mjs sí procesa, `.slice(5)` en adelante). La
columna 0 (empresa), las 8/9/10 (uso de CFDI, forma de pago, observaciones) y
las demas hojas —rutas, puntos, servicios— son datos de OPERACION, no
personales, y quedan intactas porque son justo lo que hay que poder auditar.
Los renglones 0-4 (titulo y encabezados de columna) tambien quedan intactos:
son etiquetas de la hoja, no datos de ningun cliente.

Se corre una sola vez:
    python scripts/cuaderno/extraer.py
"""
import copy
import json
import sys
from datetime import datetime, date
from pathlib import Path

import openpyxl

ORIGEN = Path(r"C:\Users\andre\Downloads\MORCAST - Cuaderno de captura LLENO.xlsx")
DESTINO = Path(__file__).with_name("cuaderno.json")
DESTINO_AUDITORIA = Path(__file__).with_name("cuaderno-auditoria.json")

HOJA_CLIENTES = "2 Clientes"
PRIMER_RENGLON_DE_DATOS = 5  # el mismo corte que usa `filas()` en cargar.mjs
COLUMNAS_PERSONALES = (1, 2, 3, 4, 5, 6, 7)


def celda(v):
    """Todo sale como texto. Las fechas en ISO para que no dependan del locale."""
    if v is None:
        return ""
    if isinstance(v, (datetime, date)):
        return v.date().isoformat() if isinstance(v, datetime) else v.isoformat()
    return str(v)


def redactado(hojas):
    """Copia de `hojas` con las columnas personales de "2 Clientes" en "".

    Solo toca los renglones de datos (desde `PRIMER_RENGLON_DE_DATOS`): los
    de titulo y encabezado no traen datos de ningun cliente, son etiquetas de
    la hoja, y perderlos volveria el archivo de auditoria mudo sobre que
    significaba cada columna.
    """
    copia = copy.deepcopy(hojas)
    clientes = copia.get(HOJA_CLIENTES, [])
    for fila in clientes[PRIMER_RENGLON_DE_DATOS:]:
        for i in COLUMNAS_PERSONALES:
            if i < len(fila):
                fila[i] = ""
    return copia


def main():
    if not ORIGEN.exists():
        sys.exit(f"No se encontro el cuaderno en {ORIGEN}")

    libro = openpyxl.load_workbook(ORIGEN, data_only=True)
    hojas = {}
    for hoja in libro.worksheets:
        hojas[hoja.title] = [
            [celda(c) for c in fila]
            for fila in hoja.iter_rows(values_only=True)
        ]

    extraido = datetime.now().isoformat(timespec="seconds")

    salida = {
        "archivo": ORIGEN.name,
        "extraido": extraido,
        "hojas": hojas,
    }
    DESTINO.write_text(
        json.dumps(salida, ensure_ascii=False, indent=1),
        encoding="utf-8",
    )

    salida_auditoria = {
        "archivo": ORIGEN.name,
        "extraido": extraido,
        "nota": (
            "Copia redactada de cuaderno.json para el repositorio publico. "
            "En la hoja '2 Clientes', las columnas de persona de contacto, "
            "telefono, correo, razon social, RFC, domicilio fiscal y CP van "
            "en blanco. Lo demas —incluida la propia columna Empresa, y "
            "todas las hojas de rutas, puntos y servicios— esta intacto."
        ),
        "hojas": redactado(hojas),
    }
    DESTINO_AUDITORIA.write_text(
        json.dumps(salida_auditoria, ensure_ascii=False, indent=1),
        encoding="utf-8",
    )

    print(f"Escrito {DESTINO} (local, no se sube)")
    print(f"Escrito {DESTINO_AUDITORIA} (redactado, se versiona)")
    for nombre, filas in hojas.items():
        print(f"  {nombre}: {len(filas)} renglones")


if __name__ == "__main__":
    main()
