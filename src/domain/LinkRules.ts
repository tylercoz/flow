import { RESOURCE_KINDS, type ResourceKind } from './ResourceKinds'

// Structural shapes, not classes, so the serializer can validate DTO data with the same rule.
export type EndShape =
  | { kind: 'component'; inputIds: readonly string[]; outputIds: readonly string[] }
  | { kind: 'placement'; resource: ResourceKind }

export type LinkFailure = { code: 'INVALID_PORT'; message: string }

const allowedIds = (end: EndShape, role: 'source' | 'target'): readonly string[] => {
  if (end.kind === 'component') return role === 'source' ? end.outputIds : end.inputIds
  const spec = RESOURCE_KINDS[end.resource]
  return role === 'source' ? spec.sourceIds : spec.targetIds
}

// Returns the failure, or null when the Link is valid.
export function checkLink(
  source: EndShape,
  sourcePortId: string,
  target: EndShape,
  targetPortId: string,
): LinkFailure | null {
  if (!allowedIds(source, 'source').includes(sourcePortId)) {
    return { code: 'INVALID_PORT', message: 'The source port is not valid for this node.' }
  }
  if (!allowedIds(target, 'target').includes(targetPortId)) {
    return { code: 'INVALID_PORT', message: 'The target port is not valid for this node.' }
  }
  return null
}
