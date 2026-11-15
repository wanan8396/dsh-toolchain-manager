/**
 * Host half of @local/toolchain-manager.
 *
 * One JSON API on the existing DSH web server, backing the Settings section:
 *
 *   GET  /plugins/toolchain-manager/overview        – dependency root, sizes, toolchains
 *   GET  /plugins/toolchain-manager/packages?kind=  – npm global or pip packages
 *   POST /plugins/toolchain-manager/run             – allowlisted maintenance action
 *
 * Every command runs through execFile (never a shell) with a fixed allowlist of
 * argv shapes, a working directory inside the dependency root and a timeout.
 * Package names are validated before they reach argv.
 */

import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

/** Stable cordis plugin name — must equal the package name. */
export const name = '@local/toolchain-manager'

/** The HTTP carrier is the only Host service this plugin needs. */
export const inject = ['webServer']

const BASE = '/plugins/toolchain-manager'
const MAX_BODY_BYTES = 256 * 1024
const COMMAND_TIMEOUT_MS = 180_000
const MAX_OUTPUT_CHARS = 12_000
const PACKAGE_PATTERN = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*(?:\[[a-z0-9,_-]+\])?$/i
const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9.+_-]*$/
const VENV_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

class HttpError extends Error {
  constructor(status, message, code = 'E_REQUEST') {
    super(message)
    this.status = status
    this.code = code
  }
}

function report(message) {
  try {
    process.stderr.write(`@local/toolchain-manager: ${message}\n`)
  } catch {
    // Registration is still observable through the routes.
  }
}

function dependencyRoot() {
  const configured = typeof process.env.DSH_DEPENDENCY_ROOT === 'string' ? process.env.DSH_DEPENDENCY_ROOT.trim() : ''
  if (configured !== '') return path.resolve(configured)
  return path.resolve(os.homedir(), '.local', 'share', 'deepseek-harness', 'dependencies')
}

const ROOT_ROLES = [
  ['downloads', '下载归档'],
  ['sources', '源码与插件'],
  ['build', '编译输出'],
  ['cache', '缓存'],
  ['tmp', '临时文件'],
  ['bin', '独立可执行工具'],
  ['npm', 'npm 全局前缀'],
  ['python', 'pip 用户安装'],
  ['venvs', 'Python venv'],
  ['cargo', 'Rust CARGO_HOME'],
  ['go', 'GOPATH'],
  ['rustup', 'RUSTUP_HOME'],
  ['backups', '备份'],
]

/** Environment variables the plugin reports; values are path-like only. */
const ENV_KEYS = [
  'DSH_DEPENDENCY_ROOT',
  'NPM_CONFIG_PREFIX',
  'NPM_CONFIG_CACHE',
  'NPM_CONFIG_DEVDIR',
  'PIP_CACHE_DIR',
  'PYTHONUSERBASE',
  'CARGO_HOME',
  'RUSTUP_HOME',
  'GOPATH',
  'GOMODCACHE',
  'GOCACHE',
  'CCACHE_DIR',
]

const TOOLS = [
  { id: 'node', label: 'Node.js', command: 'node', args: ['--version'] },
  { id: 'npm', label: 'npm', command: 'npm', args: ['--version'] },
  { id: 'pnpm', label: 'pnpm', command: 'pnpm', args: ['--version'] },
  { id: 'python3', label: 'Python', command: 'python3', args: ['--version'] },
  { id: 'pip', label: 'pip', command: 'python3', args: ['-m', 'pip', '--version'] },
  { id: 'git', label: 'Git', command: 'git', args: ['--version'] },
  { id: 'gcc', label: 'GCC', command: 'gcc', args: ['--version'] },
  { id: 'make', label: 'GNU Make', command: 'make', args: ['--version'] },
  { id: 'cargo', label: 'Cargo', command: 'cargo', args: ['--version'] },
  { id: 'rustc', label: 'rustc', command: 'rustc', args: ['--version'] },
  { id: 'go', label: 'Go', command: 'go', args: ['version'] },
  { id: 'java', label: 'Java', command: 'java', args: ['-version'] },
]

function clip(text) {
  const value = String(text === undefined || text === null ? '' : text)
  return value.length > MAX_OUTPUT_CHARS ? `…${value.slice(-MAX_OUTPUT_CHARS)}` : value
}

/**
 * Run one argv without a shell.
 * @param {string} command - executable name.
 * @param {string[]} args - argv.
 * @param {object} [options]
 * @returns {Promise<{ok: boolean, code: number|null, stdout: string, stderr: string, command: string, durationMs: number}>}
 */
