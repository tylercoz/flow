import type { Position, Size } from './NodeBounds'
import type { DataType } from './DataType'
import type { Port } from './Port'
import type { EnvironmentVariable } from './EnvironmentVariable'
import type { ExceptionType } from './ExceptionType'
import type { ResourceKind } from './ResourceKinds'
import type { Viewport } from './Viewport'

// Plain data only, so persistence can depend on the domain without the reverse.
export type LinkDto = {
  id: string
  name: string
  sourceId: string
  targetId: string
  sourcePortId: string
  targetPortId: string
  // Optional, like PlacementDto.size, so data saved before bend points existed still loads.
  waypoints?: Position[]
}

// The state only a component Resource has. Position and size belong to each Placement.
export type ComponentDto = {
  inputs: Port[]
  outputs: Port[]
  // Keyed by port id; a port without an entry has not been moved from its default slot.
  portPositions: Record<string, Position>
  notes: string
  exceptionIds: string[]
  environmentVariableIds: string[]
  diagram: DiagramDto
}

// `size` is optional so data saved before resizing existed still loads.
export type PlacementDto = {
  id: string
  resourceId: string
  position: Position
  size?: Size
}

export type ResourceDto = {
  id: string
  kind: ResourceKind
  name: string
  typeId: string | null
  // Only a repository has one. Optional so data saved before it existed still loads.
  remote?: string
  component: ComponentDto | null
}

export type DiagramDto = {
  id: string
  viewport: Viewport
  placements: PlacementDto[]
  links: LinkDto[]
}

export type WorkspaceSnapshot = {
  schemaVersion: 12
  types: DataType[]
  exceptions: ExceptionType[]
  environmentVariables: EnvironmentVariable[]
  resources: ResourceDto[]
  root: DiagramDto
}
// Detached copy of Placements and the Links between them, as produced by Workspace.copy.
export type Fragment = { placements: PlacementDto[]; links: LinkDto[] }
