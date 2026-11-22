import type { Diagram } from '../Diagram'
import type { Link } from '../Link'
import type { Placement } from '../Placement'
import type { Workspace } from '../Workspace'

// Test-support only: gives each end a fresh port, since a Link needs an output and an input to join.
// Both Placements must be of component Resources in `diagram`.
export function connect(workspace: Workspace, diagram: Diagram, source: Placement, target: Placement): Link {
  const from = workspace.resources.get(source.resourceId)!
  const to = workspace.resources.get(target.resourceId)!
  workspace.setPorts(from.id, 'outputs', [...from.definition!.details.outputs, { name: 'out', typeId: null }])
  workspace.setPorts(to.id, 'inputs', [...to.definition!.details.inputs, { name: 'in', typeId: null }])
  const outputs = from.definition!.details.outputs
  const inputs = to.definition!.details.inputs
  return diagram.addLink(source.id, target.id, outputs[outputs.length - 1].id, inputs[inputs.length - 1].id)
}