function run(command, args, options = {}) {
  const started = Date.now()
  const cwd = existsSync(dependencyRoot()) ? dependencyRoot() : process.cwd()
  return new Promise((resolve) => {
    execFile(
      command,
      args,
      {
        cwd: options.cwd || cwd,
        env: process.env,
        timeout: options.timeout || COMMAND_TIMEOUT_MS,
        maxBuffer: 8 * 1024 * 1024,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        const code = error === null ? 0 : typeof error.code === 'number' ? error.code : null
        resolve({
          ok: error === null,
          code,
          stdout: clip(stdout),
          stderr: clip(stderr || (error && error.message) || ''),
          command: [command, ...args].join(' '),
          durationMs: Date.now() - started,
        })
      },
    )
  })
}

function firstLine(text) {
  const line = String(text || '').trim().split(/\r?\n/).find((item) => item.trim() !== '')
  return line === undefined ? '' : line.trim()
}

async function whichCommand(command) {
  const result = await run('sh', ['-c', `command -v ${command} 2>/dev/null || true`])
  return firstLine(result.stdout)
}

async function probeTools() {
  const results = await Promise.all(
    TOOLS.map(async (tool) => {
      const where = await whichCommand(tool.command)
      if (where === '') {
        return {
          id: tool.id,
          label: tool.label,
          present: false,
          version: '',
          command: [tool.command, ...tool.args].join(' '),
          path: '',
        }
      }
      const result = await run(tool.command, tool.args, { timeout: 15_000 })
      return {
        id: tool.id,
        label: tool.label,
        present: true,
        version: firstLine(`${result.stdout}\n${result.stderr}`),
        command: [tool.command, ...tool.args].join(' '),
        path: where,
      }
    }),
  )
  return results
}

async function directoryBytes(target) {
  if (!existsSync(target)) return 0
  const result = await run('du', ['-sb', target], { timeout: 60_000 })
  if (result.ok) {
    const [size] = result.stdout.trim().split(/\s+/)
    const parsed = Number(size)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

async function rootUsage() {
  const root = dependencyRoot()
  const rows = []
  let total = 0
  for (const [name, role] of ROOT_ROLES) {
    const target = path.join(root, name)
    if (!existsSync(target)) continue
    const bytes = await directoryBytes(target)
    total += bytes
    rows.push({ name, role, path: target, bytes })
  }
  const entries = await directoryBytes(root)
  return { root, rows, total, entries }
}

async function readJsonFile(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'))
  } catch {
    return fallback
  }
}

function assertPackage(name) {
  const value = String(name || '').trim()
  if (!PACKAGE_PATTERN.test(value)) {
    throw new HttpError(400, `包名不合法：${value || '(空)'}`, 'E_PACKAGE')
  }
  return value
}

function assertVersion(version) {
  if (version === undefined || version === null || version === '') return ''
  const value = String(version).trim()
  if (!VERSION_PATTERN.test(value)) throw new HttpError(400, `版本号不合法：${value}`, 'E_VERSION')
  return value
}

function venvPath(name) {
  if (name === undefined || name === null || name === '') return ''
  const value = String(name).trim()
  if (!VENV_PATTERN.test(value)) throw new HttpError(400, `venv 名称不合法：${value}`, 'E_VENV')
  return path.join(dependencyRoot(), 'venvs', value)
}

async function listVenvs() {
  const dir = path.join(dependencyRoot(), 'venvs')
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }
  const rows = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const target = path.join(dir, entry.name)
    const python = path.join(target, 'bin', 'python')
    rows.push({ name: entry.name, path: target, python, ready: existsSync(python) })
  }
  rows.sort((left, right) => left.name.localeCompare(right.name))
  return rows
}

/** `npm ls -g --depth=0 --json --prefix P` → [{name, version, prefix}] */
async function npmListAt(prefix) {
  const args = ['ls', '-g', '--depth=0', '--json']
  if (prefix !== '') args.push('--prefix', prefix)
  const result = await run('npm', args, { timeout: 60_000 })
  let parsed = null
  try {
    parsed = JSON.parse(result.stdout)
  } catch {
    parsed = null
  }
  const dependencies = parsed !== null && typeof parsed.dependencies === 'object' && parsed.dependencies !== null
    ? parsed.dependencies
    : {}
  const rows = Object.entries(dependencies).map(([pkgName, info]) => ({
    name: pkgName,
    version: typeof info === 'object' && info !== null && typeof info.version === 'string' ? info.version : '',
    description: typeof info === 'object' && info !== null && typeof info.description === 'string' ? info.description : '',
    prefix,
  }))
  const noise = /^npm (?:warn|notice)\b.*$/gm
  const cleaned = String(result.stderr || result.stdout || '').replace(noise, '').trim()
  const emptyPrefix = rows.length === 0 && cleaned.includes('ENOENT') && cleaned.includes('/lib')
  return { rows, raw: emptyPrefix || result.ok ? '' : cleaned.slice(0, 2000) }
}

