# Project Structure

<!-- Describe the directory layout and the conventions used to organize code. -->

## Directory Layout

- `.kiro/` - Kiro specs, steering, and hooks
- `docs/diagrams/` - Mermaid diagrams (`.mmd`), indexed in `docs/diagrams/README.md`. Keep them current when code, specs, or structure change.
- `docs/clear-saved-data.md` - Console commands to back up or clear the saved workspace after a `schemaVersion` bump.

## Naming Conventions

## Architecture Patterns

## Coding Standards

- Create and edit files with the file-writing tools (`fs_write`, `str_replace`), not shell redirects or `sed -i`, so the `write` PostToolUse hooks fire.
- Write the minimum necessary amount of code.
- Adhere to CLEAN and YAGNI.
- Delete code that is old and doesn't do anything.
- Comment why the code does something, not what it does.
- Make no unrequested refactors or features; recommend them instead.
- Run the project's build, test and lint commands before calling a change done.
- Keep secrets out of code and logs; use environment variables.
- Prefer the standard library; add a dependency only when it clearly earns its place.
- Handle errors explicitly; never swallow exceptions silently.
- Update the diagrams in `docs/diagrams/` when structure changes.
