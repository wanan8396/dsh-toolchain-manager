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

    const zh = {
      'section.label': '编译链依赖',
      'section.title': '编译链与依赖',
      'section.subtitle': '依赖根目录、工具链版本、npm / pip 包与缓存',
      'common.refresh': '刷新',
      'common.cancel': '取消',
      'common.delete': '卸载',
      'common.install': '安装',
      'common.installing': '安装中…',
      'common.removing': '卸载中…',
      'common.running': '执行中…',
      'common.version': '版本（可空）',
      'common.name': '包名',
      'common.loading': '读取中…',
      'common.empty': '（空）',
      'common.count': '{count} 个',
      'root.title': '依赖根目录',
      'root.total': '合计 {size}',
      'root.entries': '{count} 项',
      'root.cleanBuild': '清空 build',
      'root.cleanTmp': '清空 tmp',
      'root.cleanTmpOld': '清理 3 天前临时文件',
      'root.confirm': '确认清理？再点一次',
      'tools.title': '工具链',
      'tools.missing': '未安装',
      'npm.title': 'npm 全局包',
      'npm.prefix': '前缀',
      'npm.installPlaceholder': '例如 typescript',
      'npm.cache': '清理 npm 缓存',
      'pip.title': 'Python 包',
      'pip.scopeUser': '用户安装（--user）',
      'pip.scopeVenv': 'venv',
      'pip.cache': '清理 pip 缓存',
      'pip.venvs': 'venv',
      'pip.venvName': 'venv 名称',
      'pip.createVenv': '新建 venv',
      'pip.createRunning': '创建中…',
      'pip.removeVenv': '删除 venv',
      'log.title': '最近一次操作',
      'log.empty': '还没有执行过操作',
      'log.stdout': '输出',
      'log.stderr': '错误输出',
      'env.title': '环境变量',
      'notice.done': '已完成：{command}',
      'notice.failed': '命令退出码 {code}：{command}',
      'error.prefix': '操作失败：',
      'error.name': '请先填写包名',
      'error.venv': '请先填写 venv 名称',
    }

    const en = {
      'section.label': 'Toolchain',
      'section.title': 'Toolchain & dependencies',
      'section.subtitle': 'Dependency root, toolchain versions, npm / pip packages and caches',
      'common.refresh': 'Refresh',
      'common.cancel': 'Cancel',
      'common.delete': 'Uninstall',
      'common.install': 'Install',
      'common.installing': 'Installing…',
      'common.removing': 'Uninstalling…',
      'common.running': 'Running…',
      'common.version': 'Version (optional)',
      'common.name': 'Package',
      'common.loading': 'Loading…',
      'common.empty': '(empty)',
      'common.count': '{count}',
      'root.title': 'Dependency root',
      'root.total': '{size} total',
      'root.entries': '{count} entries',
      'root.cleanBuild': 'Empty build',
      'root.cleanTmp': 'Empty tmp',
      'root.cleanTmpOld': 'Drop temp files older than 3 days',
      'root.confirm': 'Tap again to confirm',
      'tools.title': 'Toolchains',
      'tools.missing': 'Not installed',
      'npm.title': 'npm global packages',
      'npm.prefix': 'Prefix',
      'npm.installPlaceholder': 'e.g. typescript',
      'npm.cache': 'Clean npm cache',
      'pip.title': 'Python packages',
      'pip.scopeUser': 'User install (--user)',
      'pip.scopeVenv': 'venv',
      'pip.cache': 'Purge pip cache',
      'pip.venvs': 'venvs',
      'pip.venvName': 'venv name',
      'pip.createVenv': 'Create venv',
      'pip.createRunning': 'Creating…',
      'pip.removeVenv': 'Remove venv',
      'log.title': 'Last action',
      'log.empty': 'No action yet',
      'log.stdout': 'Output',
      'log.stderr': 'Errors',
      'env.title': 'Environment',
      'notice.done': 'Done: {command}',
      'notice.failed': 'Exit code {code}: {command}',
      'error.prefix': 'Failed: ',
      'error.name': 'Enter a package name first',
      'error.venv': 'Enter a venv name first',
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
      pipScope: '',
      loading: false,
      busy: '',
      error: '',
      notice: '',
      log: null,
      npmName: '',
      npmVersion: '',
      pipName: '',
      pipVersion: '',
      venvName: '',
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

    async function loadAll(t) {
      patch({ loading: true, error: '' })
      try {
        const overview = await request('/overview')
        patch({ overview })
        const npm = await request('/packages?kind=npm')
        patch({ npm })
        const pip = await request('/packages?kind=pip' + (state.pipScope === '' ? '' : `&venv=${encodeURIComponent(state.pipScope)}`))
        patch({ pip, loading: false })
      } catch (error) {
        patch({ loading: false, error: message(t, error) })
      }
    }

    async function refreshPackages(t) {
      try {
        const npm = await request('/packages?kind=npm')
        patch({ npm })
        const pip = await request('/packages?kind=pip' + (state.pipScope === '' ? '' : `&venv=${encodeURIComponent(state.pipScope)}`))
        patch({ pip })
      } catch (error) {
        patch({ error: message(t, error) })
      }
    }

    async function act(t, action, extra, busyKey) {
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
        await refreshPackages(t)
        if (
          action === 'venv-create' ||
          action === 'venv-remove' ||
          action === 'dir-remove' ||
          action === 'tmp-clean' ||
          action === 'go-clean' ||
          action === 'ccache-clear'
        ) {
          const overview = await request('/overview')
          patch({ overview })
        }
      } catch (error) {
        patch({ busy: '', error: message(t, error) })
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

    // ----------------------------------------------------------- primitives

    function Card(props) {
      return h(
        'section',
        { className: 'dtm-card' },
        h(
          'div',
          { className: 'dtm-card-head' },
          h('h2', { className: 'dtm-card-title' }, props.title),
          props.meta === undefined ? null : h('span', { className: 'dtm-meta' }, props.meta),
        ),
        props.children,
      )
    }

    // --------------------------------------------------------------- sections

    function RootCard(props) {
      const t = props.t
      const current = useStore()
      const overview = current.overview
      if (overview === null) return null
      const cleaning = (key) => current.busy === key
      const clean = (key, action, path) => {
        if (current.confirm !== key) {
          patch({ confirm: key })
          return
        }
        patch({ confirm: '' })
        void act(t, action, { path }, key)
      }
      const button = (key, label, action, target) =>
        h(
          'button',
          {
            type: 'button',
            className: 'dtm-btn' + (current.confirm === key ? ' dtm-danger' : ''),
            disabled: cleaning(key),
            onClick: () => clean(key, action, target),
          },
          cleaning(key) ? t('common.running') : current.confirm === key ? t('root.confirm') : label,
        )
      return h(
        Card,
        {
          title: t('root.title'),
          meta: t('root.total').replace('{size}', formatBytes(overview.total)),
        },
        h('div', { className: 'dtm-path' }, overview.root),
        h(
          'div',
          { className: 'dtm-sizes' },
          overview.rows.map((row) =>
            h(
              'div',
              { className: 'dtm-size-row', key: row.name },
              h('span', { className: 'dtm-size-name' }, row.name),
              h('span', { className: 'dtm-size-role' }, row.role),
              h('span', { className: 'dtm-size-value' }, formatBytes(row.bytes)),
            ),
          ),
        ),
        h(
          'div',
          { className: 'dtm-row' },
          button('build', t('root.cleanBuild'), 'dir-remove', overview.root + '/build'),
          button('tmp', t('root.cleanTmp'), 'dir-remove', overview.root + '/tmp'),
          button('tmp-old', t('root.cleanTmpOld'), 'tmp-clean', ''),
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
          { className: 'dtm-tools' },
          overview.tools.map((tool) =>
            h(
              'div',
              { className: 'dtm-tool' + (tool.present ? '' : ' dtm-off'), key: tool.id },
              h('span', { className: 'dtm-tool-name' }, tool.label),
              h('span', { className: 'dtm-tool-version' }, tool.present ? tool.version || t('common.empty') : t('tools.missing')),
              tool.path === '' ? null : h('span', { className: 'dtm-tool-path' }, tool.path),
            ),
          ),
        ),
      )
    }

    function NpmCard(props) {
      const t = props.t
      const current = useStore()
      const npm = current.npm
      const busy = current.busy
      return h(
        Card,
        {
          title: t('npm.title'),
          meta: npm === null ? '' : t('common.count').replace('{count}', String(npm.rows.length)),
        },
        npm === null || npm.prefix === ''
          ? null
          : h('div', { className: 'dtm-path' }, `${t('npm.prefix')}: ${npm.prefix}`),
        h(
          'div',
          { className: 'dtm-row' },
          h('input', {
            className: 'dtm-input',
            value: current.npmName,
            placeholder: t('npm.installPlaceholder'),
            spellCheck: false,
            onChange: (event) => patch({ npmName: event.currentTarget.value }),
          }),
          h('input', {
            className: 'dtm-input dtm-narrow',
            value: current.npmVersion,
            placeholder: t('common.version'),
            spellCheck: false,
            onChange: (event) => patch({ npmVersion: event.currentTarget.value }),
          }),
          h(
            'button',
            {
              type: 'button',
              className: 'dtm-btn dtm-primary',
              disabled: busy === 'npm-install',
              onClick: () => {
                if (state.npmName.trim() === '') {
                  patch({ error: t('error.prefix') + t('error.name') })
                  return
                }
                void act(t, 'npm-install', { name: state.npmName, version: state.npmVersion }, 'npm-install')
              },
            },
            busy === 'npm-install' ? t('common.installing') : t('common.install'),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'dtm-btn',
              disabled: busy === 'npm-cache-clean',
              onClick: () => void act(t, 'npm-cache-clean', {}, 'npm-cache-clean'),
            },
            busy === 'npm-cache-clean' ? t('common.running') : t('npm.cache'),
          ),
        ),
        h(
          'div',
          { className: 'dtm-list' },
          npm !== null && npm.rows.length > 0
            ? npm.rows.map((row) =>
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
                    className: 'dtm-btn dtm-small',
                    disabled: busy === `npm-uninstall:${row.name}`,
                    onClick: () => void act(t, 'npm-uninstall', { name: row.name }, `npm-uninstall:${row.name}`),
                  },
                  busy === `npm-uninstall:${row.name}` ? t('common.removing') : t('common.delete'),
                ),
              ),
            )
            : h('p', { className: 'dtm-hint' }, current.loading ? t('common.loading') : t('common.empty')),
        ),
      )
    }

    function PipCard(props) {
      const t = props.t
      const current = useStore()
      const pip = current.pip
      const busy = current.busy
      const overview = current.overview
      const venvs = overview === null ? [] : overview.venvs
      return h(
        Card,
        {
          title: t('pip.title'),
          meta: pip === null ? '' : t('common.count').replace('{count}', String(pip.rows.length)),
        },
        h(
          'div',
          { className: 'dtm-row' },
          h(
            'button',
            {
              type: 'button',
              className: 'dtm-btn' + (current.pipScope === '' ? ' dtm-on' : ''),
              onClick: () => {
                patch({ pipScope: '' })
                void refreshPackages(t)
              },
            },
            t('pip.scopeUser'),
          ),
          venvs.length === 0
            ? null
            : h(
              'select',
              {
                className: 'dtm-select',
                value: current.pipScope,
                onChange: (event) => {
                  patch({ pipScope: event.currentTarget.value })
                  void refreshPackages(t)
                },
              },
              h('option', { value: '' }, '—'),
              venvs.map((venv) => h('option', { key: venv.name, value: venv.name }, `${venv.name}`)),
            ),
        ),
        venvs.length > 0
          ? h(
            'div',
            { className: 'dtm-venvs' },
            venvs.map((venv) =>
              h(
                'span',
                { className: 'dtm-chip', key: venv.name },
                h('span', null, venv.name),
                h(
                  'button',
                  {
                    type: 'button',
                    title: t('pip.removeVenv'),
                    disabled: busy === `venv-remove:${venv.name}`,
                    onClick: () => void removeVenv(t, venv.name, busy),
                  },
                  '×',
                ),
              ),
            ),
          )
          : null,
        h(
          'div',
          { className: 'dtm-row' },
          h('input', {
            className: 'dtm-input',
            value: current.pipName,
            placeholder: t('common.name'),
            spellCheck: false,
            onChange: (event) => patch({ pipName: event.currentTarget.value }),
          }),
          h('input', {
            className: 'dtm-input dtm-narrow',
            value: current.pipVersion,
            placeholder: t('common.version'),
            spellCheck: false,
            onChange: (event) => patch({ pipVersion: event.currentTarget.value }),
          }),
          h(
            'button',
            {
              type: 'button',
              className: 'dtm-btn dtm-primary',
              disabled: busy === 'pip-install',
              onClick: () => {
                if (state.pipName.trim() === '') {
                  patch({ error: t('error.prefix') + t('error.name') })
                  return
                }
                void act(
                  t,
                  'pip-install',
                  { name: state.pipName, version: state.pipVersion, venv: state.pipScope },
                  'pip-install',
                )
              },
            },
            busy === 'pip-install' ? t('common.installing') : t('common.install'),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'dtm-btn',
              disabled: busy === 'pip-cache-purge',
              onClick: () => void act(t, 'pip-cache-purge', {}, 'pip-cache-purge'),
            },
            busy === 'pip-cache-purge' ? t('common.running') : t('pip.cache'),
          ),
        ),
        h(
          'div',
          { className: 'dtm-list' },
          pip !== null && pip.rows.length > 0
            ? pip.rows.map((row) =>
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
                    className: 'dtm-btn dtm-small',
                    disabled: busy === `pip-uninstall:${row.name}`,
                    onClick: () =>
                      void act(
                        t,
                        'pip-uninstall',
                        { name: row.name, venv: state.pipScope },
                        `pip-uninstall:${row.name}`,
                      ),
                  },
                  busy === `pip-uninstall:${row.name}` ? t('common.removing') : t('common.delete'),
                ),
              ),
            )
            : h('p', { className: 'dtm-hint' }, current.loading ? t('common.loading') : t('common.empty')),
        ),
        h(
          'div',
          { className: 'dtm-row' },
          h('input', {
            className: 'dtm-input dtm-narrow',
            value: current.venvName,
            placeholder: t('pip.venvName'),
            spellCheck: false,
            onChange: (event) => patch({ venvName: event.currentTarget.value }),
          }),
          h(
            'button',
            {
              type: 'button',
              className: 'dtm-btn',
              disabled: busy === 'venv-create',
              onClick: () => {
                if (state.venvName.trim() === '') {
                  patch({ error: t('error.prefix') + t('error.venv') })
                  return
                }
                void act(t, 'venv-create', { name: state.venvName }, 'venv-create')
                patch({ venvName: '' })
              },
            },
            busy === 'venv-create' ? t('pip.createRunning') : t('pip.createVenv'),
          ),
        ),
      )
    }

    async function removeVenv(t, name, busy) {
      if (busy === `venv-remove:${name}`) return
      const key = `venv:${name}`
      if (state.confirm !== key) {
        patch({ confirm: key, notice: '' })
        return
      }
      patch({ confirm: '' })
      if (state.pipScope === name) patch({ pipScope: '' })
      await act(t, 'venv-remove', { name }, `venv-remove:${name}`)
    }

    function LogCard(props) {
      const t = props.t
      const current = useStore()
      const log = current.log
      if (log === null) {
        return h(Card, { title: t('log.title') }, h('p', { className: 'dtm-hint' }, t('log.empty')))
      }
      return h(
        Card,
        { title: t('log.title'), meta: `${log.durationMs} ms` },
        h('div', { className: 'dtm-path' }, `$ ${log.command}`),
        log.stdout === '' ? null : h('pre', { className: 'dtm-pre' }, log.stdout),
        log.stderr === '' ? null : h('pre', { className: 'dtm-pre dtm-err' }, log.stderr),
      )
    }

    function EnvCard(props) {
      const t = props.t
      const current = useStore()
      const overview = current.overview
      if (overview === null) return null
      const keys = Object.keys(overview.env)
      if (keys.length === 0) return null
      return h(
        Card,
        { title: t('env.title') },
        h(
          'div',
          { className: 'dtm-env' },
          keys.map((key) =>
            h(
              'div',
              { className: 'dtm-env-row', key },
              h('span', { className: 'dtm-env-key' }, key),
              h('span', { className: 'dtm-env-value' }, overview.env[key]),
            ),
          ),
        ),
      )
    }

    // ------------------------------------------------------------------- page

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
      body.push(h(RootCard, { key: 'root', t }))
      body.push(h(ToolsCard, { key: 'tools', t }))
      body.push(h(NpmCard, { key: 'npm', t }))
      body.push(h(PipCard, { key: 'pip', t }))
      body.push(h(LogCard, { key: 'log', t }))
      body.push(h(EnvCard, { key: 'env', t }))

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
            {
              type: 'button',
              className: 'dtm-btn',
              disabled: current.loading,
              onClick: () => void loadAll(t),
            },
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
      '.dtm-card-head{display:flex;align-items:baseline;gap:10px;min-width:0}',
      '.dtm-card-title{margin:0;font-size:.95em;font-weight:600}',
      '.dtm-meta{margin-left:auto;font-size:.78em;color:var(--dsw-alias-label-tertiary,#6e7781);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.dtm-path{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.76em;line-height:1.5;color:var(--dsw-alias-label-tertiary,#6e7781);word-break:break-all}',
      '.dtm-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;min-width:0}',
      '.dtm-btn{appearance:none;border:1px solid var(--dsw-alias-border-l1,rgba(31,35,40,.16));background:transparent;color:inherit;border-radius:8px;padding:6px 11px;font:inherit;font-size:.86em;line-height:1.4;cursor:pointer;white-space:nowrap}',
      '.dtm-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(31,35,40,.06))}',
      '.dtm-btn:disabled{opacity:.5;cursor:not-allowed}',
      '.dtm-btn:focus-visible,.dtm-input:focus-visible,.dtm-select:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#247bbf);outline-offset:1px}',
      '.dtm-btn.dtm-small{padding:3px 9px;font-size:.8em}',
      '.dtm-btn.dtm-on{border-color:var(--dsw-alias-state-business-primary,#247bbf);color:var(--dsw-alias-state-business-primary,#247bbf)}',
      '.dtm-btn.dtm-primary{background:var(--dsw-alias-state-business-primary,#247bbf);border-color:transparent;color:#fff;font-weight:600}',
      '.dtm-btn.dtm-danger{border-color:var(--dsw-alias-state-error-primary,#cf222e);color:var(--dsw-alias-state-error-primary,#cf222e)}',
      '.dtm-input,.dtm-select{border:1px solid var(--dsw-alias-border-l1,rgba(31,35,40,.16));background:var(--dsw-alias-bg-layer-2,rgba(31,35,40,.03));color:inherit;border-radius:8px;padding:7px 10px;font:inherit;font-size:.88em;min-width:0;flex:1 1 180px}',
      '.dtm-input.dtm-narrow,.dtm-select{flex:0 1 150px}',
      '.dtm-sizes{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:4px 18px}',
      '.dtm-size-row{display:flex;align-items:baseline;gap:8px;font-size:.84em;min-width:0}',
      '.dtm-size-name{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;flex:none}',
      '.dtm-size-role{color:var(--dsw-alias-label-tertiary,#6e7781);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}',
      '.dtm-size-value{margin-left:auto;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary,#57606a);flex:none}',
      '.dtm-tools{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:8px 18px}',
      '.dtm-tool{display:flex;flex-direction:column;gap:1px;min-width:0;font-size:.84em}',
      '.dtm-tool.dtm-off{opacity:.55}',
      '.dtm-tool-name{font-weight:600}',
      '.dtm-tool-version{color:var(--dsw-alias-label-secondary,#57606a);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dtm-tool-path{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.9em;color:var(--dsw-alias-label-tertiary,#6e7781);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dtm-list{display:flex;flex-direction:column;gap:2px;max-height:280px;overflow:auto}',
      '.dtm-item{display:flex;align-items:center;gap:10px;padding:5px 4px;border-radius:8px;min-width:0}',
      '.dtm-item:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(31,35,40,.04))}',
      '.dtm-item-main{display:flex;align-items:baseline;gap:8px;min-width:0;flex:1 1 auto}',
      '.dtm-item-name{font-size:.86em;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dtm-item-version{font-size:.76em;color:var(--dsw-alias-label-tertiary,#6e7781);flex:none}',
      '.dtm-venvs{display:flex;gap:6px;flex-wrap:wrap}',
      '.dtm-chip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--dsw-alias-border-l1,rgba(31,35,40,.16));border-radius:999px;padding:2px 4px 2px 9px;font-size:.8em;color:var(--dsw-alias-label-secondary,#57606a)}',
      '.dtm-chip button{appearance:none;border:0;background:transparent;color:inherit;font:inherit;line-height:1;cursor:pointer;padding:2px 5px;border-radius:999px;opacity:.7}',
      '.dtm-chip button:hover{opacity:1;background:var(--dsw-alias-interactive-bg-hover,rgba(31,35,40,.08))}',
      '.dtm-env{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:2px 18px}',
      '.dtm-env-row{display:flex;gap:8px;font-size:.8em;min-width:0}',
      '.dtm-env-key{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--dsw-alias-label-tertiary,#6e7781);flex:none}',
      '.dtm-env-value{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}',
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

      // Settings tab between 模型 (order 10) and 内置插件 (order 15).
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
            ctx.slots.register(
              { name: 'settings.section.icon', id: SECTION_ID, locale: NS },
              SectionIcon,
            ),
          ),
        'toolchain-manager: settings icon',
      )
    }

    return { inject: ['slots', 'locale'], apply }
  },
})
