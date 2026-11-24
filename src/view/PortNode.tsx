import { Handle, type NodeProps } from '@xyflow/react'
import { SIDE_PORTS } from '../domain/ResourceKinds'
import { useApp } from './AppProvider'
import { SIDE_POSITIONS } from './PlacementNode'
import { useStore } from './useStore'
// A port of the open component, shown as a node so Links can join it to the nodes inside. It is read live from
// the component, so it has no rename, resize or open controls: ports are edited on the component itself.
export function PortNode({ id }: NodeProps) {
  const { navigator, workspace } = useApp()
  useStore(workspace)
  const owner = navigator.currentComponent
  const role = owner?.portRole(id)
  const port = owner?.portOf(id)
  if (!role || !port) return null
  const typeName = port.typeId ? workspace.types.find((t) => t.id === port.typeId)?.name : undefined
  return (
    <div className={`placement-node port-node ${role}-port-node`}>
      <div className="placement-text">
        <span className="placement-name">{port.name}</span>
        {typeName && <span className="placement-type">{typeName}</span>}
      </div>
      {SIDE_PORTS.map((side) => (
        // An input starts Links and an output ends them, so each node offers only the matching Handle type.
        <Handle key={side} id={side} type={role === 'input' ? 'source' : 'target'} position={SIDE_POSITIONS[side]} />
      ))}
    </div>
  )
}
