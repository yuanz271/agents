---
name: simplify
description: "Simplify recently changed code while preserving behavior (portable across agents)"
---

Simplify recently changed code for clarity, consistency, and maintainability while preserving exact behavior.

This is prompt-only guidance designed to work across different agent runtimes.

## Default scope

- Focus on code touched in the current task, session, diff, or recent edits.
- If the user provides file paths, functions, modules, or folders, treat those as the scope.
- If the user provides freeform guidance (for example, "focus on duplication" or "improve readability"), treat it as the optimization target.
- Do not expand into unrelated cleanup unless the user explicitly asks for broader simplification.

## Core rules

1. **Preserve functionality exactly**
   - Do not intentionally change outputs, side effects, public behavior, or error behavior unless the user asks for it.
   - If a simplification would require semantic changes, stop and ask.

2. **Follow local conventions**
   - Read project instruction files when present, such as `AGENTS.md`, `CLAUDE.md`, or equivalent repo guidance.
   - Match existing naming, structure, formatting, and architectural patterns unless they are the direct target of simplification.

3. **Prefer clarity over cleverness**
   - Choose code that is easier to read, debug, and extend.
   - Avoid dense one-liners, nested ternaries, and overly compact rewrites when clearer control flow is better.

4. **Reduce unnecessary complexity**
   - Flatten needless nesting.
   - Remove redundant wrappers, indirection, and duplication where behavior is clearly identical.
   - Consolidate closely related logic when it improves readability.

5. **Keep useful abstractions**
   - Do not collapse boundaries that help maintainability.
   - Avoid turning well-structured code into a single large function just to reduce line count.

6. **Minimize churn**
   - Make the smallest set of edits that materially improves the code.
   - Avoid unrelated renames, broad formatting-only changes, or speculative refactors.

## Good simplification targets

- Repetitive conditional branches that can be expressed more clearly
- Duplicated helper logic in recently changed code
- Unclear variable or function names when a safe rename improves readability
- Unnecessary temporary variables or wrappers
- Overly complex control flow in a touched function or component
- Comments that restate obvious code instead of adding useful context

## Avoid by default

- Changing public APIs, wire formats, database behavior, or tests unless required to preserve correctness
- Adding dependencies or frameworks
- Large-scale rewrites across untouched files
- Mixing behavior changes with cleanup in the same pass
- Refactors that make code shorter but harder to understand

## Suggested process

1. Read relevant project instructions and inspect the changed code.
2. Identify the smallest reasonable simplification scope.
3. Apply edits that improve clarity, consistency, or maintainability without changing behavior.
4. Run proportionate validation when available (tests, lint, type-check, smoke test).
5. Summarize what changed, what was verified, and any remaining risk.

## Output expectations

When reporting back:
- Briefly describe what was simplified.
- State what validation was run, or why it was skipped.
- Call out any areas where further simplification would require behavior changes or broader refactoring.
