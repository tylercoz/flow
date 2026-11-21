import type { Position } from './Component'
import type { DetailsDto } from './Details'
import type { Viewport } from './Viewport'

// Plain data only, so persistence can depend on the domain without the reverse.
export type LinkDto = { id: string; details: DetailsDto; sourceId: string; targetId: string }

export type ComponentDto = { id: string; details: DetailsDto; position: Position; diagram: DiagramDto }

export type DiagramDto = {
  id: string
  viewport: Viewport
  components: ComponentDto[]
  links: LinkDto[]
}

export type WorkspaceSnapshot = { schemaVersion: 1; root: DiagramDto }
