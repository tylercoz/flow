import type { Describable } from './Describable'
import type { Details } from './Details'

export class Link implements Describable {
  readonly id: string
  readonly details: Details
  // Endpoints are fixed so a Link can never leave the Diagram that validated them.
  readonly sourceId: string
  readonly targetId: string
  // The output of the source and the input of the target that this Link joins.
  readonly sourcePortId: string
  readonly targetPortId: string

  constructor(id: string, details: Details, sourceId: string, targetId: string, sourcePortId: string, targetPortId: string) {
    this.id = id
    this.details = details
    this.sourceId = sourceId
    this.targetId = targetId
    this.sourcePortId = sourcePortId
    this.targetPortId = targetPortId
  }
}
