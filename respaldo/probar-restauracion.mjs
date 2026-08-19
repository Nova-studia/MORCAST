#!/usr/bin/env node
// Prueba de restauracion. Un respaldo que nunca se restauro no es un respaldo,
// es una suposicion.
//
// Uso:  node respaldo/probar-restauracion.mjs [carpeta-de-respaldo]
//       (sin argumento toma el respaldo mas reciente)
//
// Levanta un Postgres LOCAL, temporal y aparte -- no toca Supabase ni ningun
// servicio instalado -- restaura ahi el volcado, cuenta las filas de cada tabla
// y las compara contra el MANIFIESTO. Al terminar apaga y borra el temporal.

import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '..')
const DESTINO = path.resolve(RAIZ, '..', 'Respaldos Morcast')

const PUERTO = 55432 // aparte, para no chocar con un Postgres ya instalado
const BASE = 'morcast_prueba'

// Roles que Supabase da por hechos. Sin ellos, cada politica de seguridad
// (RLS) que diga "TO authenticated" falla al restaurar.
const ROLES = [
  'anon', 'authenticated', 'service_role', 'authenticator',
  'supabase_admin', 'supabase_auth_admin', 'supabase_storage_admin',
  'dashboard_user', 'pgbouncer', 'supabase_read_only_user',
]

// OJO con "pg_ctl start": deja al servidor corriendo COMO HIJO, heredando sus
// tuberias de salida. Como esas tuberias nunca se cierran (el servidor sigue
// vivo), el evento "close" NUNCA llega aunque pg_ctl ya haya terminado, y el
// script se queda colgado para siempre. Por eso esos casos van con
// { sueltaProceso: true }: sin tuberias, y resolviendo en "exit".
function ejecutar(cmd, args, opciones = {}) {
  const { sueltaProceso, ...resto } = opciones
  return new Promise((resolve) => {
    const p = spawn(cmd, args, {
      ...resto,
      windowsHide: true,
      ...(sueltaProceso ? { stdio: 'ignore' } : {}),
    })
    let salida = ''
    let error = ''
    p.stdout?.on('data', (d) => (salida += d))
    p.stderr?.on('data', (d) => (error += d))
    p.on('error', (e) => resolve({ codigo: -1, salida, error: String(e) }))
    p.on(sueltaProceso ? 'exit' : 'close', (codigo) => resolve({ codigo, salida, error }))
  })
}

function binarios() {
  for (const v of ['18', '17', '16', '15']) {
    const dir = `C:\\Program Files\\PostgreSQL\\${v}\\bin`
    if (existsSync(path.join(dir, 'initdb.exe'))) return dir
  }
  throw new Error('No encuentro PostgreSQL instalado (initdb).')
}

async function ultimoRespaldo() {
  const dirs = (await fs.readdir(DESTINO, { withFileTypes: true }))
    .filter((d) => d.isDirectory() && /^\d{4}-\d{2}-\d{2}/.test(d.name))
    .map((d) => d.name)
    .sort()
  if (!dirs.length) throw new Error(`No hay respaldos en ${DESTINO}`)
  return path.join(DESTINO, dirs[dirs.length - 1])
}

