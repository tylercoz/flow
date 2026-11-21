# Diagrams

Mermaid diagrams documenting the project. Each diagram lives in its own `.mmd` file in this folder and is listed in the index below.

## Conventions

- One diagram per file, named in kebab-case after its subject (e.g. `system-architecture.mmd`).
- Plain Mermaid source only, with no Markdown fences, so files render in any Mermaid tool.
- Keep diagrams in sync with the code and the specs in `.kiro/specs/`. A hook reviews them on file save.
- Add every new diagram to the index. Remove entries when a diagram is deleted.

## Index

| File | Type | Describes |
| --- | --- | --- |
| [system-architecture.mmd](system-architecture.mmd) | flowchart | Layers (view, domain, persistence), the `main.tsx` composition root, and how they connect |
| [domain-model.mmd](domain-model.mmd) | classDiagram | Workspace, Diagram, Component, Link, Navigator, Notifier and shared contracts (`src/domain`) |
| [startup-and-save.mmd](startup-and-save.mmd) | sequence | Load on startup (`WorkspaceLoader`), debounced autosave, `pagehide` flush, save-failure notice |
