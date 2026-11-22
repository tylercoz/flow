import type { Component } from '../Component'
import type { Diagram } from '../Diagram'
import type { Link } from '../Link'

// Test-support only: gives each end a fresh port, since a Link needs an output and an input to join.
export function connect(diagram: Diagram, source: Component, target: Component): Link {
  diagram.setPorts(source.id, 'outputs', [...source.details.outputs, { name: 'out', typeId: null }])
  diagram.setPorts(target.id, 'inputs', [...target.details.inputs, { name: 'in', typeId: null }])
  const output = source.details.outputs[source.details.outputs.length - 1]
  const input = target.details.inputs[target.details.inputs.length - 1]
  return diagram.addLink(source.id, target.id, output.id, input.id)
}
