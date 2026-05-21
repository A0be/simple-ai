import { copyFileSync, mkdirSync, existsSync, statSync } from 'fs'
import { execSync } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const dest = join(root, 'resources', 'claude', 'claude.exe')

mkdirSync(dirname(dest), { recursive: true })

try {
  const raw = execSync('where claude', { encoding: 'utf-8' }).trim()
  const src = raw.split(/\r?\n/)[0].trim()
  if (src && existsSync(src)) {
    console.log(`Copying Claude CLI from: ${src}`)
    copyFileSync(src, dest)
    const mb = Math.round(statSync(dest).size / 1024 / 1024 * 10) / 10
    console.log(`Bundled Claude CLI (${mb} MB) -> resources/claude/claude.exe`)
  } else {
    console.warn('Claude CLI binary not found at resolved path, skipping bundle')
  }
} catch (e) {
  console.warn('Claude CLI bundle failed:', e.message || e)
  console.warn('App will try online install at runtime')
}
