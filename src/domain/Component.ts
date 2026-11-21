import type { Describable } from './Describable'
import type { Details } from './Details'
import type { Diagram } from './Diagram'

export type Position = { x: number; y: number }

export class Component implements Describable {
  readonly id: string
  readonly details: Details
  readonly diagram: Diagram
  private _position: Position
  private readonly onChange: () => void
  constructor(id: string, details: Details, position: Position, diagram: Diagram, onChange: () => void) {
    this.id = id
    this.details = details
    this.diagram = diagram
    this._position = { ...position }
    this.onChange = onChange
  }
  get position(): Readonly<Position> {
    return this._position
  }
  setPosition(p: Position): void {
    this._position = { x: p.x, y: p.y }
    this.onChange()
  }
}
