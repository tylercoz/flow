import { ChangeSignal } from './ChangeSignal'
import type { ComponentDefinition } from './ComponentDefinition'
import type { Diagram } from './Diagram'
import { DomainError } from './DomainError'
import type { ObservableStore } from './ObservableStore'
import type { Resource } from './Resource'
import type { Workspace } from './Workspace'

export class Navigator implements ObservableStore {
  private readonly signal = new ChangeSignal()
  private _path: readonly string[] = []
  // The top-level Diagram the path starts from.
  private rootId: string
  private readonly workspace: Pick<Workspace, 'root' | 'diagrams'>

  constructor(workspace: Pick<Workspace, 'root' | 'diagrams'>) {
    this.workspace = workspace
    this.rootId = workspace.root.id
  }

  subscribe = this.signal.subscribe
  getVersion = this.signal.getVersion

  // Placement ids only: names are read from the live Resources so renames show at once.
  get path(): readonly string[] {
    return this._path
  }

  // The top-level Diagram being viewed, or the first one if it was deleted.
  get root(): Diagram {
    return this.workspace.diagrams.find((d) => d.diagram.id === this.rootId)?.diagram ?? this.workspace.root
  }

  // Switching Diagram drops the path, since its Placement ids belong to the old one.
  openDiagram(id: string): void {
    if (!this.workspace.diagrams.some((d) => d.diagram.id === id)) throw new DomainError('MISSING_DIAGRAM', 'The diagram no longer exists.')
    this.rootId = id
    this._path = []
    this.signal.notify()
  }

  // Jumps to a Level in one notification, so the view never renders a path that belongs to another Diagram.
  goTo(rootId: string, path: readonly string[]): void {
    const previous = { rootId: this.rootId, path: this._path }
    this.rootId = rootId
    this._path = path
    if (!this.workspace.diagrams.some((d) => d.diagram.id === rootId) || !this.resolvePath()) {
      this.rootId = previous.rootId
      this._path = previous.path
      throw new DomainError('NOT_IN_DIAGRAM', 'That location no longer exists.')
    }
    this.signal.notify()
  }
  trail(): readonly Resource[] {
    const steps = this.resolvePath()
    if (!steps) throw new DomainError('NOT_IN_DIAGRAM', 'Path placement no longer exists.')
    return steps.map((s) => s.resource)
  }

  get current(): Diagram {
    const steps = this.resolvePath()
    if (!steps) throw new DomainError('NOT_IN_DIAGRAM', 'Path placement no longer exists.')
    return steps.length === 0 ? this.root : steps[steps.length - 1].diagram
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

  // Called after the Workspace content is replaced; falls back to the first Diagram if the viewed one or a path id is gone.
  reconcile(): void {
    const rootGone = !this.workspace.diagrams.some((d) => d.diagram.id === this.rootId)
    if (!rootGone && this.resolvePath()) return
    if (rootGone) this.rootId = this.workspace.root.id
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
    let diagram = this.root
    for (const id of this._path) {
      const resource = diagram.resourceOf(id)
      if (!resource?.definition) return undefined
      diagram = resource.definition.diagram
      steps.push({ resource, diagram })
    }
    return steps
  }
}
