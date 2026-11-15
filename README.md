# DSH Toolchain Manager

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) plugin that adds a
**编译链依赖 / Toolchain** page to Settings, between **模型 (Models)** and **内置插件 (Plugins)**.

It answers the three questions that come up while building anything inside DSH:

1. where do downloaded tools, sources, build output and caches actually live,
2. which toolchains are installed and at what version,
3. which npm / pip packages are installed, and how do I add or remove one.

## Features

- **Dependency root usage** — `downloads`, `sources`, `build`, `cache`, `tmp`, `bin`, `npm`,
  `python`, `venvs`, `cargo`, `go`, `rustup`, `backups`, each with its size, plus the total.
- **Toolchain probe** — Node, npm, pnpm, Python, pip, Git, GCC, GNU Make, Cargo, rustc, Go and
  Java: version, resolved path, and an explicit “not installed” state.
- **npm global packages** — list, install `name[@version]`, uninstall, clean the npm cache.
- **Python packages** — list the `--user` install or any venv under `$DSH_DEPENDENCY_ROOT/venvs`,
  install, uninstall, create and remove venvs, purge the pip cache.
- **Maintenance** — empty `build` or `tmp`, drop temp files older than three days, `go clean
  -cache`, `ccache -C`; destructive rows need a second tap.
- **Command log** — the exact argv, exit status, duration and truncated output of the last action.
- **Environment view** — `DSH_DEPENDENCY_ROOT`, `NPM_CONFIG_*`, `PIP_CACHE_DIR`,
  `PYTHONUSERBASE`, `CARGO_HOME`, `RUSTUP_HOME`, `GOPATH`, `GOMODCACHE`, `GOCACHE`, `CCACHE_DIR`.

## Install

```bash
git clone https://github.com/wanan8396/dsh-toolchain-manager.git
```

Then **Plugins → Add plugin → local directory** (or `plugin_manager` `install_bundle` with the
absolute path), and open **Settings → 编译链依赖**.

The plugin needs no build step, no dependencies, and no configuration.

## Host API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/plugins/toolchain-manager/overview` | root usage, toolchains, venvs, environment |
| `GET` | `/plugins/toolchain-manager/packages?kind=npm` | npm global packages |
| `GET` | `/plugins/toolchain-manager/packages?kind=pip[&venv=NAME]` | pip packages |
| `POST` | `/plugins/toolchain-manager/run` | allowlisted maintenance action |

`run` accepts only these actions:

`npm-install`, `npm-uninstall`, `npm-cache-clean`, `pip-install`, `pip-uninstall`,
`pip-cache-purge`, `venv-create`, `venv-remove`, `go-clean`, `ccache-clear`, `tmp-clean`,
`dir-remove` (only `build` and `tmp`).

Safety properties:

- Every command runs through `execFile` — no shell, no string interpolation.
- Package names, versions and venv names are validated before they reach argv.
- The working directory is the dependency root; commands time out after 180 s.
- Cross-site POSTs are rejected; output is truncated before it reaches the page.

## Compatibility

Developed against DSH `0.2.2-rc.3` (Android phone shell and desktop web GUI). It registers the
`settings.section` and `settings.section.icon` slots, so it appears in the Settings tab row.

## Limitations

- npm and pip must be on `PATH`; a missing toolchain is reported, not installed.
- Package listings come from the tools' own JSON output; an unhealthy npm/pip shows an empty list
  plus the raw error.
- Uninstalling a venv removes its directory; it cannot be undone.

## License

[MIT](LICENSE)

---

## 中文说明

设置页里新增一页 **编译链依赖**（位置在「模型」和「内置插件」之间）：

- 依赖根目录各子目录占用与合计
- 已装工具链版本与路径（Node / npm / pnpm / Python / pip / Git / GCC / Make / Cargo / rustc / Go / Java）
- npm 全局包与 pip 用户包/venv 包：安装、卸载
- venv 新建与删除、npm/pip 缓存清理、清空 build 与 tmp、删除 3 天前临时文件
- 最近一次操作的完整命令、退出码、耗时与输出

所有命令都走 `execFile`（无 shell）、参数白名单校验、依赖根目录为工作目录、180 秒超时。
安装：把仓库克隆到本机，在 **插件 → 添加插件** 选该目录，然后打开 **设置 → 编译链依赖**。
