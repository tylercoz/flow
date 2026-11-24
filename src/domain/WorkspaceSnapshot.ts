import type { Position, Size } from './NodeBounds'
import type { DataType } from './DataType'
import type { Port } from './Port'
import type { EnvironmentVariable } from './EnvironmentVariable'
import type { ExceptionType } from './ExceptionType'
import type { LocalVariable } from './LocalVariable'
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

export type PortPlacementDto = { id: string; portId: string; position: Position | null }
// The state only a component Resource has. Position and size belong to each Placement.
export type ComponentDto = {
  inputs: Port[]
  outputs: Port[]
  // Every port has at least one entry. A null position means the port's default slot.
  portNodes: PortPlacementDto[]
  notes: string
  exceptionIds: string[]
  environmentVariableIds: string[]
  // Named only inside this component, so they have no workspace catalog.
  localVariables: LocalVariable[]
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
  // Only an artifact has one. Optional so data saved before it existed still loads.
  format?: string
  component: ComponentDto | null
}

export type DiagramDto = {
  id: string
  viewport: Viewport
  placements: PlacementDto[]
  links: LinkDto[]
}

// A top-level Diagram. Component Levels are named by their component, so only these carry a name.
export type NamedDiagramDto = { name: string; diagram: DiagramDto }
export type ProjectDto = {
  name: string
  description: string
  // ISO 8601 timestamps. `updatedAt` is when the project was last saved to a file.
  createdAt: string
  updatedAt: string
}
export type WorkspaceSnapshot = {
  schemaVersion: 16
  project: ProjectDto
  types: DataType[]
  exceptions: ExceptionType[]
  environmentVariables: EnvironmentVariable[]
  resources: ResourceDto[]
  // At least one; the first is the one shown on start.
  diagrams: NamedDiagramDto[]
}
// Detached copy of Placements and the Links between them, as produced by Workspace.copy.
export type Fragment = { placements: PlacementDto[]; links: LinkDto[] }
