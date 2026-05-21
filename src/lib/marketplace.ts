/**
 * Plugin marketplace — Claude Code-compatible plugin discovery.
 *
 * Marketplace format reverse-engineered from public ECC-style repos:
 *  - repo root: `.claude-plugin/marketplace.json` lists plugins with `source` paths
 *  - each plugin's source dir: `.claude-plugin/plugin.json` lists `skills`, `commands`, etc.
 *  - skills are .md files with YAML-ish frontmatter (`name`, `description`) + body
 *
 * Only skill-shaped contributions are persisted today; mcpServers / commands are
 * parsed but skipped at install time (call-out future work).
 */

const MARKETPLACES_KEY = 'simple-ai:marketplaces'
const INSTALLED_PLUGINS_KEY = 'simple-ai:installed-plugins'

export interface PluginEntry {
  name: string
  /** Relative path inside the marketplace repo (e.g. "./" or "./plugins/foo") */
  source: string
  description?: string
  version?: string
  author?: { name?: string; email?: string; url?: string }
  homepage?: string
  repository?: string
  license?: string
  keywords?: string[]
  category?: string
  tags?: string[]
  strict?: boolean
}

export interface MarketplaceManifest {
  /** marketplace logical name (from manifest) */
  name: string
  owner?: { name?: string; email?: string }
  metadata?: { description?: string }
  plugins: PluginEntry[]
}

export interface Marketplace {
  /** stable client id (we generate) */
  id: string
  /** GitHub repo URL the user added */
  url: string
  /** parsed owner/repo/ref */
  owner: string
  repo: string
  ref: string
  /** last successful manifest fetch */
  manifest?: MarketplaceManifest
  fetchedAt?: number
  /** last fetch error if any */
  error?: string
}

export interface InstalledPlugin {
  marketplaceId: string
  pluginName: string
  version?: string
  installedAt: number
  /** Names of CustomSkill entries created by this install (so we can remove them on uninstall). */
  skillNames: string[]
}

function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function parseGithubUrl(url: string): { owner: string; repo: string; ref: string } | null {
  try {
    const trimmed = url.trim().replace(/\.git$/, '').replace(/\/+$/, '')
    const u = new URL(trimmed)
    if (!/^github\.com$/i.test(u.hostname)) return null
    // /owner/repo[/tree/<ref>]
    const parts = u.pathname.split('/').filter(Boolean)
    if (parts.length < 2) return null
    const [owner, repo] = parts
    let ref = 'main'
    if (parts.length >= 4 && parts[2] === 'tree') ref = parts[3]
    return { owner, repo, ref }
  } catch {
    return null
  }
}

/** Build a raw.githubusercontent.com URL for a path within a repo at a given ref. */
export function rawUrl(owner: string, repo: string, ref: string, path: string): string {
  const clean = path.replace(/^\.?\/+/, '').replace(/\/+/g, '/')
  return `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${clean}`
}

/** GitHub Contents API URL — used to list files in a directory (so we can discover skills). */
export function contentsApiUrl(owner: string, repo: string, ref: string, path: string): string {
  const clean = path.replace(/^\.?\/+/, '').replace(/\/+/g, '/')
  return `https://api.github.com/repos/${owner}/${repo}/contents/${clean}?ref=${encodeURIComponent(ref)}`
}

/* ---- localStorage CRUD ---- */

