export type LinkFailure = { code: 'INVALID_PORT'; message: string }

// Takes the allowed handle ids of each end, so the domain and the serializer share this rule.
// Returns the failure, or null when the Link is valid.
export function checkLink(
  sourceIds: readonly string[],
  sourcePortId: string,
  targetIds: readonly string[],
  targetPortId: string,
): LinkFailure | null {
  if (!sourceIds.includes(sourcePortId)) {
    return { code: 'INVALID_PORT', message: 'The source port is not valid for this node.' }
  }
  if (!targetIds.includes(targetPortId)) {
    return { code: 'INVALID_PORT', message: 'The target port is not valid for this node.' }
  }
  return null
}
