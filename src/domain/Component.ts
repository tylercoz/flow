import type { Describable } from './Describable'
import type { Details } from './Details'
import type { Diagram } from './Diagram'
import { NodeBounds, type Positioned } from './NodeBounds'

export type Position = { x: number; y: number }

export type Size = { width: number; height: number }
export class Component implements Describable, Positioned {
  readonly id: string
  readonly details: Details
  readonly diagram: Diagram
  private readonly bounds: NodeBounds
  // Ids into Workspace.exceptions; kept off Details because Links share Details and have no exceptions.
  private _exceptionIds: string[]
  // Ids into Workspace.environmentVariables; off Details for the same reason as exceptions.
  private _environmentVariableIds: string[]
  private readonly onChange: () => void
  constructor(
    id: string,
    details: Details,
    position: Position,
    diagram: Diagram,
    onChange: () => void,
    size?: Size,
    exceptionIds: readonly string[] = [],
    environmentVariableIds: readonly string[] = [],
  ) {
    this.id = id
    this.details = details
    this.diagram = diagram
    this.bounds = new NodeBounds(position, onChange, size)
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
  // Does not notify: Workspace.removeException touches many Components and must notify once,
  // because History records one undo step per notification.
  dropException(id: string): void {
    this._exceptionIds = this._exceptionIds.filter((e) => e !== id)
  }
  get position(): Readonly<Position> {
    return this.bounds.position
  }
  get size(): Readonly<Size> | undefined {
    return this.bounds.size
  }
  setBounds(p: Position, s: Size): void {
    this.bounds.setBounds(p, s)
  }
  setPosition(p: Position): void {
    this.bounds.setPosition(p)
  }
}
