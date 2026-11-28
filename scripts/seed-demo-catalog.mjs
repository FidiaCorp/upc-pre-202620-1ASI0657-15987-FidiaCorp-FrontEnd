#!/usr/bin/env node
// Limpia el catálogo DEMO de residuos de pruebas (E2E/QA) y siembra 6 inmuebles realistas de Lima (uno por foto local).
//
// Uso (stack Docker levantado con docker compose desde FidiaCorp-backend):
//   node scripts/seed-demo-catalog.mjs              → purga + siembra + verificación SUNARP
//   node scripts/seed-demo-catalog.mjs --dry-run    → solo informa qué se purgaría y qué falta sembrar
//
// Variables opcionales:
//   CREDICASA_API_BASE_URL        (por defecto http://localhost:8080/api/v1, el api-gateway)
//   CREDICASA_POSTGRES_CONTAINER  (por defecto se busca el servicio "postgres" del proyecto compose "credicasa")
//   CREDICASA_DEMO_EMAIL          (por defecto asesor.demo@credicasa.pe)
//   CREDICASA_DEMO_PASSWORD       (por defecto CrediCasa-Demo-2026!; solo para la cuenta DEMO local)
//
// Es idempotente: la purga solo toca títulos/etiquetas/descripciones de pruebas y duplicados exactos, nunca cuentas,
// simulaciones ni ofertas; los 6 inmuebles se crean una sola vez (se reconocen por título) y la verificación registral
// solo se ejecuta si el inmueble aún no está VERIFIED_GENUINE.
import { spawnSync } from 'node:child_process'

const apiBaseUrl = (process.env.CREDICASA_API_BASE_URL || 'http://localhost:8080/api/v1').replace(/\/$/, '')
const demoEmail = process.env.CREDICASA_DEMO_EMAIL || 'asesor.demo@credicasa.pe'
const demoPassword = process.env.CREDICASA_DEMO_PASSWORD || 'CrediCasa-Demo-2026!'
const dryRun = process.argv.includes('--dry-run')

const DEMO_PROPERTIES = [
  {
    title: 'Departamento Vista Parque — Miraflores',
    address: 'Av. Pardo 480, Miraflores, Lima',
    description: 'Departamento de 3 dormitorios frente al parque, sala-comedor con terraza, cocina abierta y cochera. A dos cuadras del malecón.',
    price: '420000.00', currency: 'PEN', tags: ['miraflores', 'terraza', 'cochera', 'parque'],
    registry: { registryNumber: '12345678', claimedOwner: 'Inmobiliaria Pardo Miraflores S.A.C.' },
  },
  {
    title: 'Flat Moderno — Surco Residencial',
    address: 'Jr. Caminos del Inca 1120, Santiago de Surco, Lima',
    description: 'Flat de 2 dormitorios en condominio con áreas verdes, vigilancia 24 horas y acabados modernos. Ideal para primera vivienda.',
    price: '310000.00', currency: 'PEN', tags: ['surco', 'parque', 'seguridad', 'moderno'],
  },
  {
    title: 'Residencia El Golf — San Isidro',
    address: 'Av. Pezet 1450, San Isidro, Lima',
    description: 'Residencia con vista al Golf de San Isidro, 3 dormitorios en suite, estudio y cochera doble. Edificio con pocas unidades.',
    price: '245000.00', currency: 'USD', tags: ['san isidro', 'golf', 'vista parque', 'cochera doble'],
    registry: { registryNumber: '11872345', claimedOwner: 'Desarrollos El Golf S.A.' },
  },
  {
    title: 'Dúplex Familiar — San Borja Norte',
    address: 'Av. San Borja Norte 680, San Borja, Lima',
    description: 'Dúplex de 3 dormitorios con jardín interior, sala de estar en el segundo nivel y cochera. Cerca a colegios y al Pentagonito.',
    price: '510000.00', currency: 'PEN', tags: ['san borja', 'jardin', '3 dormitorios', 'cochera'],
    registry: { registryNumber: '13560421', claimedOwner: 'Constructora San Borja Norte S.A.C.' },
  },
  {
    title: 'Edificio Parque Central — Jesús María',
    address: 'Av. Salaverry 1920, Jesús María, Lima',
    description: 'Departamento de 2 dormitorios con ascensor y vista al Campo de Marte. Zona céntrica con transporte, comercios y parques.',
    price: '365000.00', currency: 'PEN', tags: ['jesus maria', 'parque', 'céntrico', 'ascensor'],
  },
  {
    title: 'Loft Boutique — Barranco Bohemio',
    address: 'Jr. Pedro de Osma 340, Barranco, Lima',
    description: 'Loft de doble altura con terraza privada, a pasos del Puente de los Suspiros. Edificio boutique pet friendly.',
    price: '168000.00', currency: 'USD', tags: ['barranco', 'loft', 'terraza', 'pet friendly'],
    registry: { registryNumber: '14298172', claimedOwner: 'Inversiones Pedro de Osma E.I.R.L.' },
  },
]

