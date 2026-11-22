// Diagram id -> ids of the child Diagrams of component Resources placed in it.
export type DiagramGraph = ReadonlyMap<string, readonly string[]>

/** True when `to` is `from` or reachable from it. Ids absent from the graph have no edges. */
export function reaches(graph: DiagramGraph, from: string, to: string): boolean {
  const seen = new Set<string>()
  const stack = [from]
  while (stack.length > 0) {
    const id = stack.pop() as string
    if (id === to) return true
    if (seen.has(id)) continue
    seen.add(id)
    stack.push(...(graph.get(id) ?? []))
  }
  return false
}

/** Returns a Diagram id that lies on a cycle, or undefined when the graph is acyclic. */
export function findCycle(graph: DiagramGraph): string | undefined {
  const done = new Set<string>()
  const onPath = new Set<string>()

  // Iterative DFS so a deep chain of nested components cannot overflow the call stack.
  for (const start of graph.keys()) {
    if (done.has(start)) continue
    const stack: { id: string; next: number }[] = [{ id: start, next: 0 }]
    onPath.add(start)
    while (stack.length > 0) {
      const frame = stack[stack.length - 1]
      const children = graph.get(frame.id) ?? []
      if (frame.next === children.length) {
        onPath.delete(frame.id)
        done.add(frame.id)
        stack.pop()
        continue
      }
      const child = children[frame.next++]
      if (onPath.has(child)) return child
      if (done.has(child)) continue
      onPath.add(child)
      stack.push({ id: child, next: 0 })
    }
  }
  return undefined
}
