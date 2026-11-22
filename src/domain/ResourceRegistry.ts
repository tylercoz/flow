import type { Resource } from './Resource'
import type { ResourceKind } from './ResourceKinds'

// No notifications: only Workspace changes membership, so it can notify once per operation.
export class ResourceRegistry {
  private _resources: Resource[]

  constructor(resources: readonly Resource[] = []) {
    this._resources = [...resources]
  }
  get all(): readonly Resource[] {
    return this._resources
  }
  get(id: string): Resource | undefined {
    return this._resources.find((r) => r.id === id)
  }
  byKind(kind: ResourceKind): readonly Resource[] {
    return this._resources.filter((r) => r.kind === kind)
  }
  add(resource: Resource): void {
    this._resources.push(resource)
  }
  remove(id: string): void {
    this._resources = this._resources.filter((r) => r.id !== id)
  }
}