// Residuos de pruebas: títulos con sufijo hexadecimal de los specs E2E, prefijos de QA/experimentos, etiquetas suite-<hex>
// y descripciones propias de los tests. "Inmueble %" solo se purga con sufijo hex o con descripción de prueba, para no
// tocar un inmueble real cuyo título empiece por "Inmueble".
const PURGE_SQL = String.raw`
CREATE TEMP TABLE purge_ids (id uuid PRIMARY KEY, reason text NOT NULL);
INSERT INTO purge_ids
SELECT p.id, CASE
    WHEN p.title ~ '^Inmueble Sunarp ' THEN 'E2E Inmueble Sunarp'
    WHEN p.title ~ '^Inmueble ' THEN 'E2E Inmueble <hex>'
    WHEN p.title ~ '^Casa contacto ' THEN 'E2E Casa contacto'
    WHEN p.title ~ '^Depa IA ' THEN 'E2E Depa IA'
    WHEN p.title ~ '^Casa prueba-' THEN 'E2E Casa prueba-'
    WHEN p.title ~ '^(QA03 |QA |Resiliencia Outbox )' THEN 'QA / experimentos'
    ELSE 'etiqueta o descripción de prueba' END
FROM properties p
WHERE p.title ~ '^Inmueble [0-9a-f]{32}$'
   OR p.title LIKE 'Inmueble Sunarp %'
   OR p.title LIKE 'Casa contacto %'
   OR p.title LIKE 'Depa IA %'
   OR p.title LIKE 'Casa prueba-%'
   OR p.title LIKE 'QA03 %'
   OR p.title LIKE 'QA %'
   OR p.title LIKE 'Resiliencia Outbox %'
   OR (p.title LIKE 'Inmueble %' AND (p.description LIKE 'Creado exclusivamente para aceptaci_n local' OR p.description IN ('E2E', 'QA-03')))
   OR EXISTS (SELECT 1 FROM property_tags t WHERE t.property_id = p.id AND t.tag ~ '^suite-[0-9a-f]{32}$');
-- Duplicados exactos (mismo propietario, título, dirección, precio y moneda) entre los inmuebles activos: se conserva el más antiguo.
INSERT INTO purge_ids
SELECT d.id, 'duplicado exacto' FROM (
  SELECT id, row_number() OVER (PARTITION BY owner_id, title, address, price, currency ORDER BY created_at, id) AS rn
  FROM properties WHERE deleted_at IS NULL AND id NOT IN (SELECT id FROM purge_ids)
) d WHERE d.rn > 1;
SELECT 'PURGA|' || reason || '|' || count(*) FROM purge_ids GROUP BY reason ORDER BY reason;
SELECT 'TAGS|' || count(*) FROM property_tags WHERE property_id IN (SELECT id FROM purge_ids);
DELETE FROM property_tags WHERE property_id IN (SELECT id FROM purge_ids);
DELETE FROM properties WHERE id IN (SELECT id FROM purge_ids);
SELECT 'RESTANTES|' || count(*) FILTER (WHERE deleted_at IS NULL) || '|' || count(*) FROM properties;
`

function postgresContainer() {
  if (process.env.CREDICASA_POSTGRES_CONTAINER) return process.env.CREDICASA_POSTGRES_CONTAINER
  const found = spawnSync('docker', ['ps', '-q', '--filter', 'label=com.docker.compose.project=credicasa', '--filter', 'label=com.docker.compose.service=postgres'], { encoding: 'utf8' })
  if (found.error) throw new Error(`No se pudo ejecutar docker (${found.error.message}). ¿Docker Desktop está en ejecución?`)
  const id = found.stdout.trim().split(/\s+/)[0]
  if (!id) throw new Error('No hay un contenedor postgres del proyecto compose "credicasa" en ejecución. Levanta el stack con docker compose up -d desde FidiaCorp-backend.')
  return id
}

function psql(container, database, sql) {
  const result = spawnSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1', '-q', '-At'], { input: sql, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`psql (${database}) falló: ${(result.stderr || result.stdout || '').trim()}`)
  return result.stdout.trim().split('\n').filter(Boolean)
}

