import type { Position } from './NodeBounds'
import { SIDE_PORTS, type HandleRole } from './ResourceKinds'
// A null typeId means the port has no type yet. The id lets a Link keep its endpoint when ports are renamed or removed.
export type Port = { id: string; name: string; typeId: string | null }
export type PortRole = 'input' | 'output'
// One node that shows a port on its component's Level. It holds no name or type, so a port with several nodes
// cannot drift. A null position means the default slot, which the view derives from the port's order.
export type PortPlacement = { id: string; portId: string; position: Position | null }
// Inside a component an input port feeds the Links that start there, and an output port receives Links that end there.
export function portNodeHandleIds(portRole: PortRole, linkRole: HandleRole): readonly string[] {
  return (portRole === 'input') === (linkRole === 'source') ? SIDE_PORTS : []
}
// A port not yet in the model; Workspace.setPorts assigns its id.
export type NewPort = Omit<Port, 'id'> & { id?: string }
