# DSH Toolchain Manager

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) plugin that adds a
**编译链依赖 / Toolchain** page to Settings, between **模型 (Models)** and **内置插件 (Plugins)**.

It answers the three questions that come up while building anything inside DSH:

1. where do downloaded tools, sources, build output and caches actually live,
2. which toolchains are installed and at what version,
3. which npm / pip packages are installed, and how do I add or remove one.

## How it works

Two lists and one grid:

- **已安装 / Installed** — every npm global package or pip package (user install or any venv),
  one per row, each with a **删除 / Delete** button. Nothing to type, nothing to expand.
- **一键安装 / One-tap install** — a grid of the common dependencies. Tap one and it installs;
  installed entries show **已装** instead of **＋**. The catalogs are
  `pnpm, typescript, tsx, eslint, prettier, nodemon, serve, vite, sass, cross-env` for npm and
  `requests, httpx, numpy, pandas, beautifulsoup4, lxml, pillow, rich, tqdm, python-dotenv`
  for pip. A collapsed **自定义…** field is there only for anything outside the grid.
- **缓存与目录 / Caches & folders** — `cache`, `downloads`, `build`, `tmp` with their sizes and an
  **清空 / Empty** button each; destructive ones take a second tap.
- **工具链 / Toolchains** — installed versions as compact chips, missing ones dimmed.
- **最近一次操作** — the exact command, exit code, duration and truncated output.

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
`dir-clean` (only `cache`, `downloads`, `build`, `tmp` — emptied and recreated, never removed).

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
- Package listings come from the tools' own JSON output; an untouched global prefix shows an empty
  list instead of an error.
- The one-tap grid is a fixed catalog: anything else goes through the collapsed custom field.
- Emptying `downloads` or `cache` cannot be undone; both need a second tap.

## License

[MIT](LICENSE)

---

## 中文说明

设置页里新增一页 **编译链依赖**（在「模型」和「内置插件」之间）：

- **已安装**：npm / pip 依赖逐行列出，每行末尾一个「删除」，点一下就卸载
- **一键安装**：常用依赖的按钮墙，点一下直接装，不用输入名字；已装的标「已装」
- **缓存与目录**：cache / downloads / build / tmp 各一行，带占用大小和「清空」（二次确认）
- **工具链**：已装版本一行小标签，没装的置灰
- **最近一次操作**：命令、退出码、耗时与输出

所有命令都走 `execFile`（无 shell）、参数白名单校验、依赖根目录为工作目录、180 秒超时。
安装：把仓库克隆到本机，在 **插件 → 添加插件** 选该目录，然后打开 **设置 → 编译链依赖**。
