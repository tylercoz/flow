import { ChangeSignal } from './ChangeSignal'
import type { Component } from './Component'
import type { Diagram } from './Diagram'
import { DomainError } from './DomainError'
import type { ObservableStore } from './ObservableStore'

export class Navigator implements ObservableStore {
  private readonly signal = new ChangeSignal()
  private _path: readonly string[] = []
  // Only the root is needed, so any Workspace fits and tests don't have to build one.
  private readonly workspace: { readonly root: Diagram }

  constructor(workspace: { readonly root: Diagram }) {
    this.workspace = workspace
  }

  subscribe = this.signal.subscribe
  getVersion = this.signal.getVersion

  // Ids only: names are read from the live Components so renames show at once.
  get path(): readonly string[] {
    return this._path
  }

  trail(): readonly Component[] {
    const components: Component[] = []
    let diagram = this.workspace.root
    for (const id of this._path) {
      const component = diagram.component(id)
      if (!component) throw new DomainError('NOT_IN_DIAGRAM', 'Path component no longer exists.')
      components.push(component)
      diagram = component.diagram
    }
    return components
  }

  get current(): Diagram {
    const trail = this.trail()
    return trail.length === 0 ? this.workspace.root : trail[trail.length - 1].diagram
  }

  open(componentId: string): void {
    if (!this.current.component(componentId)) {
      throw new DomainError('NOT_IN_DIAGRAM', 'Component is not in the current diagram.')
    }
    this._path = [...this._path, componentId]
    this.signal.notify()
  }

  // Called after the Workspace content is replaced. Walks the path without trail(),
  // which throws on a stale path; falls back to the root if any id is gone.
  reconcile(): void {
    let diagram = this.workspace.root
    for (const id of this._path) {
      const component = diagram.component(id)
      if (!component) {
        this._path = []
        this.signal.notify()
        return
      }
      diagram = component.diagram
    }
  }

  // Index 0 is the root; index i keeps the first i path elements.
  navigateTo(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index > this._path.length) {
      throw new RangeError(`Index ${index} is outside the path.`)
    }
    if (index === this._path.length) return
    this._path = this._path.slice(0, index)
    this.signal.notify()
  }
}
