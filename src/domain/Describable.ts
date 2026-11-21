import type { Details } from './Details'

export interface Describable {
  readonly id: string
  readonly details: Details
}
