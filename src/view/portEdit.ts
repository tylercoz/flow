import type { NewPort } from '../domain/Details'
// An index past the end means a port being added. An empty name deletes the port (or abandons the add).
// Returns undefined when nothing changes, so the caller does not record an empty undo step.
export function applyPortName(ports: readonly NewPort[], index: number, name: string): NewPort[] | undefined {
  const isNew = index >= ports.length
  if (name === '') return isNew ? undefined : ports.filter((_, i) => i !== index)
  if (isNew) return [...ports, { name, typeId: null }]
  if (ports[index].name === name) return undefined
  return ports.map((p, i) => (i === index ? { ...p, name } : p))
}
