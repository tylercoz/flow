import type { Describable } from './Describable'
import type { Details } from './Details'
import type { Diagram } from './Diagram'

export type Position = { x: number; y: number }

export type Size = { width: number; height: number }
export class Component implements Describable {
  readonly id: string
  readonly details: Details
  readonly diagram: Diagram
  private _position: Position
  // Undefined until the user resizes, so the box keeps fitting its text.
  private _size: Size | undefined
  // Ids into Workspace.exceptions; kept off Details because Links share Details and have no exceptions.
  private _exceptionIds: string[]
  private readonly onChange: () => void
  constructor(
    id: string,
    details: Details,
    position: Position,
    diagram: Diagram,
    onChange: () => void,
    size?: Size,
    exceptionIds: readonly string[] = [],
  ) {
    this.id = id
    this.details = details
    this.diagram = diagram
    this._position = { ...position }
    this._size = size && { ...size }
    this._exceptionIds = [...exceptionIds]
    this.onChange = onChange
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
    return this._position
  }
  get size(): Readonly<Size> | undefined {
    return this._size
  }
  // Position and size change together because resizing from the top or left edge moves the origin.
  setBounds(p: Position, s: Size): void {
    this._position = { x: p.x, y: p.y }
    this._size = { width: s.width, height: s.height }
    this.onChange()
  }
  setPosition(p: Position): void {
    this._position = { x: p.x, y: p.y }
    this.onChange()
  }
}