async function call(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers: { Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  const text = await response.text()
  let json = null
  try { json = text ? JSON.parse(text) : null } catch { json = { raw: text } }
  return { status: response.status, json }
}

const sqlText = value => `'${String(value).replaceAll("'", "''")}'`

async function main() {
  console.log(`Catálogo DEMO CrediCasa · API ${apiBaseUrl}${dryRun ? ' · modo --dry-run (sin cambios)' : ''}`)
  const health = await call('/properties?q=&mine=false&page=0&size=1').catch(error => ({ status: 0, json: { message: error.message } }))
  if (health.status !== 200 && health.status !== 401) throw new Error(`El api-gateway no responde en ${apiBaseUrl} (HTTP ${health.status}). Levanta el stack antes de ejecutar este script.`)
  const container = postgresContainer()

  // 1) Purga de residuos de pruebas en property_db (en una transacción; con --dry-run se revierte).
  const purge = psql(container, 'property_db', `BEGIN;\n${PURGE_SQL}\n${dryRun ? 'ROLLBACK;' : 'COMMIT;'}\n`)
  const purged = purge.filter(line => line.startsWith('PURGA|')).map(line => line.split('|'))
  const total = purged.reduce((sum, [, , count]) => sum + Number(count), 0)
  console.log(`\n1) Purga de residuos E2E/QA en property_db: ${total} inmueble(s)${dryRun ? ' (se eliminarían)' : ' eliminados'}`)
  for (const [, reason, count] of purged) console.log(`   - ${reason}: ${count}`)
  const tags = purge.find(line => line.startsWith('TAGS|'))?.split('|')[1] || '0'
  const remaining = purge.find(line => line.startsWith('RESTANTES|'))?.split('|') || []
  console.log(`   - etiquetas asociadas: ${tags}; inmuebles activos que quedan: ${remaining[1] ?? '?'} (filas totales ${remaining[2] ?? '?'})`)

  // 2) Asesor DEMO: se registra por la API pública si no existe y se le asigna ROLE_REALTOR en identity_db.
  console.log(`\n2) Asesor DEMO ${demoEmail}`)
  const existing = psql(container, 'identity_db', `SELECT roles FROM accounts WHERE lower(email) = lower(${sqlText(demoEmail)});`)
  if (!existing.length) {
    if (dryRun) { console.log('   - no existe; se registraría y promovería a ROLE_REALTOR'); }
    else {
      const registered = await call('/auth/register', { method: 'POST', body: { firstName: 'Daniel', lastName: 'Asesor Demo', email: demoEmail, password: demoPassword } })
      if (registered.status !== 201) throw new Error(`No se pudo registrar el asesor DEMO (HTTP ${registered.status}): ${registered.json?.message || ''}`)
      console.log('   - registrado por POST /auth/register')
    }
  } else console.log(`   - ya existe (roles: ${existing[0]})`)
  if (!dryRun && existing[0] !== 'ROLE_REALTOR') {
    psql(container, 'identity_db', `UPDATE accounts SET roles = 'ROLE_REALTOR' WHERE lower(email) = lower(${sqlText(demoEmail)}) AND roles <> 'ROLE_REALTOR';`)
    console.log('   - rol asignado: ROLE_REALTOR')
  }
  if (dryRun && !existing.length) { console.log('\n3) Siembra: se crearían los 6 inmuebles DEMO y se verificarían 4 en SUNARP.'); return }

  const login = await call('/auth/login', { method: 'POST', body: { email: demoEmail, password: demoPassword } })
  if (login.status !== 200 || !login.json?.token) {
    throw new Error(`No se pudo iniciar sesión con ${demoEmail} (HTTP ${login.status}). Si cambiaste su contraseña, defínela en CREDICASA_DEMO_PASSWORD${login.json?.twoFactorRequired ? '; además desactiva su segundo factor' : ''}.`)
  }
  const token = login.json.token

  // 3) Siembra idempotente por título (solo inmuebles propios del asesor DEMO) y verificación registral SUNARP.
  const mine = await call('/properties?q=&mine=true&page=0&size=100', { token })
  if (mine.status !== 200) throw new Error(`No se pudo listar el catálogo del asesor DEMO (HTTP ${mine.status}).`)
  const byTitle = new Map((mine.json.items || []).map(item => [item.title, item]))
  console.log(`\n3) Siembra de inmuebles DEMO (${DEMO_PROPERTIES.length})`)
  const rows = []
  for (const { registry, ...payload } of DEMO_PROPERTIES) {
    let property = byTitle.get(payload.title)
    let action = 'ya existía'
    if (!property) {
      if (dryRun) { rows.push({ title: payload.title, action: 'se crearía', sunarp: registry ? 'se verificaría' : '—' }); continue }
      const created = await call('/properties', { method: 'POST', token, body: payload })
      if (created.status !== 201) throw new Error(`No se pudo crear "${payload.title}" (HTTP ${created.status}): ${created.json?.message || ''}`)
      property = created.json
      action = 'creado'
    }
    let sunarp = '—'
    if (registry) {
      const legitimacy = await call(`/properties/${property.id}/legitimacy`, { token })
      if (legitimacy.json?.status === 'VERIFIED_GENUINE') sunarp = `ya verificado · ${legitimacy.json.certificateHash.slice(0, 16)}…`
      else if (dryRun) sunarp = 'se verificaría'
      else {
        const verified = await call(`/properties/${property.id}/verify-registry`, { method: 'POST', token, body: registry })
        if (verified.status !== 200 || verified.json?.status !== 'VERIFIED_GENUINE') throw new Error(`La verificación SUNARP de "${payload.title}" no quedó VERIFIED_GENUINE (HTTP ${verified.status}).`)
        sunarp = `verificado · SHA-256 ${verified.json.certificateHash.slice(0, 16)}…`
      }
    }
    rows.push({ title: payload.title, action, sunarp })
  }
  for (const row of rows) console.log(`   - ${row.title}: ${row.action}; SUNARP ${row.sunarp}`)
  console.log(`\nListo${dryRun ? ' (sin cambios)' : ''}. Revisa http://localhost/realState y http://localhost/home.`)
}

main().catch(error => { console.error(`\nERROR: ${error.message}`); process.exit(1) })
