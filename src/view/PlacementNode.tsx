import { NodeResizer, Handle, Position, type NodeProps, type ResizeParams } from '@xyflow/react'
import { DATABASE_PORTS, RESOURCE_KINDS, SIDE_PORTS } from '../domain/ResourceKinds'
import { useApp } from './AppProvider'
import { ResourceIcon } from './resourceIcons'
import { useStore } from './useStore'

// Smaller than a Component's box: a Placement has no port lists to fit.
const MIN_SIZE = { width: 120, height: 48 }

const SIDE_POSITIONS: Record<(typeof SIDE_PORTS)[number], Position> = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left,
}

export function PlacementNode({ id, data, selected, width, height }: NodeProps) {
  const { navigator, workspace } = useApp()
  useStore(workspace)
  const placement = navigator.current.placement(id)
  const resource = workspace.resources.get((data as { resourceId: string }).resourceId)
  const typeName = resource?.typeId ? workspace.types.find((t) => t.id === resource.typeId)?.name : undefined
  // The node has a width and height only while NodeResizer drags it, so the box follows the drag and
  // otherwise keeps the stored size as a floor.
  const floor = {
    minWidth: Math.max(MIN_SIZE.width, width ?? placement?.size?.width ?? 0),
    minHeight: Math.max(MIN_SIZE.height, height ?? placement?.size?.height ?? 0),
  }
  const onResizeEnd = (_: unknown, { x, y, width, height }: ResizeParams) =>
    navigator.current.placement(id)?.setBounds({ x, y }, { width, height })

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={MIN_SIZE.width}
        minHeight={MIN_SIZE.height}
        onResizeEnd={onResizeEnd}
      />
      <div style={floor} className="placement-node">
        {resource && <ResourceIcon kind={resource.kind} />}
        <div className="placement-text">
          <span className="placement-name">{resource?.name}</span>
          {typeName && <span className="placement-type">{typeName}</span>}
        </div>
        {resource?.kind === 'database' ? (
          <>
            <Handle id={DATABASE_PORTS.write} type="target" position={Position.Left} />
            <Handle id={DATABASE_PORTS.read} type="source" position={Position.Right} />
          </>
        ) : (
          resource &&
          RESOURCE_KINDS[resource.kind].sourceIds.map((side) => (
            <span key={side}>
              {/* Same id and side for both roles; loose connection mode lets either start or end a Link. */}
              <Handle id={side} type="source" position={SIDE_POSITIONS[side as keyof typeof SIDE_POSITIONS]} />
              <Handle id={side} type="target" position={SIDE_POSITIONS[side as keyof typeof SIDE_POSITIONS]} />
            </span>
          ))
        )}
      </div>
    </>
  )
}
