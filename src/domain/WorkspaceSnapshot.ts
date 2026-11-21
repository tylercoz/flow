import type { Position, Size } from './Component'
import type { DataType } from './DataType'
import type { DetailsDto } from './Details'
import type { Side } from './Link'
import type { Viewport } from './Viewport'

// Plain data only, so persistence can depend on the domain without the reverse.
export type LinkDto = {
  id: string
  details: DetailsDto
  sourceId: string
  targetId: string
  sourceSide: Side
  targetSide: Side
}

// `size` is optional so data saved before resizing existed still loads.
export type ComponentDto = { id: string; details: DetailsDto; position: Position; size?: Size; diagram: DiagramDto }

export type DiagramDto = {
  id: string
  viewport: Viewport
  components: ComponentDto[]
  links: LinkDto[]
}

export type WorkspaceSnapshot = { schemaVersion: 4; types: DataType[]; root: DiagramDto }
