#!/usr/bin/env node
// Respaldo completo de Morcast: base de datos + fotos y comprobantes del Storage.
//
// Uso:  node respaldo/respaldar.mjs
//
// Deja una carpeta con fecha dentro de DESTINO (ver abajo) que contiene:
//   base-de-datos.dump   -> volcado de Postgres en formato "custom" (pg_restore)
//   base-de-datos.sql    -> el mismo volcado en texto plano, para poder leerlo
//   archivos/<cubeta>/.. -> cada foto y comprobante tal cual
//   MANIFIESTO.json      -> conteos, tamanos y huella SHA-256 de cada pieza
//
// El MANIFIESTO es lo que hace verificable el respaldo: la prueba de
// restauracion compara contra el, en vez de confiar en que "no hubo error".

import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '..')

// Los respaldos viven FUERA del repositorio, en la carpeta que Syncthing
// replica al escritorio. Asi quedan dos copias fisicas en dos maquinas.
const DESTINO = path.resolve(RAIZ, '..', 'Respaldos Morcast')
const CUANTOS_GUARDAR = 14

// ---------------------------------------------------------------- utilidades

const registro = []
function paso(txt) {
  const linea = `[${new Date().toISOString().slice(11, 19)}] ${txt}`
  console.log(linea)
  registro.push(linea)
}

function ejecutar(cmd, args, opciones = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { ...opciones, windowsHide: true })
    let salida = ''
    let error = ''
    p.stdout?.on('data', (d) => (salida += d))
    p.stderr?.on('data', (d) => (error += d))
    p.on('error', reject)
    p.on('close', (codigo) => {
      if (codigo === 0) resolve({ salida, error })
      else reject(new Error(`${path.basename(cmd)} salio con codigo ${codigo}\n${error.trim()}`))
    })
  })
}

async function sha256(archivo) {
  const h = createHash('sha256')
  h.update(await fs.readFile(archivo))
  return h.digest('hex')
}

// ------------------------------------------------------- configuracion local

function leerEnv(texto) {
  const salida = {}
  for (const linea of texto.split(/\r?\n/)) {
    const l = linea.trim()
    if (!l || l.startsWith('#')) continue
    const i = l.indexOf('=')
    if (i === -1) continue
    salida[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '')
  }
  return salida
}

async function configuracion() {
  const env = leerEnv(await fs.readFile(path.join(RAIZ, 'Web', '.env.local'), 'utf8'))
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL
  const llave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !llave) throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en Web/.env.local')

  // La contrasena de Postgres vive en su propio archivo, a veces con
  // "CLAVE=valor" y a veces como el valor pelado.
  const crudo = (await fs.readFile(path.join(RAIZ, 'Web', '.env.db-password'), 'utf8')).trim()
  const pwd = crudo.includes('=') ? crudo.slice(crudo.indexOf('=') + 1).trim() : crudo
  if (!pwd) throw new Error('Web/.env.db-password esta vacio')

  const ref = new URL(url).hostname.split('.')[0]
  return { url, llave, pwd, ref }
}

function buscarPgDump() {
  const candidatos = []
  for (const v of ['18', '17', '16', '15']) {
    candidatos.push(`C:\\Program Files\\PostgreSQL\\${v}\\bin\\pg_dump.exe`)
  }
  const encontrado = candidatos.find((c) => existsSync(c))
  if (!encontrado) {
    throw new Error(
      'No encuentro pg_dump. Instala PostgreSQL:\n' +
        '  winget install --id PostgreSQL.PostgreSQL.17 --source winget'
    )
  }
  return encontrado
}

// El acceso directo a la base (db.<ref>.supabase.co) ya solo tiene IPv6.
// Desde una red IPv4 hay que entrar por el "session pooler", que si acepta
// pg_dump. El prefijo de region cambio con el tiempo, asi que se prueban ambos.
const REGION = 'ca-central-1'
const HOSTS = [`aws-0-${REGION}.pooler.supabase.com`, `aws-1-${REGION}.pooler.supabase.com`]