/**
 * Global packages from both the configured prefix and the OS default one, so a
 * tool installed before DSH set NPM_CONFIG_PREFIX is still visible.
 */
async function listNpm() {
  const prefixes = []
  const configured = process.env.NPM_CONFIG_PREFIX || ''
  if (configured !== '') prefixes.push(configured)
  if (!prefixes.includes('/usr/local')) prefixes.push('/usr/local')
  const merged = new Map()
  const notes = []
  for (const prefix of prefixes) {
    const listed = await npmListAt(prefix)
    if (listed.raw !== '') notes.push(listed.raw)
    for (const row of listed.rows) {
      if (!merged.has(row.name)) merged.set(row.name, row)
    }
  }
  const rows = Array.from(merged.values())
  rows.sort((left, right) => left.name.localeCompare(right.name))
  return { rows, prefix: configured, prefixes, raw: notes.join('\n').slice(0, 2000) }
}

/** pip list --format=json for the user install or one venv */
async function listPip(venv) {
  const target = venvPath(venv)
  const args = target === '' ? ['-m', 'pip', 'list', '--user', '--format=json'] : ['-m', 'pip', 'list', '--format=json']
  const command = target === '' ? 'python3' : path.join(target, 'bin', 'python')
  const result = await run(command, args, { timeout: 90_000 })
  let parsed = null
  try {
    parsed = JSON.parse(result.stdout)
  } catch {
    parsed = null
  }
  const rows = Array.isArray(parsed)
    ? parsed.map((entry) => ({
      name: String(entry && entry.name ? entry.name : ''),
      version: String(entry && entry.version ? entry.version : ''),
    }))
    : []
  rows.sort((left, right) => left.name.localeCompare(right.name))
  return { rows, venv: venv || '', scope: target === '' ? 'user' : 'venv', raw: result.ok ? '' : result.stderr }
}

const ACTIONS = {
  'npm-install': (input) => {
    const pkg = assertPackage(input.name)
    const version = assertVersion(input.version)
    return ['npm', ['install', '-g', version === '' ? pkg : `${pkg}@${version}`]]
  },
  'npm-uninstall': (input) => ['npm', ['uninstall', '-g', assertPackage(input.name)]],
  'npm-cache-clean': () => ['npm', ['cache', 'clean', '--force']],
  'pip-install': (input) => {
    const pkg = assertPackage(input.name)
    const version = assertVersion(input.version)
    const spec = version === '' ? pkg : `${pkg}==${version}`
    const target = venvPath(input.venv)
    return target === ''
      ? ['python3', ['-m', 'pip', 'install', '--user', spec]]
      : [path.join(target, 'bin', 'python'), ['-m', 'pip', 'install', spec]]
  },
  'pip-uninstall': (input) => {
    const pkg = assertPackage(input.name)
    const target = venvPath(input.venv)
    return target === ''
      ? ['python3', ['-m', 'pip', 'uninstall', '-y', pkg]]
      : [path.join(target, 'bin', 'python'), ['-m', 'pip', 'uninstall', '-y', pkg]]
  },
  'pip-cache-purge': () => ['python3', ['-m', 'pip', 'cache', 'purge']],
  'venv-create': (input) => {
    const target = venvPath(input.name)
    if (target === '') throw new HttpError(400, '需要 venv 名称', 'E_VENV')
    return ['python3', ['-m', 'venv', target]]
  },
  'venv-remove': (input) => {
    const target = venvPath(input.name)
    if (target === '') throw new HttpError(400, '需要 venv 名称', 'E_VENV')
    return ['rm', ['-rf', target]]
  },
  'go-clean': () => ['go', ['clean', '-cache']],
  'ccache-clear': () => ['ccache', ['-C']],
  'tmp-clean': () => ['find', [path.join(dependencyRoot(), 'tmp'), '-mindepth', '1', '-maxdepth', '2', '-mtime', '+3', '-delete']],
}

const CLEANABLE = ['cache', 'downloads', 'build', 'tmp']

