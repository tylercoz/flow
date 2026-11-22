import { ChangeSignal } from './ChangeSignal'
import type { ComponentDefinition } from './ComponentDefinition'
import type { Diagram } from './Diagram'
import { DomainError } from './DomainError'
import type { ObservableStore } from './ObservableStore'
import type { Resource } from './Resource'

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

  // Placement ids only: names are read from the live Resources so renames show at once.
  get path(): readonly string[] {
    return this._path
  }

  trail(): readonly Resource[] {
    const steps = this.resolvePath()
    if (!steps) throw new DomainError('NOT_IN_DIAGRAM', 'Path placement no longer exists.')
    return steps.map((s) => s.resource)
  }

  get current(): Diagram {
    const steps = this.resolvePath()
    if (!steps) throw new DomainError('NOT_IN_DIAGRAM', 'Path placement no longer exists.')
    return steps.length === 0 ? this.workspace.root : steps[steps.length - 1].diagram
  }

  // The component whose Level is shown, or null at the root.
  get currentComponent(): ComponentDefinition | null {
    const steps = this.resolvePath()
    if (!steps) throw new DomainError('NOT_IN_DIAGRAM', 'Path placement no longer exists.')
    return steps.length === 0 ? null : steps[steps.length - 1].resource.definition
  }
  open(placementId: string): void {
    const current = this.current
    if (!current.placement(placementId)) {
      throw new DomainError('NOT_IN_DIAGRAM', 'Placement is not in the current diagram.')
    }
    if (!current.resourceOf(placementId)?.definition) {
      throw new DomainError('NOT_A_COMPONENT', 'Only a component can be opened.')
    }
    this._path = [...this._path, placementId]
    this.signal.notify()
  }

  // Called after the Workspace content is replaced; falls back to the root if any path id is gone.
  reconcile(): void {
    if (this.resolvePath()) return
    this._path = []
    this.signal.notify()
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

  // Undefined when an id on the path no longer exists.
  private resolvePath(): { resource: Resource; diagram: Diagram }[] | undefined {
    const steps: { resource: Resource; diagram: Diagram }[] = []
    let diagram = this.workspace.root
    for (const id of this._path) {
      const resource = diagram.resourceOf(id)
      if (!resource?.definition) return undefined
      diagram = resource.definition.diagram
      steps.push({ resource, diagram })
    }
    return steps
  }
}