async function principal() {
  const bin = binarios()
  const carpeta = process.argv[2] ? path.resolve(process.argv[2]) : await ultimoRespaldo()
  console.log(`Probando el respaldo: ${carpeta}\n`)

  const manifiesto = JSON.parse(await fs.readFile(path.join(carpeta, 'MANIFIESTO.json'), 'utf8'))

  // --- 1. las piezas siguen intactas -------------------------------------
  console.log('1) Comprobando que los archivos no se corrompieron...')
  const problemas = []
  for (const [nombre, esperado] of Object.entries(manifiesto.base_de_datos)) {
    const f = path.join(carpeta, nombre)
    const real = createHash('sha256').update(await fs.readFile(f)).digest('hex')
    if (real !== esperado.sha256) problemas.push(`${nombre}: huella distinta`)
  }
  let archivosOk = 0
  for (const a of manifiesto.storage.archivos) {
    const f = path.join(carpeta, 'archivos', a.cubeta, ...a.ruta.split('/'))
    try {
      const real = createHash('sha256').update(await fs.readFile(f)).digest('hex')
      if (real === a.sha256) archivosOk++
      else problemas.push(`${a.cubeta}/${a.ruta}: huella distinta`)
    } catch {
      problemas.push(`${a.cubeta}/${a.ruta}: NO ESTA`)
    }
  }
  console.log(`   volcado de la BD: ${problemas.length ? 'CON PROBLEMAS' : 'intacto'}`)
  console.log(`   archivos: ${archivosOk}/${manifiesto.storage.archivos.length} intactos`)

  // --- 2. Postgres temporal ----------------------------------------------
  const temporal = path.join(os.tmpdir(), `morcast-restauracion-${Date.now()}`)
  const datos = path.join(temporal, 'datos')
  await fs.mkdir(temporal, { recursive: true })
  const pwFile = path.join(temporal, 'pw.txt')
  await fs.writeFile(pwFile, 'prueba')

  let encendido = false
  try {
    console.log('\n2) Levantando un Postgres temporal aparte...')
    const ini = await ejecutar(path.join(bin, 'initdb.exe'), [
      '-D', datos, '-U', 'postgres', '--pwfile', pwFile, '--encoding=UTF8', '--locale=C',
    ])
    if (ini.codigo !== 0) throw new Error(`initdb fallo:\n${ini.error || ini.salida}`)

    const arranque = await ejecutar(path.join(bin, 'pg_ctl.exe'), [
      '-D', datos, '-l', path.join(temporal, 'servidor.log'),
      '-o', `-p ${PUERTO} -c listen_addresses=127.0.0.1`, '-w', 'start',
    ], { sueltaProceso: true })
    if (arranque.codigo !== 0) {
      const log = await fs.readFile(path.join(temporal, 'servidor.log'), 'utf8').catch(() => '(sin log)')
      throw new Error(`no arranco:\n${log}`)
    }
    encendido = true
    console.log(`   corriendo en 127.0.0.1:${PUERTO}`)

    const entorno = { ...process.env, PGPASSWORD: 'prueba' }
    const psql = (sql, base = 'postgres') =>
      ejecutar(path.join(bin, 'psql.exe'), [
        '-h', '127.0.0.1', '-p', String(PUERTO), '-U', 'postgres', '-d', base,
        '-v', 'ON_ERROR_STOP=0', '-t', '-A', '-c', sql,
      ], { env: entorno })

    await psql(`CREATE DATABASE ${BASE}`)
    // Los roles y extensiones que Supabase da por sentados.
    for (const rol of ROLES) await psql(`DO $$BEGIN CREATE ROLE "${rol}" NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END$$`, BASE)
    await psql('CREATE SCHEMA IF NOT EXISTS extensions', BASE)
    for (const ext of ['pgcrypto', 'uuid-ossp']) {
      await psql(`CREATE EXTENSION IF NOT EXISTS "${ext}" WITH SCHEMA extensions`, BASE)
    }

    // --- 3. restaurar ----------------------------------------------------
    console.log('\n3) Restaurando el volcado...')
    const rest = await ejecutar(path.join(bin, 'pg_restore.exe'), [
      '-h', '127.0.0.1', '-p', String(PUERTO), '-U', 'postgres', '-d', BASE,
      '--no-owner', '--no-privileges', path.join(carpeta, 'base-de-datos.dump'),
    ], { env: entorno })

    const errores = (rest.error || '').split('\n').filter((l) => /^pg_restore: error/.test(l))
    console.log(`   pg_restore termino con codigo ${rest.codigo}`)
    console.log(`   avisos/errores no fatales: ${errores.length}`)

    // --- 4. la prueba de verdad: contar filas ----------------------------
    console.log('\n4) Contando filas restauradas contra el manifiesto:\n')
    const filas = []
    let iguales = 0
    let distintas = 0
    for (const [tabla, esperadas] of Object.entries(manifiesto.filas_por_tabla)) {
      // "auth.users" viene con esquema; las del negocio son de "public".
      const cualificada = tabla.includes('.')
        ? tabla.split('.').map((p) => `"${p}"`).join('.')
        : `public."${tabla}"`
      const r = await psql(`SELECT count(*) FROM ${cualificada}`, BASE)
      const n = Number((r.salida || '').trim())
      const ok = Number.isFinite(n) && n === esperadas
      if (ok) iguales++
      else distintas++
      filas.push({ tabla, esperadas, restauradas: Number.isFinite(n) ? n : 'ERROR', ok })
    }
    const ancho = Math.max(...filas.map((f) => f.tabla.length), 10)
    for (const f of filas) {
      console.log(
        `   ${f.ok ? 'OK  ' : 'MAL '} ${f.tabla.padEnd(ancho)}  en Supabase: ${String(f.esperadas).padStart(5)}   restauradas: ${String(f.restauradas).padStart(5)}`
      )
    }

    // Las cuentas de acceso son la otra mitad: si no vuelven, la base esta
    // pero nadie puede entrar.
    const cuentas = filas.find((f) => f.tabla === 'auth.users')
    const nUsuarios = cuentas ? Number(cuentas.restauradas) : NaN
    console.log(`\n   cuentas de acceso (auth.users) restauradas: ${Number.isFinite(nUsuarios) ? nUsuarios : 'ERROR'}`)

    const veredicto = problemas.length === 0 && distintas === 0 && Number.isFinite(nUsuarios) && nUsuarios > 0

    const informe = {
      fecha: new Date().toISOString(),
      respaldo: carpeta,
      archivos_intactos: `${archivosOk}/${manifiesto.storage.archivos.length}`,
      problemas_de_integridad: problemas,
      tablas_iguales: iguales,
      tablas_distintas: distintas,
      cuentas_restauradas: Number.isFinite(nUsuarios) ? nUsuarios : null,
      detalle_filas: filas,
      errores_pg_restore: errores.slice(0, 40),
      veredicto: veredicto ? 'RESTAURACION VERIFICADA' : 'REVISAR',
    }
    await fs.writeFile(path.join(carpeta, 'PRUEBA-DE-RESTAURACION.json'), JSON.stringify(informe, null, 2))

    console.log('\n==============================================================')
    console.log(veredicto ? '  RESTAURACION VERIFICADA: el respaldo sirve.' : '  REVISAR: la restauracion no cuadro del todo.')
    console.log('==============================================================')
    if (errores.length) {
      console.log('\nErrores no fatales de pg_restore (los primeros 10):')
      errores.slice(0, 10).forEach((e) => console.log('   ' + e.slice(0, 160)))
    }
    if (problemas.length) {
      console.log('\nProblemas de integridad:')
      problemas.slice(0, 10).forEach((p) => console.log('   ' + p))
    }
    console.log(`\nInforme: ${path.join(carpeta, 'PRUEBA-DE-RESTAURACION.json')}`)
    process.exitCode = veredicto ? 0 : 1
  } finally {
    if (encendido) {
      await ejecutar(path.join(bin, 'pg_ctl.exe'), ['-D', datos, '-m', 'immediate', '-w', 'stop'], { sueltaProceso: true })
      await new Promise((r) => setTimeout(r, 2000)) // que Windows suelte los archivos
    }
    await fs.rm(temporal, { recursive: true, force: true }).catch(() => {})
    console.log('\n(El Postgres temporal se apago y se borro.)')
  }
}

principal().catch((e) => {
  console.error('\nLA PRUEBA FALLO:', e.message)
  process.exit(1)
})
