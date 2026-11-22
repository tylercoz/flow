import type { Position, Size } from './Component'
import type { DataType } from './DataType'
import type { DetailsDto } from './Details'
import type { EnvironmentVariable } from './EnvironmentVariable'
import type { ExceptionType } from './ExceptionType'
import type { ResourceKind } from './ResourceKinds'
import type { Viewport } from './Viewport'

// Plain data only, so persistence can depend on the domain without the reverse.
export type LinkDto = {
  id: string
  details: DetailsDto
  sourceId: string
  targetId: string
  sourcePortId: string
  targetPortId: string
}

// `size` is optional so data saved before resizing existed still loads.
export type ComponentDto = {
  id: string
  details: DetailsDto
  position: Position
  size?: Size
  exceptionIds: string[]
  environmentVariableIds: string[]
  diagram: DiagramDto
}

// `size` is optional for the same reason as on ComponentDto.
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
}

export type DiagramDto = {
  id: string
  viewport: Viewport
  components: ComponentDto[]
  placements: PlacementDto[]
  links: LinkDto[]
}

export type WorkspaceSnapshot = {
  schemaVersion: 8
  types: DataType[]
  exceptions: ExceptionType[]
  environmentVariables: EnvironmentVariable[]
  resources: ResourceDto[]
  root: DiagramDto
}
// Detached copy of Components, Placements and the Links between them, as produced by Workspace.copy.
export type Fragment = { components: ComponentDto[]; placements: PlacementDto[]; links: LinkDto[] }
