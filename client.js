window.__ModuleLoader__.load({
  id: '@local/toolchain-manager',
  factory(require) {
    'use strict'

    const React = require('react')
    const h = React.createElement

    const API = '/plugins/toolchain-manager'
    const NS = 'toolchainManager'
    const STYLE_ID = 'dtm-toolchain-manager-style'
    const SECTION_ID = 'toolchains'

    /** One-tap catalogs: the common things people actually install. */
    const NPM_PRESETS = [
      'pnpm', 'typescript', 'tsx', 'eslint', 'prettier',
      'nodemon', 'serve', 'vite', 'sass', 'cross-env',
    ]
    const PIP_PRESETS = [
      'requests', 'httpx', 'numpy', 'pandas', 'beautifulsoup4',
      'lxml', 'pillow', 'rich', 'tqdm', 'python-dotenv',
    ]
    /** Only these hold regenerable data; everything else stays protected. */
    const CLEANABLE = ['cache', 'downloads', 'build', 'tmp']
    const DIR_NAMES = [
      'downloads', 'sources', 'build', 'cache', 'tmp', 'bin',
      'npm', 'python', 'venvs', 'cargo', 'go', 'rustup', 'backups',
    ]

    const zh = {
      'section.label': '编译链依赖',
      'section.title': '编译链与依赖',
      'section.subtitle': '一键安装常用依赖，装完可随时删除',
      'common.refresh': '刷新',
      'common.cancel': '取消',
      'common.remove': '删除',
      'common.removing': '删除中…',
      'common.install': '安装',
      'common.installing': '安装中…',
      'common.running': '清理中…',
      'common.loading': '读取中…',
      'common.empty': '还没有装任何依赖',
      'installed.title': '已安装',
      'installed.npm': 'npm',
      'installed.pip': 'pip',
      'installed.count': '{count} 个',
      'installed.scopeUser': '用户',
      'presets.title': '一键安装',
      'presets.hint': '点一下就开始装，不用输入名字；已装的会标出来。',
      'presets.done': '已装',
      'presets.custom': '自定义…',
      'presets.customName': '包名',
      'presets.customInstall': '安装',
      'clean.title': '依赖目录',
      'clean.protected': '受保护',
      'dir.downloads': '下载归档',
      'dir.sources': '源码与插件',
      'dir.build': '编译输出',
      'dir.cache': '缓存',
      'dir.tmp': '临时文件',
      'dir.bin': '独立工具',
      'dir.npm': 'npm 全局前缀',
      'dir.python': 'pip 用户安装',
      'dir.venvs': 'Python venv',
      'dir.cargo': 'Rust 缓存',
      'dir.go': 'Go 目录',
      'dir.rustup': 'Rustup 工具链',
      'dir.backups': '备份',
      'clean.total': '合计 {size}',
      'clean.action': '清空',
      'clean.confirm': '确认清空？',
      'tools.title': '工具链',
      'tools.missing': '未装',
      'log.title': '最近一次操作',
      'log.empty': '还没有执行过操作',
      'notice.done': '完成：{command}',
      'notice.failed': '失败（{code}）：{command}',
      'error.prefix': '操作失败：',
      'error.name': '请先填写包名',
    }

    const en = {
      'section.label': 'Toolchain',
      'section.title': 'Toolchain & dependencies',
      'section.subtitle': 'One-tap installs for common dependencies, delete any of them later',
      'common.refresh': 'Refresh',
      'common.cancel': 'Cancel',
      'common.remove': 'Delete',
      'common.removing': 'Deleting…',
      'common.install': 'Install',
      'common.installing': 'Installing…',
      'common.running': 'Cleaning…',
      'common.loading': 'Loading…',
      'common.empty': 'Nothing installed yet',
      'installed.title': 'Installed',
      'installed.npm': 'npm',
      'installed.pip': 'pip',
      'installed.count': '{count}',
      'installed.scopeUser': 'User',
      'presets.title': 'One-tap install',
      'presets.hint': 'Tap to install — no typing; installed ones are marked.',
      'presets.done': 'Installed',
      'presets.custom': 'Custom…',
      'presets.customName': 'Package',
      'presets.customInstall': 'Install',
      'clean.title': 'Dependency folders',
      'clean.protected': 'Protected',
      'dir.downloads': 'Downloads',
      'dir.sources': 'Sources & plugins',
      'dir.build': 'Build output',
      'dir.cache': 'Caches',
      'dir.tmp': 'Temp files',
      'dir.bin': 'Standalone tools',
      'dir.npm': 'npm global prefix',
      'dir.python': 'pip user install',
      'dir.venvs': 'Python venvs',
      'dir.cargo': 'Rust cache',
      'dir.go': 'Go directory',
      'dir.rustup': 'Rustup toolchains',
      'dir.backups': 'Backups',
      'clean.total': '{size} total',
      'clean.action': 'Empty',
      'clean.confirm': 'Empty it?',
      'tools.title': 'Toolchains',
      'tools.missing': 'missing',
      'log.title': 'Last action',
      'log.empty': 'No action yet',
      'notice.done': 'Done: {command}',
      'notice.failed': 'Failed ({code}): {command}',
      'error.prefix': 'Failed: ',
      'error.name': 'Enter a package name first',
    }

    const formatBytes = (bytes) => {
      const value = Number(bytes) || 0
      if (value < 1024) return `${value} B`
      const units = ['KB', 'MB', 'GB', 'TB']
      let size = value / 1024
      let index = 0
      while (size >= 1024 && index < units.length - 1) {
        size /= 1024
        index += 1
      }
      return `${size >= 10 ? size.toFixed(0) : size.toFixed(1)} ${units[index]}`
    }

    // ---------------------------------------------------------------- store

    const state = {
      overview: null,
      npm: null,
      pip: null,
      kind: 'npm',
      pipScope: '',
      loading: false,
      busy: '',
      error: '',
      notice: '',
      log: null,
      customOpen: false,
      customName: '',
      confirm: '',
    }

    const listeners = new Set()
    const emit = () => {
      for (const listener of Array.from(listeners)) listener()
    }
    const patch = (next) => {
      Object.assign(state, next)
      emit()
    }

    function useStore() {
      const [, force] = React.useReducer((value) => value + 1, 0)
      React.useEffect(() => {
        listeners.add(force)
        return () => {
          listeners.delete(force)
        }
      }, [])
      return state
    }

    // ------------------------------------------------------------------ api

    async function request(route, body) {
      const response = await fetch(API + route, {
        method: body === undefined ? 'GET' : 'POST',
        headers: body === undefined ? undefined : { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: 'same-origin',
        cache: 'no-store',
      })
      const text = await response.text()
      let payload = null
      try {
        payload = text === '' ? null : JSON.parse(text)
      } catch {
        payload = null
      }
      if (!response.ok || (payload !== null && payload.ok === false)) {
        throw new Error(payload !== null && payload.error ? payload.error : 'HTTP ' + response.status)
      }
      return payload === null ? {} : payload
    }

    const message = (t, error) => t('error.prefix') + (error && error.message ? error.message : String(error))

    async function loadPackages() {
      const [npm, pip] = await Promise.all([
        request('/packages?kind=npm'),
        request('/packages?kind=pip' + (state.pipScope === '' ? '' : `&venv=${encodeURIComponent(state.pipScope)}`)),
      ])
      patch({ npm, pip })
    }

    async function loadAll(t) {
      patch({ loading: true, error: '' })
      try {
        const overview = await request('/overview')
        patch({ overview })
        await loadPackages()
        patch({ loading: false })
      } catch (error) {
        patch({ loading: false, error: message(t, error) })
      }
    }

    async function act(t, action, extra, busyKey, refreshOverview) {
      patch({ busy: busyKey, error: '', notice: '' })
      try {
        const result = await request('/run', { action, ...(extra || {}) })
        patch({
          busy: '',
          log: result,
          notice: result.ok
            ? t('notice.done').replace('{command}', result.command)
            : t('notice.failed').replace('{code}', String(result.code)).replace('{command}', result.command),
        })
        await loadPackages()
        if (refreshOverview === true) {
          const overview = await request('/overview')
          patch({ overview })
        }
        return result
      } catch (error) {
        patch({ busy: '', error: message(t, error) })
        return null
      }
    }

    // ------------------------------------------------------------- artwork

    function Glyph(props) {
      const size = (props && props.size) || 16
      return h(
        'svg',
        { width: size, height: size, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': 'true', focusable: 'false' },
        h('rect', { x: 2, y: 2.6, width: 5.4, height: 1.9, rx: 0.6, fill: 'currentColor', opacity: 0.9 }),
        h('rect', { x: 2, y: 6.6, width: 7.4, height: 1.9, rx: 0.6, fill: 'currentColor', opacity: 0.65 }),
        h('rect', { x: 2, y: 10.6, width: 5.2, height: 1.9, rx: 0.6, fill: 'currentColor', opacity: 0.45 }),
        h('circle', { cx: 11.4, cy: 6.6, r: 3.1, stroke: 'currentColor', strokeWidth: 1.3 }),
        h('path', { d: 'M13.6 8.9l2 2', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round' }),
      )
    }

    function SectionIcon(props) {
      return h(Glyph, { size: (props && props.size) || 16 })
    }

    // ---------------------------------------------------------------- cards

    function Card(props) {
      return h(
        'section',
        { className: 'dtm-card' },
        h(
          'div',
          { className: 'dtm-card-head' },
          h('h2', { className: 'dtm-card-title' }, props.title),
          props.meta === undefined || props.meta === '' ? null : h('span', { className: 'dtm-meta' }, props.meta),
          props.aside === undefined ? null : props.aside,
        ),
        props.children,
      )
    }

    function InstalledCard(props) {
      const t = props.t
      const current = useStore()
      const list = current.kind === 'npm' ? current.npm : current.pip
      const rows = list === null ? [] : (list.rows || [])
      const venvs = current.overview === null ? [] : current.overview.venvs
      const kindButton = (kind, label) =>
        h(
          'button',
          {
            type: 'button',
            className: 'dtm-tab' + (current.kind === kind ? ' dtm-tab-on' : ''),
            onClick: () => patch({ kind }),
          },
          label,
        )
      return h(
        Card,
        {
          title: t('installed.title'),
          meta: t('installed.count').replace('{count}', String(rows.length)),
          aside: h(
            'div',
            { className: 'dtm-tabs' },
            kindButton('npm', t('installed.npm')),
            kindButton('pip', t('installed.pip')),
          ),
        },
        current.kind === 'pip'
          ? h(
            'div',
            { className: 'dtm-row' },
            h(
              'select',
              {
                className: 'dtm-select',
                value: current.pipScope,
                onChange: (event) => {
                  patch({ pipScope: event.currentTarget.value })
                  void loadPackages().catch((error) => patch({ error: message(t, error) }))
                },
              },
              h('option', { value: '' }, t('installed.scopeUser')),
              venvs.map((venv) => h('option', { key: venv.name, value: venv.name }, `venv: ${venv.name}`)),
            ),
          )
          : null,
        h(
          'div',
          { className: 'dtm-list' },
          rows.length > 0
            ? rows.map((row) =>
              h(
                'div',
                { className: 'dtm-item', key: row.name },
                h(
                  'div',
                  { className: 'dtm-item-main' },
                  h('span', { className: 'dtm-item-name' }, row.name),
                  h('span', { className: 'dtm-item-version' }, row.version),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'dtm-btn dtm-small dtm-danger',
                    disabled: current.busy === `uninstall:${row.name}`,
                    onClick: () =>
                      void act(
                        t,
                        current.kind === 'npm' ? 'npm-uninstall' : 'pip-uninstall',
                        current.kind === 'npm' ? { name: row.name } : { name: row.name, venv: current.pipScope },
                        `uninstall:${row.name}`,
                        false,
                      ),
                  },
                  current.busy === `uninstall:${row.name}` ? t('common.removing') : t('common.remove'),
                ),
              ),
            )
            : h('p', { className: 'dtm-hint' }, current.loading ? t('common.loading') : t('common.empty')),
        ),
      )
    }

    function PresetsCard(props) {
      const t = props.t
      const current = useStore()
      const list = current.kind === 'npm' ? current.npm : current.pip
      const installed = new Set(list === null ? [] : (list.rows || []).map((row) => row.name.toLowerCase()))
      const presets = current.kind === 'npm' ? NPM_PRESETS : PIP_PRESETS
      const install = (name) =>
        void act(
          t,
          current.kind === 'npm' ? 'npm-install' : 'pip-install',
          current.kind === 'npm' ? { name } : { name, venv: current.pipScope },
          `install:${name}`,
          false,
        )
      return h(
        Card,
        { title: t('presets.title'), meta: current.kind === 'npm' ? 'npm' : 'pip' },
        h('p', { className: 'dtm-hint' }, t('presets.hint')),
        h(
          'div',
          { className: 'dtm-presets' },
          presets.map((name) =>
            h(
              'button',
              {
                key: name,
                type: 'button',
                className: 'dtm-preset' + (installed.has(name.toLowerCase()) ? ' dtm-preset-on' : ''),
                disabled: current.busy === `install:${name}`,
                onClick: () => install(name),
              },
              h('span', { className: 'dtm-preset-name' }, name),
              h(
                'span',
                { className: 'dtm-preset-state' },
                current.busy === `install:${name}`
                  ? t('common.installing')
                  : installed.has(name.toLowerCase())
                    ? t('presets.done')
                    : '＋',
              ),
            ),
          ),
        ),
        current.customOpen
          ? h(
            'div',
            { className: 'dtm-row' },
            h('input', {
              className: 'dtm-input',
              value: current.customName,
              placeholder: t('presets.customName'),
              spellCheck: false,
              onChange: (event) => patch({ customName: event.currentTarget.value }),
            }),
            h(
              'button',
              {
                type: 'button',
                className: 'dtm-btn dtm-primary',
                disabled: current.busy === 'install:custom',
                onClick: () => {
                  const name = state.customName.trim()
                  if (name === '') {
                    patch({ error: t('error.prefix') + t('error.name') })
                    return
                  }
                  void act(
                    t,
                    current.kind === 'npm' ? 'npm-install' : 'pip-install',
                    current.kind === 'npm' ? { name } : { name, venv: current.pipScope },
                    'install:custom',
                    false,
                  )
                },
              },
              t('presets.customInstall'),
            ),
            h('button', { type: 'button', className: 'dtm-btn', onClick: () => patch({ customOpen: false }) }, t('common.cancel')),
          )
          : h(
            'button',
            { type: 'button', className: 'dtm-btn dtm-small', onClick: () => patch({ customOpen: true }) },
            t('presets.custom'),
          ),
      )
    }

    function DependencyDirsCard(props) {
      const t = props.t
      const current = useStore()
      const overview = current.overview
      if (overview === null) return null
      const byName = new Map(overview.rows.map((row) => [row.name, row]))
      const rows = DIR_NAMES
        .map((name) => {
          const row = byName.get(name)
          return row === undefined ? null : row
        })
        .filter((row) => row !== null)
      for (const row of overview.rows) {
        if (!DIR_NAMES.includes(row.name)) rows.push(row)
      }
      return h(
        Card,
        { title: t('clean.title'), meta: t('clean.total').replace('{size}', formatBytes(overview.total)) },
        h(
          'div',
          { className: 'dtm-clean' },
          rows.map((row) => {
            const busyKey = `clean:${row.name}`
            const armed = current.confirm === busyKey
            const cleanable = CLEANABLE.includes(row.name)
            return h(
              'div',
              { className: 'dtm-clean-row', key: row.name },
              h('span', { className: 'dtm-clean-name' }, row.name),
              h(
                'span',
                { className: 'dtm-clean-role' },
                t('dir.' + row.name) === 'dir.' + row.name ? row.role : t('dir.' + row.name),
              ),
              h('span', { className: 'dtm-clean-size' }, formatBytes(row.bytes)),
              cleanable
                ? h(
                  'button',
                  {
                    type: 'button',
                    className: 'dtm-btn dtm-small' + (armed ? ' dtm-danger' : ''),
                    disabled: current.busy === busyKey,
                    onClick: () => {
                      if (!armed) {
                        patch({ confirm: busyKey })
                        return
                      }
                      patch({ confirm: '' })
                      void act(t, 'dir-clean', { name: row.name }, busyKey, true)
                    },
                  },
                  current.busy === busyKey ? t('common.running') : armed ? t('clean.confirm') : t('clean.action'),
                )
                : h(
                  'span',
                  { className: 'dtm-protected', title: '内含已安装插件/备份，避免误删' },
                  t('clean.protected'),
                ),
            )
          }),
        ),
      )
    }

    function ToolsCard(props) {
      const t = props.t
      const current = useStore()
      const overview = current.overview
      if (overview === null) return null
      return h(
        Card,
        { title: t('tools.title'), meta: overview.platform },
        h(
          'div',
          { className: 'dtm-chips' },
          overview.tools.map((tool) =>
            h(
              'span',
              { className: 'dtm-chip' + (tool.present ? '' : ' dtm-chip-off'), key: tool.id, title: tool.path || '' },
              h('span', { className: 'dtm-chip-name' }, tool.label),
              h(
                'span',
                { className: 'dtm-chip-value' },
                tool.present ? (tool.version || '').replace(/^[^0-9]*/, '') || '✓' : t('tools.missing'),
              ),
            ),
          ),
        ),
      )
    }

    function LogCard(props) {
      const t = props.t
      const current = useStore()
      const log = current.log
      if (log === null) return null
      return h(
        Card,
        { title: t('log.title'), meta: `${log.durationMs} ms` },
        h('div', { className: 'dtm-path' }, `$ ${log.command}`),
        log.stdout === '' ? null : h('pre', { className: 'dtm-pre' }, log.stdout),
        log.stderr === '' ? null : h('pre', { className: 'dtm-pre dtm-err' }, log.stderr),
      )
    }

    // ------------------------------------------------------------------ page

    function ToolchainSection(props) {
      const t = props.t
      const current = useStore()

      React.useEffect(() => {
        void loadAll(t)
      }, [])

      const body = []
      if (current.error !== '') body.push(h('div', { className: 'dtm-error', role: 'alert', key: 'error' }, current.error))
      if (current.notice !== '') body.push(h('div', { className: 'dtm-notice', role: 'status', key: 'notice' }, current.notice))
      if (current.overview === null && current.loading) {
        body.push(h('p', { className: 'dtm-hint', key: 'loading' }, t('common.loading')))
      }
      body.push(h(InstalledCard, { key: 'installed', t }))
      body.push(h(PresetsCard, { key: 'presets', t }))
      body.push(h(DependencyDirsCard, { key: 'dirs', t }))
      body.push(h(ToolsCard, { key: 'tools', t }))
      body.push(h(LogCard, { key: 'log', t }))

      return h(
        'div',
        { className: 'dtm-page' },
        h(
          'header',
          { className: 'dtm-head' },
          h('span', { className: 'dtm-glyph' }, h(Glyph, { size: 18 })),
          h(
            'div',
            { className: 'dtm-head-title' },
            h('h1', null, t('section.title')),
            h('p', null, t('section.subtitle')),
          ),
          h('div', { className: 'dtm-grow' }),
          h(
            'button',
            { type: 'button', className: 'dtm-btn', disabled: current.loading, onClick: () => void loadAll(t) },
            t('common.refresh'),
          ),
        ),
        h('div', { className: 'dtm-body' }, body),
      )
    }

    // ---------------------------------------------------------------- style

    const CSS = [
      '.dtm-page{display:flex;flex-direction:column;gap:16px;min-width:0;color:var(--dsw-alias-label-primary,#1f2328);font:inherit;line-height:1.55}',
      '.dtm-page *{box-sizing:border-box}',
      '.dtm-head{display:flex;align-items:center;gap:12px;min-width:0}',
      '.dtm-glyph{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:9px;border:1px solid var(--dsw-alias-border-l1,rgba(31,35,40,.14));background:var(--dsw-alias-bg-layer-2,rgba(31,35,40,.04));color:var(--dsw-alias-state-success-primary,#2b7a5b);flex:none}',
      '.dtm-head-title{min-width:0}',
      '.dtm-head-title h1{margin:0;font-size:1.12em;font-weight:600}',
      '.dtm-head-title p{margin:2px 0 0;font-size:.84em;color:var(--dsw-alias-label-tertiary,#6e7781)}',
      '.dtm-grow{flex:1 1 auto;min-width:0}',
      '.dtm-body{display:flex;flex-direction:column;gap:14px;min-width:0}',
      '.dtm-card{display:flex;flex-direction:column;gap:10px;border:1px solid var(--dsw-alias-border-l1,rgba(31,35,40,.12));border-radius:12px;padding:14px 16px;background:var(--dsw-alias-bg-layer-1,transparent);min-width:0}',
      '.dtm-card-head{display:flex;align-items:center;gap:10px;min-width:0}',
      '.dtm-card-title{margin:0;font-size:.95em;font-weight:600;flex:none}',
      '.dtm-meta{margin-left:auto;font-size:.78em;color:var(--dsw-alias-label-tertiary,#6e7781);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.dtm-tabs{display:flex;gap:4px;margin-left:auto;flex:none}',
      '.dtm-tab{appearance:none;border:1px solid var(--dsw-alias-border-l1,rgba(31,35,40,.16));background:transparent;color:var(--dsw-alias-label-secondary,#57606a);border-radius:999px;padding:3px 10px;font:inherit;font-size:.8em;cursor:pointer;line-height:1.4}',
      '.dtm-tab-on{background:var(--dsw-alias-state-business-primary,#247bbf);border-color:transparent;color:#fff;font-weight:600}',
      '.dtm-path{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.76em;line-height:1.5;color:var(--dsw-alias-label-tertiary,#6e7781);word-break:break-all}',
      '.dtm-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;min-width:0}',
      '.dtm-btn{appearance:none;border:1px solid var(--dsw-alias-border-l1,rgba(31,35,40,.16));background:transparent;color:inherit;border-radius:8px;padding:6px 11px;font:inherit;font-size:.86em;line-height:1.4;cursor:pointer;white-space:nowrap}',
      '.dtm-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(31,35,40,.06))}',
      '.dtm-btn:disabled{opacity:.5;cursor:not-allowed}',
      '.dtm-btn:focus-visible,.dtm-input:focus-visible,.dtm-select:focus-visible,.dtm-preset:focus-visible,.dtm-tab:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#247bbf);outline-offset:1px}',
      '.dtm-btn.dtm-small{padding:3px 9px;font-size:.8em}',
      '.dtm-btn.dtm-primary{background:var(--dsw-alias-state-business-primary,#247bbf);border-color:transparent;color:#fff;font-weight:600}',
      '.dtm-btn.dtm-danger{border-color:var(--dsw-alias-state-error-primary,#cf222e);color:var(--dsw-alias-state-error-primary,#cf222e)}',
      '.dtm-input,.dtm-select{border:1px solid var(--dsw-alias-border-l1,rgba(31,35,40,.16));background:var(--dsw-alias-bg-layer-2,rgba(31,35,40,.03));color:inherit;border-radius:8px;padding:7px 10px;font:inherit;font-size:.88em;min-width:0;flex:1 1 160px}',
      '.dtm-select{flex:0 1 190px}',
      '.dtm-list{display:flex;flex-direction:column;gap:2px;max-height:280px;overflow:auto}',
      '.dtm-item{display:flex;align-items:center;gap:10px;padding:6px 4px;border-radius:8px;min-width:0}',
      '.dtm-item:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(31,35,40,.04))}',
      '.dtm-item-main{display:flex;align-items:baseline;gap:8px;min-width:0;flex:1 1 auto}',
      '.dtm-item-name{font-size:.86em;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dtm-item-version{font-size:.76em;color:var(--dsw-alias-label-tertiary,#6e7781);flex:none}',
      '.dtm-presets{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:6px}',
      '.dtm-preset{appearance:none;display:flex;align-items:center;gap:6px;border:1px solid var(--dsw-alias-border-l1,rgba(31,35,40,.16));background:var(--dsw-alias-bg-layer-2,rgba(31,35,40,.03));color:inherit;border-radius:10px;padding:8px 10px;font:inherit;font-size:.84em;cursor:pointer;min-width:0;text-align:left}',
      '.dtm-preset:hover:not(:disabled){border-color:var(--dsw-alias-state-business-primary,#247bbf)}',
      '.dtm-preset:disabled{opacity:.6;cursor:progress}',
      '.dtm-preset-on{border-color:var(--dsw-alias-state-success-primary,#2da44e);background:transparent}',
      '.dtm-preset-name{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}',
      '.dtm-preset-state{margin-left:auto;flex:none;font-size:.82em;color:var(--dsw-alias-label-tertiary,#6e7781)}',
      '.dtm-preset-on .dtm-preset-state{color:var(--dsw-alias-state-success-primary,#2da44e)}',
      '.dtm-clean{display:flex;flex-direction:column;gap:2px}',
      '.dtm-clean-row{display:flex;align-items:center;gap:8px;padding:5px 2px;min-width:0;font-size:.86em}',
      '.dtm-protected{flex:none;font-size:.76em;color:var(--dsw-alias-label-tertiary,#6e7781);border:1px dashed var(--dsw-alias-border-l1,rgba(31,35,40,.2));border-radius:999px;padding:1px 8px}',
      '.dtm-clean-name{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;flex:none}',
      '.dtm-clean-role{color:var(--dsw-alias-label-tertiary,#6e7781);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dtm-clean-size{margin-left:auto;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary,#57606a);flex:none;font-size:.92em}',
      '.dtm-chips{display:flex;flex-wrap:wrap;gap:6px}',
      '.dtm-chip{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--dsw-alias-border-l1,rgba(31,35,40,.16));border-radius:999px;padding:2px 9px;font-size:.8em;color:var(--dsw-alias-label-secondary,#57606a)}',
      '.dtm-chip-off{opacity:.55}',
      '.dtm-chip-name{font-weight:600}',
      '.dtm-chip-value{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.92em;color:var(--dsw-alias-label-tertiary,#6e7781)}',
      '.dtm-pre{margin:0;padding:9px 11px;border-radius:8px;background:var(--dsw-alias-bg-layer-2,rgba(31,35,40,.04));font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.76em;line-height:1.6;max-height:220px;overflow:auto;white-space:pre-wrap;word-break:break-word}',
      '.dtm-pre.dtm-err{color:var(--dsw-alias-state-error-primary,#cf222e)}',
      '.dtm-error{border:1px solid var(--dsw-alias-state-error-primary,#cf222e);color:var(--dsw-alias-state-error-primary,#cf222e);border-radius:10px;padding:9px 12px;font-size:.86em;line-height:1.55;white-space:pre-wrap}',
      '.dtm-notice{border:1px solid var(--dsw-alias-state-success-primary,#2da44e);color:var(--dsw-alias-state-success-primary,#2da44e);border-radius:10px;padding:9px 12px;font-size:.86em;line-height:1.55}',
      '.dtm-hint{margin:0;font-size:.82em;line-height:1.65;color:var(--dsw-alias-label-tertiary,#6e7781)}',
    ].join('\n')

    function injectStyle() {
      if (typeof document === 'undefined') return () => {}
      if (document.getElementById(STYLE_ID) !== null) return () => {}
      const element = document.createElement('style')
      element.id = STYLE_ID
      element.textContent = CSS
      document.head.appendChild(element)
      return () => {
        element.remove()
      }
    }

    // ---------------------------------------------------------------- apply

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'toolchain-manager: locale')
      const t = ctx.locale.bind(NS)

      ctx.effect(() => injectStyle(), 'toolchain-manager: styles')

      ctx.effect(
        () =>
          ctx.slots.inject('settings.section', () =>
            ctx.slots.register(
              {
                name: 'settings.section',
                id: SECTION_ID,
                order: 12,
                locale: NS,
                label: () => t('section.label'),
                inject: () => ({ t }),
              },
              ToolchainSection,
            ),
          ),
        'toolchain-manager: settings section',
      )

      ctx.effect(
        () =>
          ctx.slots.inject('settings.section.icon', () =>
            ctx.slots.register({ name: 'settings.section.icon', id: SECTION_ID, locale: NS }, SectionIcon),
          ),
        'toolchain-manager: settings icon',
      )
    }

    return { inject: ['slots', 'locale'], apply }
  },
})
