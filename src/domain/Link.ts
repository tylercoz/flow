import type { Position } from './NodeBounds'

export class Link {
  readonly id: string
  private _name: string
  // Bend points in diagram coordinates, from source to target. Empty means the automatic curve.
  private _waypoints: Position[]
  private readonly onChange: () => void
  // Endpoints are fixed so a Link can never leave the Diagram that validated them.
  readonly sourceId: string
  readonly targetId: string
  // The output of the source and the input of the target that this Link joins.
  readonly sourcePortId: string
  readonly targetPortId: string

  constructor(id: string, name: string, onChange: () => void, sourceId: string, targetId: string, sourcePortId: string,
    targetPortId: string,
    waypoints: readonly Position[] = [],
  ) {
    this.id = id
    this._name = name
    this._waypoints = waypoints.map((p) => ({ x: p.x, y: p.y }))
    this.onChange = onChange
    this.sourceId = sourceId
    this.targetId = targetId
    this.sourcePortId = sourcePortId
    this.targetPortId = targetPortId
  }

  get name(): string {
    return this._name
  }

  get waypoints(): readonly Readonly<Position>[] {
    return this._waypoints
  }

  // Replaces the whole list so one drag or removal is one change, and so one undo step.
  setWaypoints(points: readonly Position[]): void {
    this._waypoints = points.map((p) => ({ x: p.x, y: p.y }))
    this.onChange()
  }

  setName(name: string): void {
    this._name = name
    this.onChange()
  }
}
