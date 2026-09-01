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

Se corre una sola vez:
    python scripts/cuaderno/extraer.py
"""
import json
import sys
from datetime import datetime, date
from pathlib import Path

import openpyxl

ORIGEN = Path(r"C:\Users\andre\Downloads\MORCAST - Cuaderno de captura LLENO.xlsx")
DESTINO = Path(__file__).with_name("cuaderno.json")


def celda(v):
    """Todo sale como texto. Las fechas en ISO para que no dependan del locale."""
    if v is None:
        return ""
    if isinstance(v, (datetime, date)):
        return v.date().isoformat() if isinstance(v, datetime) else v.isoformat()
    return str(v)


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

    salida = {
        "archivo": ORIGEN.name,
        "extraido": datetime.now().isoformat(timespec="seconds"),
        "hojas": hojas,
    }
    DESTINO.write_text(
        json.dumps(salida, ensure_ascii=False, indent=1),
        encoding="utf-8",
    )

    print(f"Escrito {DESTINO}")
    for nombre, filas in hojas.items():
        print(f"  {nombre}: {len(filas)} renglones")


if __name__ == "__main__":
    main()
