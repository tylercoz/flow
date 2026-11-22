import type { Details } from './Details'
import type { Diagram } from './Diagram'

// The state only a component Resource has. Shared by every Placement of that Resource.
export class ComponentDefinition {
  readonly details: Details
  readonly diagram: Diagram
  // Ids into Workspace.exceptions; kept off Details because Links share Details and have no exceptions.
  private _exceptionIds: string[]
  // Ids into Workspace.environmentVariables; off Details for the same reason as exceptions.
  private _environmentVariableIds: string[]
  private readonly onChange: () => void
  constructor(
    details: Details,
    diagram: Diagram,
    onChange: () => void,
    exceptionIds: readonly string[] = [],
    environmentVariableIds: readonly string[] = [],
  ) {
    this.details = details
    this.diagram = diagram
    this._exceptionIds = [...exceptionIds]
    this._environmentVariableIds = [...environmentVariableIds]
    this.onChange = onChange
  }
  get environmentVariableIds(): readonly string[] {
    return this._environmentVariableIds
  }
  setEnvironmentVariables(ids: readonly string[]): void {
    this._environmentVariableIds = [...new Set(ids)]
    this.onChange()
  }
  // Does not notify, for the same reason as dropException.
  dropEnvironmentVariable(id: string): void {
    this._environmentVariableIds = this._environmentVariableIds.filter((v) => v !== id)
  }
  get exceptionIds(): readonly string[] {
    return this._exceptionIds
  }
  setExceptions(ids: readonly string[]): void {
    this._exceptionIds = [...new Set(ids)]
    this.onChange()
  }
  // Does not notify: Workspace.removeException touches many definitions and must notify once,
  // because History records one undo step per notification.
  dropException(id: string): void {
    this._exceptionIds = this._exceptionIds.filter((e) => e !== id)
  }
}
