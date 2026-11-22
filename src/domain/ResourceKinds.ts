export type ResourceKind = 'database' | 'artifact' | 'user' | 'input-object' | 'component'

export const DATABASE_PORTS = { read: 'read', write: 'write' } as const
export const SIDE_PORTS = ['top', 'right', 'bottom', 'left'] as const

export type KindSpec = {
  readonly typed: boolean // artifact and input-object carry a Data Type
  readonly sourceIds: readonly string[] // handle ids valid on a Link source end
  readonly targetIds: readonly string[] // handle ids valid on a Link target end
}

export const RESOURCE_KINDS: Record<ResourceKind, KindSpec> = {
  database: { typed: false, sourceIds: [DATABASE_PORTS.read], targetIds: [DATABASE_PORTS.write] },
  artifact: { typed: true, sourceIds: SIDE_PORTS, targetIds: SIDE_PORTS },
  user: { typed: false, sourceIds: SIDE_PORTS, targetIds: SIDE_PORTS },
  'input-object': { typed: true, sourceIds: SIDE_PORTS, targetIds: SIDE_PORTS },
  // Handles come from the definition's Details ports, so the id lists are never read.
  component: { typed: false, sourceIds: [], targetIds: [] },
}

// Own-property check so inherited keys such as "toString" are not treated as kinds.
export const isResourceKind = (v: unknown): v is ResourceKind =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(RESOURCE_KINDS, v)
