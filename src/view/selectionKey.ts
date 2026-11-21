// Identifies a selection by its element ids, so repeated reports of the same selection can be told apart from a change.
export function selectionKey(nodeIds: string[], edgeIds: string[]): string {
  return JSON.stringify([[...nodeIds].sort(), [...edgeIds].sort()])
}