function cadena(host, cfg) {
  const pwd = encodeURIComponent(cfg.pwd)
  return `postgresql://postgres.${cfg.ref}:${pwd}@${host}:5432/postgres`
}

// ------------------------------------------------------------- base de datos

async function respaldarBase(carpeta, cfg) {
  const pgDump = buscarPgDump()
  paso(`pg_dump: ${pgDump}`)

  // Se respalda "public" (las tablas del negocio), "auth" (las cuentas) y
  // "storage" (el indice de archivos). Sin --no-owner/--no-privileges el
  // volcado trae roles que solo existen dentro de Supabase y no se puede
  // restaurar en ningun otro Postgres.
  const comunes = [
    '--schema=public',
    '--schema=auth',
    '--schema=storage',
    '--no-owner',
    '--no-privileges',
    '--quote-all-identifiers',
  ]

  let ultimoError
  for (const host of HOSTS) {
    try {
      paso(`Conectando por ${host} ...`)
      const conn = cadena(host, cfg)
      await ejecutar(pgDump, [conn, ...comunes, '--format=custom', '--file', path.join(carpeta, 'base-de-datos.dump')])
      await ejecutar(pgDump, [conn, ...comunes, '--format=plain', '--file', path.join(carpeta, 'base-de-datos.sql')])
      paso(`Base de datos respaldada (${host}).`)
      return host
    } catch (e) {
      ultimoError = e
      paso(`  no funciono por ${host}: ${e.message.split('\n')[0]}`)
    }
  }
  throw ultimoError
}

// ------------------------------------------------------------------- storage

async function pedir(cfg, ruta, opciones = {}) {
  const r = await fetch(`${cfg.url}${ruta}`, {
    ...opciones,
    headers: {
      apikey: cfg.llave,
      Authorization: `Bearer ${cfg.llave}`,
      ...(opciones.body ? { 'Content-Type': 'application/json' } : {}),
      ...opciones.headers,
    },
  })
  if (!r.ok) throw new Error(`${ruta} respondio ${r.status}: ${(await r.text()).slice(0, 200)}`)
  return r
}

async function listarCubeta(cfg, cubeta, prefijo = '') {
  const encontrados = []
  let desde = 0
  for (;;) {
    const r = await pedir(cfg, `/storage/v1/object/list/${cubeta}`, {
      method: 'POST',
      body: JSON.stringify({ prefix: prefijo, limit: 100, offset: desde, sortBy: { column: 'name', order: 'asc' } }),
    })
    const lote = await r.json()
    if (!lote.length) break
    for (const item of lote) {
      const ruta = prefijo ? `${prefijo}/${item.name}` : item.name
      // Una "carpeta" viene sin id. Hay que bajar un nivel mas.
      if (item.id === null) encontrados.push(...(await listarCubeta(cfg, cubeta, ruta)))
      else encontrados.push(ruta)
    }
    if (lote.length < 100) break
    desde += lote.length
  }
  return encontrados
}

async function respaldarArchivos(carpeta, cfg) {
  const cubetas = await (await pedir(cfg, '/storage/v1/bucket')).json()
  paso(`Cubetas encontradas: ${cubetas.map((c) => c.name).join(', ') || '(ninguna)'}`)

  const inventario = []
  for (const cubeta of cubetas) {
    const rutas = await listarCubeta(cfg, cubeta.name)
    paso(`  ${cubeta.name}: ${rutas.length} archivo(s)`)
    for (const ruta of rutas) {
      const destino = path.join(carpeta, 'archivos', cubeta.name, ...ruta.split('/'))
      await fs.mkdir(path.dirname(destino), { recursive: true })
      const r = await pedir(cfg, `/storage/v1/object/${cubeta.name}/${ruta.split('/').map(encodeURIComponent).join('/')}`)
      const datos = Buffer.from(await r.arrayBuffer())
      await fs.writeFile(destino, datos)
      inventario.push({
        cubeta: cubeta.name,
        ruta,
        bytes: datos.length,
        sha256: createHash('sha256').update(datos).digest('hex'),
      })
    }
  }
  return { cubetas: cubetas.map((c) => ({ nombre: c.name, publica: c.public })), archivos: inventario }
}

