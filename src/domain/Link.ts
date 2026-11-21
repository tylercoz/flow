import type { Describable } from './Describable'
import type { Details } from './Details'

export class Link implements Describable {
  readonly id: string
  readonly details: Details
  // Endpoints are fixed so a Link can never leave the Diagram that validated them.
  readonly sourceId: string
  readonly targetId: string
  constructor(id: string, details: Details, sourceId: string, targetId: string) {
    this.id = id
    this.details = details
    this.sourceId = sourceId
    this.targetId = targetId
  }
}
