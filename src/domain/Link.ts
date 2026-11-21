import type { Describable } from './Describable'
import type { Details } from './Details'

export const SIDES = ['top', 'right', 'bottom', 'left'] as const
export type Side = (typeof SIDES)[number]

export const isSide = (v: unknown): v is Side => SIDES.some((s) => s === v)

export class Link implements Describable {
  readonly id: string
  readonly details: Details
  // Endpoints are fixed so a Link can never leave the Diagram that validated them.
  readonly sourceId: string
  readonly targetId: string
  // The box side each end attaches to, so the edge is drawn where the user dropped it.
  readonly sourceSide: Side
  readonly targetSide: Side
  constructor(id: string, details: Details, sourceId: string, targetId: string, sourceSide: Side, targetSide: Side) {
    this.id = id
    this.details = details
    this.sourceId = sourceId
    this.targetId = targetId
    this.sourceSide = sourceSide
    this.targetSide = targetSide
  }
}
