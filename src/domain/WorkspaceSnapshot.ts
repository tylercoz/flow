import type { Position, Size } from './Component'
import type { DataType } from './DataType'
import type { DetailsDto } from './Details'
import type { ExceptionType } from './ExceptionType'
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
  diagram: DiagramDto
}

export type DiagramDto = {
  id: string
  viewport: Viewport
  components: ComponentDto[]
  links: LinkDto[]
}

export type WorkspaceSnapshot = { schemaVersion: 6; types: DataType[]; exceptions: ExceptionType[]; root: DiagramDto }
// Detached copy of Components and the Links between them, as produced by Workspace.copy.
export type Fragment = { components: ComponentDto[]; links: LinkDto[] }