/** Empty one cache/document directory and recreate it, without a shell. */
async function cleanDirectory(input) {
  const name = String(input.name || '').trim()
  if (!CLEANABLE.includes(name)) {
    throw new HttpError(403, `只允许清空：${CLEANABLE.join('、')}`, 'E_SCOPE')
  }
  const target = path.join(dependencyRoot(), name)
  const started = Date.now()
  await rm(target, { recursive: true, force: true })
  await mkdir(target, { recursive: true })
  return {
    ok: true,
    code: 0,
    stdout: `emptied ${target}`,
    stderr: '',
    command: `rm -rf ${target} && mkdir -p ${target}`,
    durationMs: Date.now() - started,
    action: 'dir-clean',
  }
}

async function runAction(input) {
  const action = String(input.action || '')
  if (action === 'dir-clean') return cleanDirectory(input)
  const factory = ACTIONS[action]
  if (factory === undefined) throw new HttpError(400, `未知操作：${action}`, 'E_ACTION')
  const [command, args] = factory(input)
  const result = await run(command, args, { timeout: COMMAND_TIMEOUT_MS })
  return { ...result, action }
}

async function readJson(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) throw new HttpError(413, '请求体过大', 'E_TOO_LARGE')
    chunks.push(chunk)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  if (text.trim() === '') return {}
  try {
    return JSON.parse(text)
  } catch {
    throw new HttpError(400, '请求体不是合法 JSON', 'E_JSON')
  }
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'content-length': Buffer.byteLength(body),
  })
  res.end(body)
}

function sameOrigin(req) {
  const site = req.headers['sec-fetch-site']
  return site === undefined || site === 'same-origin' || site === 'same-site' || site === 'none'
}

async function overview() {
  const [usage, tools, venvs] = await Promise.all([rootUsage(), probeTools(), listVenvs()])
  const env = {}
  for (const key of ENV_KEYS) {
    const value = process.env[key]
    if (typeof value === 'string' && value !== '') env[key] = value
  }
  return {
    ok: true,
    root: usage.root,
    rows: usage.rows,
    total: usage.total,
    entries: usage.entries,
    tools,
    venvs,
    env,
    platform: `${process.platform} ${process.arch}`,
    versions: { node: process.versions.node, dsh: process.env.DSH_VERSION || '' },
  }
}

async function dispatch(req, res) {
  const url = new URL(req.url || '/', 'http://127.0.0.1')
  const route = url.pathname.slice(BASE.length).replace(/\/+$/, '')
  const method = (req.method || 'GET').toUpperCase()

  if (route === '/overview') {
    if (method !== 'GET' && method !== 'HEAD') {
      res.setHeader('allow', 'GET, HEAD')
      sendJson(res, 405, { ok: false, error: `不支持 ${method}`, code: 'E_METHOD' })
      return
    }
    sendJson(res, 200, await overview())
    return
  }

  if (route === '/packages') {
    if (method !== 'GET' && method !== 'HEAD') {
      res.setHeader('allow', 'GET, HEAD')
      sendJson(res, 405, { ok: false, error: `不支持 ${method}`, code: 'E_METHOD' })
      return
    }
    const kind = url.searchParams.get('kind') || 'npm'
    if (kind === 'npm') {
      const npm = await listNpm()
      sendJson(res, 200, { ok: true, kind, ...npm })
      return
    }
    if (kind === 'pip') {
      const pip = await listPip(url.searchParams.get('venv') || '')
      sendJson(res, 200, { ok: true, kind, ...pip })
      return
    }
    throw new HttpError(400, `未知包类型：${kind}`, 'E_KIND')
  }

  if (route === '/run') {
    if (method !== 'POST') {
      res.setHeader('allow', 'POST')
      sendJson(res, 405, { ok: false, error: `不支持 ${method}`, code: 'E_METHOD' })
      return
    }
    if (!sameOrigin(req)) {
      sendJson(res, 403, { ok: false, error: '拒绝跨站请求', code: 'E_ORIGIN' })
      return
    }
    const body = await readJson(req)
    sendJson(res, 200, { ok: true, ...(await runAction(body)) })
    return
  }

  sendJson(res, 404, { ok: false, error: 'unknown endpoint', code: 'E_NOT_FOUND' })
}

function handler(req, res) {
  dispatch(req, res).catch((error) => {
    const status = error instanceof HttpError ? error.status : 500
    if (!(error instanceof HttpError)) report(`request failed: ${(error && error.stack) || error}`)
    if (res.headersSent) {
      res.end()
      return
    }
    sendJson(res, status, {
      ok: false,
      error: (error && error.message) || 'internal error',
      code: error instanceof HttpError ? error.code : 'E_INTERNAL',
    })
  })
}

/**
 * Register the JSON API on the Host web server.
 * @param ctx - the plugin's Cordis context.
 */
export function apply(ctx) {
  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: BASE, handler }), 'toolchain-manager: routes')
  report(`routes ready at ${BASE}`)
}