// -------------------------------------------------------------- conteo real

async function contarFilas(host, cfg) {
  // La lista de tablas se le PREGUNTA a la base, no se escribe a mano: si
  // manana alguien agrega una tabla, entra sola al respaldo y a la prueba.
  // Una lista escrita a mano envejece en silencio y da falsa tranquilidad.
  const psql = path.join(path.dirname(buscarPgDump()), 'psql.exe')
  const conn = cadena(host, cfg)

  const lista = await ejecutar(psql, [
    conn, '-t', '-A', '-c',
    "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
  ])
  const tablas = lista.salida.split('\n').map((s) => s.trim()).filter(Boolean)

  const conteo = {}
  for (const t of tablas) {
    const r = await ejecutar(psql, [conn, '-t', '-A', '-c', `SELECT count(*) FROM public."${t}"`])
    conteo[t] = Number(r.salida.trim())
  }

  // Las cuentas de acceso son la otra mitad: sin ellas la base vuelve pero
  // nadie puede entrar.
  const u = await ejecutar(psql, [conn, '-t', '-A', '-c', 'SELECT count(*) FROM auth.users'])
  conteo['auth.users'] = Number(u.salida.trim())

  return conteo
}

// ------------------------------------------------------------------ rotacion

async function rotar() {
  const previos = (await fs.readdir(DESTINO, { withFileTypes: true }))
    .filter((d) => d.isDirectory() && /^\d{4}-\d{2}-\d{2}/.test(d.name))
    .map((d) => d.name)
    .sort()
  const sobran = previos.slice(0, Math.max(0, previos.length - CUANTOS_GUARDAR))
  for (const viejo of sobran) {
    await fs.rm(path.join(DESTINO, viejo), { recursive: true, force: true })
    paso(`Respaldo viejo eliminado: ${viejo}`)
  }
}

// --------------------------------------------------------------------- flujo

async function principal() {
  const cfg = await configuracion()
  const sello = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  const carpeta = path.join(DESTINO, sello)
  await fs.mkdir(carpeta, { recursive: true })
  paso(`Respaldo en: ${carpeta}`)

  const host = await respaldarBase(carpeta, cfg)
  const storage = await respaldarArchivos(carpeta, cfg)
  const filas = await contarFilas(host, cfg)
  paso('Conteo de filas: ' + JSON.stringify(filas))

  const piezas = {}
  for (const f of ['base-de-datos.dump', 'base-de-datos.sql']) {
    const st = await fs.stat(path.join(carpeta, f))
    piezas[f] = { bytes: st.size, sha256: await sha256(path.join(carpeta, f)) }
  }

  const manifiesto = {
    proyecto: 'morcast',
    supabase: cfg.url,
    fecha: new Date().toISOString(),
    host_usado: host,
    base_de_datos: piezas,
    filas_por_tabla: filas,
    storage,
    total_archivos: storage.archivos.length,
    total_bytes_archivos: storage.archivos.reduce((a, b) => a + b.bytes, 0),
    registro,
  }
  await fs.writeFile(path.join(carpeta, 'MANIFIESTO.json'), JSON.stringify(manifiesto, null, 2))

  await rotar()

  console.log('\n===================== RESPALDO TERMINADO =====================')
  console.log(`Carpeta          : ${carpeta}`)
  console.log(`Volcado de la BD : ${(piezas['base-de-datos.dump'].bytes / 1024).toFixed(0)} KB`)
  console.log(`Archivos         : ${manifiesto.total_archivos} (${(manifiesto.total_bytes_archivos / 1024).toFixed(0)} KB)`)
  console.log(`Filas            : ${Object.entries(filas).map(([t, n]) => `${t}=${n}`).join('  ')}`)
  console.log('\nSiguiente paso: node respaldo/probar-restauracion.mjs')
}

principal().catch((e) => {
  console.error('\nEL RESPALDO FALLO:', e.message)
  process.exit(1)
})
