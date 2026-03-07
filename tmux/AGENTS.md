# Repository Guidelines

## Project Structure & Module Organization
This repository is a small tmux/zsh toolkit.

- `tdl_functions`: zsh function library for tmux workflows (`tdl`, `tdlm`, `tsl`).
- `tmux.conf`: tmux configuration used alongside the functions.

Keep new logic in `tdl_functions` unless it is tmux-native configuration, which belongs in `tmux.conf`.

## Build, Test, and Development Commands
There is no build system. Use these commands during development:

- `zsh -n tdl_functions`: syntax check for shell changes.
- `source ./tdl_functions`: reload functions in your current shell.
- `tmux source-file ./tmux.conf`: reload tmux config without restarting tmux.
- `git diff -- tdl_functions tmux.conf`: review local changes before commit.

Manual smoke test (inside tmux):

- `tdl codex`
- `tdl codex claude` (verifies optional second AI pane)

## Coding Style & Naming Conventions
- Shell style: zsh-compatible, 2-space indentation, no tabs.
- Function names: short lowercase (`tdl`, `tdlm`, `tsl`).
- Local variables: descriptive snake_case (for example `monitor_pane`, `ai_pane_width`).
- Quote variable expansions and tmux targets (`"$var"`) to avoid word-splitting bugs.
- Prefer explicit tmux pane capture patterns: `-P -F '#{pane_id}'`.

## Testing Guidelines
No automated test framework is configured yet. Every change should include:

1. `zsh -n tdl_functions` passing.
2. A tmux smoke test validating pane layout and command startup behavior.
3. If behavior changes, document expected layout in the PR description.

## Commit & Pull Request Guidelines
Recent history favors concise, imperative commits, with optional conventional scope:

- `feat(tdl): widen right panes to 35%`
- `add TDL`

Prefer: `<type>(<scope>): <summary>` when applicable (`feat`, `fix`, `refactor`, `docs`).

PRs should include:

- What changed and why.
- Exact commands used to validate (`zsh -n`, `tdl ...`).
- Screenshots or short layout notes when pane geometry changes.
