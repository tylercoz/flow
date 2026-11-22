import type { Resource } from './Resource'
import type { ResourceKind } from './ResourceKinds'

// No notifications: only Workspace changes membership, so it can notify once per operation.
export class ResourceRegistry {
  // Map iterates in insertion order, which `all` and `byKind` rely on; it also makes `get` constant time.
  private _resources: Map<string, Resource>

  constructor(resources: readonly Resource[] = []) {
    this._resources = new Map(resources.map((r) => [r.id, r]))
  }
  get all(): readonly Resource[] {
    return [...this._resources.values()]
  }
  get(id: string): Resource | undefined {
    return this._resources.get(id)
  }
  byKind(kind: ResourceKind): readonly Resource[] {
    return this.all.filter((r) => r.kind === kind)
  }
  add(resource: Resource): void {
    this._resources.set(resource.id, resource)
  }
  remove(id: string): void {
    this._resources.delete(id)
  }
}
