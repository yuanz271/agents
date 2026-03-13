# Autoresearch Session Template (Hybrid Rigor)

Use this template when running `pi-autoresearch` with strong evaluation guardrails (Karpathy-style invariance).

## 1) `autoresearch.md` (session contract)

```markdown
# Autoresearch: <goal>

## Objective
Optimize <primary metric> for <workload> under a fixed, comparable protocol.

## Metrics
- **Primary**: val_bpb (lower is better)
- **Secondary**: peak_vram_gb (lower), training_seconds (lower), total_tokens_M (higher)

## Reproducibility / Invariance
- Validation harness is fixed: <evaluator files/paths>
- Data split is fixed: <split definition>
- Time budget is fixed: 300s training budget (+ startup/eval overhead)
- Seed policy: <fixed seed or documented seed schedule>

## Files in Scope (editable)
- train.py
- <other allowed files>

## Off Limits (must not change)
- prepare.py
- <evaluator/data/tokenizer files>
- dependency files / lockfiles

## Run Command
`./autoresearch.sh`

The script must print:
- `METRIC val_bpb=<number>`
- secondary `METRIC ...=<number>` lines

## Keep/Discard Rule
- Keep if primary metric improves by at least `epsilon = <e.g. 0.0005>`
- Otherwise discard
- If checks fail or crash: status = `checks_failed` / `crash`
- Secondary metrics are monitoring-only unless degradation is catastrophic (document why)

## Constraints
- No new dependencies
- No evaluator edits
- No API/format changes unless explicitly allowed

## What's Been Tried
- Baseline:
- Best run:
- Dead ends:
- Next hypotheses:
```

---

## 2) `autoresearch.sh` (benchmark harness)

```bash
#!/usr/bin/env bash
set -euo pipefail

RUN_LOG="${RUN_LOG:-run.log}"
TRAIN_CMD="${TRAIN_CMD:-uv run train.py}"

# Optional hard timeout wrapper (Linux: timeout, macOS: gtimeout if coreutils installed)
TIMEOUT_BIN="$(command -v timeout || command -v gtimeout || true)"

run_train() {
  if [[ -n "${TIMEOUT_BIN}" ]]; then
    "${TIMEOUT_BIN}" 660 bash -lc "${TRAIN_CMD}" > "${RUN_LOG}" 2>&1 || true
  else
    bash -lc "${TRAIN_CMD}" > "${RUN_LOG}" 2>&1 || true
  fi
}

extract_num() {
  local key="$1"
  grep -E "^${key}:" "${RUN_LOG}" | awk '{print $2}' | tail -1
}

# Fast precheck
python -m py_compile train.py

# Run workload
run_train

# Parse required primary metric
val_bpb="$(extract_num val_bpb || true)"
if [[ -z "${val_bpb}" ]]; then
  echo "ERROR: val_bpb not found (run likely crashed)"
  tail -n 80 "${RUN_LOG}" || true
  exit 1
fi

# Optional secondary metrics
peak_vram_mb="$(extract_num peak_vram_mb || true)"
training_seconds="$(extract_num training_seconds || true)"
total_tokens_M="$(extract_num total_tokens_M || true)"

# Convert MB -> GB (1 decimal) using python (portable)
peak_vram_gb="0.0"
if [[ -n "${peak_vram_mb}" ]]; then
  peak_vram_gb="$(python - <<PY
mb=float("${peak_vram_mb}")
print(f"{mb/1024.0:.1f}")
PY
)"
fi

# Emit machine-readable metrics for pi-autoresearch
echo "METRIC val_bpb=${val_bpb}"
echo "METRIC peak_vram_gb=${peak_vram_gb}"
[[ -n "${training_seconds}" ]] && echo "METRIC training_seconds=${training_seconds}"
[[ -n "${total_tokens_M}" ]] && echo "METRIC total_tokens_M=${total_tokens_M}"
```

---

## 3) `autoresearch.checks.sh` (backpressure / anti-reward-hacking)

```bash
#!/usr/bin/env bash
set -euo pipefail

RUN_LOG="${RUN_LOG:-run.log}"

# 1) Ensure off-limits files were not touched
DISALLOWED="$(git diff --name-only | grep -E '^(prepare\.py|<other_frozen_paths_regex>)' || true)"
if [[ -n "${DISALLOWED}" ]]; then
  echo "Disallowed file changes detected:"
  echo "${DISALLOWED}"
  exit 1
fi

# 2) Fail on numerical pathologies
if grep -Eiq '(^|[^a-zA-Z])(nan|inf)([^a-zA-Z]|$)' "${RUN_LOG}"; then
  echo "Detected NaN/Inf in run log"
  tail -n 80 "${RUN_LOG}" || true
  exit 1
fi

# 3) Optional quick smoke checks
python -m py_compile train.py
```

---

## 4) Suggested `init_experiment` values

- `name`: `autoresearch-<goal>-<date>`
- `metric_name`: `val_bpb`
- `metric_unit`: `""`
- `direction`: `lower`

Always include secondary metrics in `log_experiment` (e.g. `peak_vram_gb`, `training_seconds`, `total_tokens_M`).
