import type { Position, Size } from './Component'
import { NodeBounds, type Positioned } from './NodeBounds'

// A leaf node that shows one shared Resource in a Diagram. Name and type live on the Resource,
// so a Placement has no Details and is not Describable.
export class Placement implements Positioned {
  readonly id: string
  readonly resourceId: string
  private readonly bounds: NodeBounds
  constructor(id: string, resourceId: string, position: Position, onChange: () => void, size?: Size) {
    this.id = id
    this.resourceId = resourceId
    this.bounds = new NodeBounds(position, onChange, size)
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
