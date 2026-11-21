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
  private readonly onChange: () => void
  constructor(id: string, details: Details, position: Position, diagram: Diagram, onChange: () => void, size?: Size) {
    this.id = id
    this.details = details
    this.diagram = diagram
    this._position = { ...position }
    this._size = size && { ...size }
    this.onChange = onChange
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
