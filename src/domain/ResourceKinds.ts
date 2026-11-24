export type ResourceKind = 'database' | 'repository' | 'artifact' | 'user' | 'input-object' | 'component' | 'text'
export type FixedHandleKind = Exclude<ResourceKind, 'component'>
export type HandleRole = 'source' | 'target'

export const SIDE_PORTS = ['top', 'right', 'bottom', 'left'] as const

// Key order is the display order in the canvas menu and the Resources panel.
export const RESOURCE_KINDS: Record<ResourceKind, { readonly typed: boolean }> = {
  component: { typed: false },
  artifact: { typed: true }, // artifact and input-object carry a Data Type
  database: { typed: false },
  repository: { typed: false },
  user: { typed: false },
  'input-object': { typed: true },
  text: { typed: false },
}
// A component has no entry: its handles are its ports, which the caller supplies.
export const FIXED_HANDLES: Record<FixedHandleKind, { readonly source: readonly string[]; readonly target: readonly string[] }> = {
  database: { source: SIDE_PORTS, target: SIDE_PORTS },
  repository: { source: SIDE_PORTS, target: SIDE_PORTS },
  artifact: { source: SIDE_PORTS, target: SIDE_PORTS },
  user: { source: SIDE_PORTS, target: SIDE_PORTS },
  'input-object': { source: SIDE_PORTS, target: SIDE_PORTS },
  // A label, not a node in the flow, so no Link can end on it.
  text: { source: [], target: [] },
}

type PortLists = { readonly inputs: readonly { readonly id: string }[]; readonly outputs: readonly { readonly id: string }[] }

// Handle ids valid on a Link end. Takes plain port lists so the serializer can use it on stored data.
export function handleIds(kind: ResourceKind, ports: PortLists | null, role: HandleRole): readonly string[] {
  if (kind !== 'component') return FIXED_HANDLES[kind][role]
  if (!ports) return []
  return (role === 'source' ? ports.outputs : ports.inputs).map((p) => p.id)
}

// The one place the kind invariants live. Returns the failure message, or null when they hold.
export function kindInvariantError(kind: ResourceKind, typeId: string | null, hasDefinition: boolean): string | null {
  if ((kind === 'component') !== hasDefinition) {
    return `A ${kind} resource ${hasDefinition ? 'cannot' : 'must'} have a component definition.`
  }
  const typed = RESOURCE_KINDS[kind].typed
  if (typed && typeId === null) return `A ${kind} resource needs a data type.`
  if (!typed && typeId !== null) return `A ${kind} resource cannot have a data type.`
  return null
}

// Own-property check so inherited keys such as "toString" are not treated as kinds.
export const isResourceKind = (v: unknown): v is ResourceKind =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(RESOURCE_KINDS, v)