export function loadMarketplaces(): Marketplace[] {
  try {
    const raw = localStorage.getItem(MARKETPLACES_KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as Marketplace[]
    return Array.isArray(list) ? list : []
  } catch { return [] }
}

function persistMarketplaces(list: Marketplace[]): void {
  localStorage.setItem(MARKETPLACES_KEY, JSON.stringify(list))
}

export function upsertMarketplace(m: Marketplace): Marketplace[] {
  const list = loadMarketplaces()
  const idx = list.findIndex(x => x.id === m.id || (x.owner === m.owner && x.repo === m.repo))
  if (idx >= 0) list[idx] = m
  else list.unshift(m)
  persistMarketplaces(list)
  return list
}

export function deleteMarketplace(id: string): Marketplace[] {
  const list = loadMarketplaces().filter(m => m.id !== id)
  persistMarketplaces(list)
  return list
}

export function addMarketplaceFromUrl(url: string): Marketplace | null {
  const parsed = parseGithubUrl(url)
  if (!parsed) return null
  const existing = loadMarketplaces().find(m => m.owner === parsed.owner && m.repo === parsed.repo)
  if (existing) return existing
  const m: Marketplace = {
    id: genId(),
    url,
    owner: parsed.owner,
    repo: parsed.repo,
    ref: parsed.ref,
  }
  upsertMarketplace(m)
  return m
}

/** Display name preferring manifest name, falling back to owner/repo. */
export function marketplaceDisplayName(m: Marketplace): string {
  return m.manifest?.name || `${m.owner}/${m.repo}`
}

/* ---- Installed plugins CRUD ---- */

export function loadInstalledPlugins(): InstalledPlugin[] {
  try {
    const raw = localStorage.getItem(INSTALLED_PLUGINS_KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as InstalledPlugin[]
    return Array.isArray(list) ? list : []
  } catch { return [] }
}

function persistInstalled(list: InstalledPlugin[]): void {
  localStorage.setItem(INSTALLED_PLUGINS_KEY, JSON.stringify(list))
}

export function isInstalled(marketplaceId: string, pluginName: string): boolean {
  return loadInstalledPlugins().some(p => p.marketplaceId === marketplaceId && p.pluginName === pluginName)
}

export function recordInstall(p: InstalledPlugin): InstalledPlugin[] {
  const list = loadInstalledPlugins().filter(
    x => !(x.marketplaceId === p.marketplaceId && x.pluginName === p.pluginName)
  )
  list.unshift(p)
  persistInstalled(list)
  return list
}

export function recordUninstall(marketplaceId: string, pluginName: string): InstalledPlugin[] {
  const list = loadInstalledPlugins().filter(
    p => !(p.marketplaceId === marketplaceId && p.pluginName === pluginName)
  )
  persistInstalled(list)
  return list
}

/* ---- Frontmatter parser for skill .md files ----
 * Skills typically lead with `---\nname: ...\ndescription: ...\n---\n<body>`.
 * We parse YAML-ish key:value lines (no full YAML to avoid dragging in a dep).
 */
export interface ParsedSkill {
  name: string
  description: string
  content: string
}

export function parseSkillMarkdown(filename: string, raw: string): ParsedSkill | null {
  const m = /^---\n([\s\S]+?)\n---\n?([\s\S]*)$/.exec(raw)
  const meta: Record<string, string> = {}
  let body = raw
  if (m) {
    body = m[2]
    for (const line of m[1].split('\n')) {
      const kv = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line.trim())
      if (kv) meta[kv[1]] = kv[2].trim().replace(/^['"]|['"]$/g, '')
    }
  }
  const name = meta.name || filename.replace(/\.md$/i, '')
  const description = meta.description || ''
  if (!name) return null
  return { name, description, content: body.trim() }
}

/* ---- Network helpers (Electron IPC; falls back to direct fetch in Web mode) ---- */

interface FetchResult { ok: boolean; status?: number; body?: string; error?: string }

async function fetchText(url: string, accept = 'application/json'): Promise<FetchResult> {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const api = (window as any).electronAPI
  if (api?.marketplaceFetch) {
    return await api.marketplaceFetch({ url, accept })
  }
  // Web fallback — may hit CORS for non-GitHub origins.
  try {
    const r = await fetch(url, { headers: { Accept: accept } })
    const body = await r.text()
    return { ok: r.ok, status: r.status, body }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

/* ---- High-level operations: refresh manifest / install / uninstall ---- */

/** Pull <repo>/.claude-plugin/marketplace.json and persist into the Marketplace record. */
export async function refreshMarketplace(m: Marketplace): Promise<Marketplace> {
  const url = rawUrl(m.owner, m.repo, m.ref, '.claude-plugin/marketplace.json')
  const r = await fetchText(url)
  if (!r.ok || !r.body) {
    const updated: Marketplace = { ...m, error: r.error || `HTTP ${r.status}`, fetchedAt: Date.now() }
    upsertMarketplace(updated)
    return updated
  }
  try {
    const manifest = JSON.parse(r.body) as MarketplaceManifest
    if (!Array.isArray(manifest.plugins)) throw new Error('marketplace.json 缺少 plugins[] 字段')
    const updated: Marketplace = { ...m, manifest, fetchedAt: Date.now(), error: undefined }
    upsertMarketplace(updated)
    return updated
  } catch (e) {
    const updated: Marketplace = { ...m, error: `manifest 解析失败：${(e as Error).message}`, fetchedAt: Date.now() }
    upsertMarketplace(updated)
    return updated
  }
}

/** Plugin manifest as written inside `<plugin source>/.claude-plugin/plugin.json`. */
interface PluginManifest {
  name?: string
  version?: string
  description?: string
  skills?: string[]
  commands?: string[]
  mcpServers?: Record<string, unknown>
}

interface InstallReport {
  ok: boolean
  installedSkillNames: string[]
  skippedReasons: string[]
  errors: string[]
}

/**
 * Install a plugin into the user's CustomSkill list.
 *
 * Scans every directory listed under `plugin.json#skills[]` via the GitHub
 * Contents API, downloads each .md file, parses YAML-ish frontmatter, and
 * appends to `config.customSkills` (caller is responsible for `saveConfig`).
 */
export async function installPlugin(
  marketplace: Marketplace,
  plugin: PluginEntry,
  existingSkillNames: string[],
): Promise<{ skills: ParsedSkill[]; report: InstallReport }> {
  const report: InstallReport = { ok: false, installedSkillNames: [], skippedReasons: [], errors: [] }
  const out: ParsedSkill[] = []

  // Resolve plugin.json
  const pluginJsonPath = joinPath(plugin.source, '.claude-plugin/plugin.json')
  const pjUrl = rawUrl(marketplace.owner, marketplace.repo, marketplace.ref, pluginJsonPath)
  const pjResp = await fetchText(pjUrl)
  if (!pjResp.ok || !pjResp.body) {
    report.errors.push(`未找到 plugin.json：${pjResp.error || `HTTP ${pjResp.status}`}`)
    return { skills: out, report }
  }
  let pluginManifest: PluginManifest
  try {
    pluginManifest = JSON.parse(pjResp.body)
  } catch (e) {
    report.errors.push(`plugin.json 解析失败：${(e as Error).message}`)
    return { skills: out, report }
  }

  const skillDirs = pluginManifest.skills || []
  if (skillDirs.length === 0) {
    report.errors.push('该 plugin 未声明 skills/，未提供可安装的 skill 内容。')
    return { skills: out, report }
  }

  if (pluginManifest.commands?.length) {
    report.skippedReasons.push(`已跳过 ${pluginManifest.commands.length} 个 command（暂不支持）`)
  }
  if (pluginManifest.mcpServers && Object.keys(pluginManifest.mcpServers).length) {
    report.skippedReasons.push(`已跳过 ${Object.keys(pluginManifest.mcpServers).length} 个 mcpServer 配置（请到 MCP 页手动添加）`)
  }

  for (const dir of skillDirs) {
    const absDir = joinPath(plugin.source, dir)
    const apiUrl = contentsApiUrl(marketplace.owner, marketplace.repo, marketplace.ref, absDir)
    const listResp = await fetchText(apiUrl, 'application/vnd.github+json')
    if (!listResp.ok || !listResp.body) {
      report.errors.push(`列出 ${absDir} 失败：${listResp.error || `HTTP ${listResp.status}`}`)
      continue
    }
    let entries: Array<{ name: string; path: string; type: string }>
    try {
      entries = JSON.parse(listResp.body)
    } catch (e) {
      report.errors.push(`${absDir} 响应非法 JSON：${(e as Error).message}`)
      continue
    }
    if (!Array.isArray(entries)) {
      report.errors.push(`${absDir} 不是目录`)
      continue
    }

    // Process .md files at this level. Nested skill dirs are handled by `SKILL.md` files
    // (Claude Code convention: a skill is a folder containing SKILL.md).
    const skillMdFiles: Array<{ name: string; path: string }> = []
    for (const e of entries) {
      if (e.type === 'file' && /\.md$/i.test(e.name)) {
        skillMdFiles.push({ name: e.name, path: e.path })
      } else if (e.type === 'dir') {
        // Probe for SKILL.md inside this folder
        const skillMdPath = `${e.path}/SKILL.md`
        skillMdFiles.push({ name: `${e.name}.md`, path: skillMdPath })
      }
    }

    for (const f of skillMdFiles) {
      const fileUrl = rawUrl(marketplace.owner, marketplace.repo, marketplace.ref, f.path)
      const fileResp = await fetchText(fileUrl, 'text/plain')
      if (!fileResp.ok || !fileResp.body) {
        // Silently skip — SKILL.md probes are expected to miss for plain folders
        continue
      }
      const parsed = parseSkillMarkdown(f.name, fileResp.body)
      if (!parsed) continue
      // Disambiguate against pre-existing user skills
      let finalName = parsed.name
      let suffix = 2
      while (existingSkillNames.includes(finalName)) {
        finalName = `${parsed.name}-${suffix++}`
      }
      out.push({ ...parsed, name: finalName })
    }
  }

  if (out.length === 0) {
    report.errors.push('未发现任何可安装的 .md / SKILL.md 文件')
    return { skills: out, report }
  }

  report.ok = true
  report.installedSkillNames = out.map(s => s.name)
  return { skills: out, report }
}

function joinPath(...parts: string[]): string {
  const all = parts.flatMap(p => p.split('/').filter(Boolean))
  return all.join('/')
}

