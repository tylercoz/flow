import type { Position, Size } from './Component'

// What drag and resize need from any node on a canvas, whether Component or Placement.
export interface Positioned {
  readonly id: string
  readonly position: Readonly<Position>
  readonly size: Readonly<Size> | undefined
  setPosition(p: Position): void
  setBounds(p: Position, s: Size): void
}

export class NodeBounds {
  private _position: Position
  // Undefined until the user resizes, so the box keeps fitting its content.
  private _size: Size | undefined
  private readonly onChange: () => void
  constructor(position: Position, onChange: () => void, size?: Size) {
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
