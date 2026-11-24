import type { NewPort, Port } from '../domain/Port'
// Shown after a port's name: … for several arguments, ? for an optional one.
export function portMarks(port: Pick<Port, 'multiple' | 'optional'>): string {
  return `${port.multiple ? '…' : ''}${port.optional ? '?' : ''}`
}
// An index past the end means a port being added. An empty name deletes the port (or abandons the add).
// Returns undefined when nothing changes, so the caller does not record an empty undo step.
export function applyPortName(ports: readonly NewPort[], index: number, name: string): NewPort[] | undefined {
  const isNew = index >= ports.length
  if (name === '') return isNew ? undefined : ports.filter((_, i) => i !== index)
  if (isNew) return [...ports, { name, typeId: null }]
  if (ports[index].name === name) return undefined
  return ports.map((p, i) => (i === index ? { ...p, name } : p))
}

// Moves the port at `from` so it ends at index `to`. Returns undefined when nothing changes, so the caller records no empty undo step.
export function movePort<T>(ports: readonly T[], from: number, to: number): T[] | undefined {
  if (from === to || to < 0 || to >= ports.length) return undefined
  const next = [...ports]
  next.splice(to, 0, next.splice(from, 1)[0])
  return next
}
