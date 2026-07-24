// Inicialización del Admin SDK para los scripts de mantenimiento.
//
// Credenciales, en orden de preferencia:
//   1. GOOGLE_APPLICATION_CREDENTIALS=/ruta/service-account.json
//   2. ./service-account.json en la raíz del repo (ignorado por git)
//   3. Credenciales del CLI (`gcloud auth application-default login`)
// Contra el emulador no hace falta ninguna: alcanza con FIRESTORE_EMULATOR_HOST.
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

export const DEFAULT_PROJECT_ID = 'planilla-carest'

function credentials() {
  const fromEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS
  const local = resolve(repoRoot, 'service-account.json')
  const keyPath = fromEnv || (existsSync(local) ? local : null)
  if (keyPath) {
    const key = JSON.parse(readFileSync(keyPath, 'utf8'))
    return { credential: cert(key), projectId: key.project_id, source: keyPath }
  }
  return { credential: applicationDefault(), projectId: null, source: 'gcloud application-default' }
}

/**
 * Devuelve la instancia de Firestore a usar.
 * @param {{ emulator?: boolean }} opts si `emulator` es true apunta al emulador
 *   local (no toca la nube y no necesita credenciales).
 */
export function getDb({ emulator = false } = {}) {
  const projectId = process.env.FIREBASE_PROJECT_ID || DEFAULT_PROJECT_ID

  if (emulator) {
    process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080'
    process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099'
    initializeApp({ projectId })
    console.log(`→ emulador ${process.env.FIRESTORE_EMULATOR_HOST} (proyecto ${projectId})`)
    return getFirestore()
  }

  // Producción: nos aseguramos de no estar apuntando al emulador por accidente.
  delete process.env.FIRESTORE_EMULATOR_HOST
  const { credential, projectId: keyProject, source } = credentials()
  initializeApp({ credential, projectId: keyProject || projectId })
  console.log(`→ proyecto ${keyProject || projectId} (credenciales: ${source})`)
  return getFirestore()
}

// Lee flags simples del estilo `--dry-run` / `--club=carest`.
export function args() {
  const out = { _: [] }
  for (const a of process.argv.slice(2)) {
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=')
      out[k] = v === undefined ? true : v
    } else {
      out._.push(a)
    }
  }
  return out
}
