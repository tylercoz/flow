import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type RefObject } from 'react'
import {
  Background,
  ConnectionMode,
  Panel,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { Position, Size } from '../domain/NodeBounds'
import type { Diagram } from '../domain/Diagram'
import { DomainError } from '../domain/DomainError'
import type { Notifier } from '../domain/Notifier'
import type { Fragment } from '../domain/WorkspaceSnapshot'
import { useApp } from './AppProvider'
import type { DeleteFlow } from './DeleteFlow'
import { LinkEdge } from './LinkEdge'
import { PlacementNode } from './PlacementNode'
import { PortNode } from './PortNode'
import { RenameContext } from './RenameInput'
import { KIND_LABELS, ResourcePicker } from './ResourcePicker'
import { ResourceIcon } from './resourceIcons'
import { RESOURCE_KINDS, type ResourceKind } from '../domain/ResourceKinds'
import { toEdges, toNodes } from './DiagramProjector'
import { RenameController } from './RenameController'
import { DUPLICATE_OFFSET, clipboardAction } from './clipboardShortcut'
import { offsetToCenter } from './pasteOffset'
import { NODE_SIZE } from './nodeSize'
import { selectionKey } from './selectionKey'
import { useStore } from './useStore'

// Also the Background's gap, so snapped nodes land on the visible dots.
const GRID_SIZE = 20
const SNAP_GRID: [number, number] = [GRID_SIZE, GRID_SIZE]
const snap = (v: number) => Math.round(v / GRID_SIZE) * GRID_SIZE
const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent)

function centreOf(el: HTMLElement | null): { x: number; y: number } | null {
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

// Where the top-left of Placements moved into a component lands on its Level, clear of the input port column.
const MOVE_ORIGIN = { x: 160, y: 0 }
// Must be module-level: a new object per render would make React Flow remount every node.
const nodeTypes = { placement: PlacementNode, port: PortNode }
const edgeTypes = { link: LinkEdge }

/** The single selected Placement or Link of the current Level, or null. */
type CanvasSelection = { kind: 'placement' | 'link'; id: string } | null

interface CanvasViewProps {
  /** Shared with ConfirmDialog; deletions from the Delete key go through it. */
  deleteFlow: DeleteFlow
  /** Called whenever the selection changes, including when it is cleared (e.g. after a Level change or deletion). */
  onSelectionChange: (selection: CanvasSelection) => void
  /** Placement id to select and centre once its Level is showing; null when there is none. */
  reveal: string | null
  /** Called once the reveal has been applied. */
  onRevealed: () => void
}

export function CanvasView({ deleteFlow, onSelectionChange, reveal, onRevealed }: CanvasViewProps) {
  const { navigator, notifier } = useApp()
  useStore(navigator)
  // Lives here, not in Level, so a copy survives navigating to another Level.
  const clipboard = useRef<Copied | null>(null)
  // Lives here, not in Level, so the mode survives navigating to another Level.
  const [gridMode, setGridMode] = useState(false)
  const diagram = navigator.current
  // Keyed by Diagram id so each Level remounts and applies its own saved defaultViewport.
  return (
    <Level key={diagram.id} gridMode={gridMode} onGridModeChange={setGridMode} diagram={diagram} notifier={notifier} clipboard={clipboard} deleteFlow={deleteFlow} onSelectionChange={onSelectionChange} reveal={reveal} onRevealed={onRevealed} />
  )
}

interface LevelProps extends CanvasViewProps {
  gridMode: boolean
  onGridModeChange: (on: boolean) => void
  diagram: Diagram
  notifier: Notifier
  clipboard: RefObject<Copied | null>
}

type CopiedPortNode = { id: string; portId: string; position: Position }

// Sizes are captured at copy time because the copied Placements may be on another Level when pasted.
// Port nodes belong to one component's Level, so the Diagram they came from decides whether a paste may use them.
interface Copied {
  fragment: Fragment
  portNodes: readonly CopiedPortNode[]
  fromDiagramId: string
  sizes: ReadonlyMap<string, Size>
}

function Level({ gridMode, onGridModeChange, diagram, notifier, clipboard, deleteFlow, onSelectionChange, reveal, onRevealed }: LevelProps) {
  const { workspace, scheduler, navigator, history } = useApp()
  const [rename] = useState(() => new RenameController(scheduler))
  // Level is keyed by Diagram id, so unmounting is a Level change and must drop any pending or active Rename.
  useEffect(
    () => () => {
      rename.cancel()
      rename.end()
    },
    [rename],
  )
  const lastSelection = useRef(selectionKey([], []))
  const version = useStore(workspace).getVersion()
  // Null at the root. A Level is keyed by its Diagram, so the owner never changes while this Level is mounted.
  const owner = navigator.currentComponent
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(toNodes(diagram, owner))
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(toEdges(diagram))
  const [syncedVersion, setSyncedVersion] = useState(version)
  const { screenToFlowPosition, setCenter, getZoom } = useReactFlow()
  // Where the pane context menu was opened (screen) and the flow point a new Placement will take.
  const [menu, setMenu] = useState<{ screen: { x: number; y: number }; point: { x: number; y: number } } | null>(null)
  const [picking, setPicking] = useState<{ kind: ResourceKind; point: { x: number; y: number } } | null>(null)
  // Ids of elements just created by paste; selected on the next model sync (state, not a ref, because the sync runs during render).
  const [pendingFocus, setPendingFocus] = useState<ReadonlySet<string> | null>(null)

  // React Flow needs local state to animate drags and selection, so rebuild it from the model
  // whenever the model changes, carrying `selected` over so a rename doesn't drop the selection.
  if (syncedVersion !== version) {
    setSyncedVersion(version)
    // Freshly created elements replace the previous selection.
    const selected = pendingFocus ?? new Set([...nodes, ...edges].filter((e) => e.selected).map((e) => e.id))
    setPendingFocus(null)
    setNodes(toNodes(diagram, owner).map((n) => ({ ...n, selected: selected.has(n.id) })))
    setEdges(toEdges(diagram).map((e) => ({ ...e, selected: selected.has(e.id) })))
  }

  // Waits for the Level that holds the Placement: a reveal for another Level stays pending until navigation remounts this one.
  useEffect(() => {
    const placement = reveal ? diagram.placement(reveal) : undefined
    if (!placement) return
    const size = placement.size ?? NODE_SIZE
    setNodes((ns) => ns.map((n) => ({ ...n, selected: n.id === placement.id })))
    void setCenter(placement.position.x + size.width / 2, placement.position.y + size.height / 2, { zoom: getZoom() })
    onRevealed()
  }, [reveal, diagram, setNodes, setCenter, getZoom, onRevealed])

  const onConnect = ({ source, target, sourceHandle, targetHandle }: Connection) => {
    // Every Handle is a port, so a missing id is a wiring bug.
    if (!sourceHandle || !targetHandle) throw new Error('Connection used an unknown Handle')
    try {
      diagram.addLink(source, target, sourceHandle, targetHandle)
    } catch (e) {
      if (!(e instanceof DomainError)) throw e
      notifier.post('link', e.message, 'transient')
    }
  }

  // Deletion is routed through DeleteFlow (confirmation, cascade), so React Flow must not delete by itself.
  const onBeforeDelete = async ({ nodes: gone, edges: goneEdges }: { nodes: Node[]; edges: Edge[] }) => {
    const goneIds = new Set(gone.map((n) => n.id))
    // Checked first and as a whole: refusing to leave a port without a node must not delete the rest of the selection.
    try {
      owner?.removePortPlacements(gone.filter((n) => n.type === 'port').map((n) => n.id))
    } catch (e) {
      if (!(e instanceof DomainError)) throw e
      notifier.post('delete', e.message, 'transient')
      return false
    }
    gone.filter((n) => n.type !== 'port').forEach((n) => deleteFlow.request(diagram, { kind: 'placement', id: n.id }))
    // Edges attached to a deleted node are handled by the cascade, and must survive a pending confirmation.
    goneEdges
      .filter((e) => !goneIds.has(e.source) && !goneIds.has(e.target))
      .forEach((e) => deleteFlow.request(diagram, { kind: 'link', id: e.id }))
    return false
  }

  // A port node keeps its position on the component, so it moves on every Level that shows that component.
  const savePosition = (n: Node) => {
    if (n.type === 'port') owner?.setPortPlacementPosition(n.id, n.position)
    else diagram.placement(n.id)?.setPosition(n.position)
  }
  // Drops land on the component under the pointer, not on one the dragged boxes merely overlap, so repositioning
  // a node next to a component never moves it by accident.
  const componentUnder = (e: ReactMouseEvent | MouseEvent | TouchEvent, movedIds: ReadonlySet<string>): string | undefined => {
    const point = 'changedTouches' in e ? e.changedTouches[0] : e
    if (!point || movedIds.size === 0) return undefined
    return document
      .elementsFromPoint(point.clientX, point.clientY)
      .map((el) => el.closest<HTMLElement>('.react-flow__node')?.dataset.id)
      .find((id) => id && !movedIds.has(id) && diagram.resourceOf(id)?.definition)
  }
  const placementIds = (moved: Node[]) => new Set(moved.filter((n) => n.type === 'placement').map((n) => n.id))
  // The class only restyles the node (see index.css); it is applied to local React Flow state, not the model.
  const [dropTarget, setDropTarget] = useState<string | undefined>()
  const hoverComponent = (e: ReactMouseEvent | MouseEvent | TouchEvent, moved: Node[]) => {
    const id = componentUnder(e, placementIds(moved))
    if (id === dropTarget) return
    setDropTarget(id)
    setNodes((ns) => ns.map((n) => ({ ...n, className: n.id === id ? 'drop-target' : undefined })))
  }
  const dropIntoComponent = (e: ReactMouseEvent | MouseEvent | TouchEvent, moved: Node[]): boolean => {
    const movedIds = placementIds(moved)
    const targetId = componentUnder(e, movedIds)
    setDropTarget(undefined)
    setNodes((ns) => ns.map((n) => ({ ...n, className: undefined })))
    if (!targetId) return false
    // One group, so the copy into the component and the removal here are one undo step.
    history.beginGroup()
    try {
      workspace.moveIntoComponent(diagram, movedIds, targetId, MOVE_ORIGIN)
    } catch (err) {
      if (!(err instanceof DomainError)) throw err
      notifier.post('move', err.message, 'transient')
    } finally {
      history.endGroup()
    }
    return true
  }
  const onDragStop = (e: ReactMouseEvent | MouseEvent | TouchEvent, moved: Node[]) => {
    if (!dropIntoComponent(e, moved)) moved.forEach(savePosition)
  }
  const openMenu = (e: { clientX: number; clientY: number }) => {
    const point = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    setMenu({ screen: { x: e.clientX, y: e.clientY }, point: gridMode ? { x: snap(point.x), y: snap(point.y) } : point })
  }

  // Keyboard events carry no pointer position, so the last one seen over the canvas is kept for paste.
  const cursor = useRef<{ x: number; y: number } | null>(null)
  const canvas = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Dialogs sit over the canvas and own the keyboard.
      if (document.querySelector('[aria-modal="true"]')) return
      const action = clipboardAction(e, isMac)
      if (!action) return
      // A rejected paste (MISSING_RESOURCE, REFERENCE_CYCLE) changes nothing, so the reason is posted instead of thrown.
      const paste = (copied: Copied, offset: { x: number; y: number }) => {
        // One group, so a selection of Placements and port nodes is one undo step.
        history.beginGroup()
        try {
          const added = copied.fragment.placements.length > 0 ? workspace.paste(diagram, copied.fragment, offset) : { placements: [], links: [] }
          // Port nodes copied on another Level have no port here to show, so they are left out.
          const ported =
            owner && copied.fromDiagramId === diagram.id
              ? owner.addPortPlacements(copied.portNodes.map((n) => ({ portId: n.portId, position: { x: n.position.x + offset.x, y: n.position.y + offset.y } })))
              : []
          setPendingFocus(new Set([...added.placements, ...added.links, ...ported].map((x) => x.id)))
        } catch (err) {
          if (!(err instanceof DomainError)) throw err
          notifier.post('paste', err.message, 'transient')
        } finally {
          history.endGroup()
        }
      }
      if (action === 'paste') {
        const copied = clipboard.current
        if (!copied) return
        e.preventDefault()
        rename.cancel()
        // Before the pointer has moved over the canvas there is no cursor to aim at, so the canvas centre stands in.
        const screen = cursor.current ?? centreOf(canvas.current)
        if (!screen) return
        const { fragment, portNodes, sizes } = copied
        paste(copied, offsetToCenter({ placements: [...fragment.placements, ...portNodes] }, screenToFlowPosition(screen), sizes))
        return
      }
      const selected = nodes.filter((n) => n.selected)
      const ids = new Set(selected.filter((n) => n.type === 'placement').map((n) => n.id))
      const portNodes = selected.flatMap((n): CopiedPortNode[] => {
        const portId = n.type === 'port' ? owner?.portPlacement(n.id)?.portId : undefined
        return portId ? [{ id: n.id, portId, position: { x: n.position.x, y: n.position.y } }] : []
      })
      // Acting on nothing keeps the previous copy instead of clearing it.
      if (ids.size === 0 && portNodes.length === 0) return
      // Cmd+D is the browser's bookmark shortcut, so it is only taken over when it does something.
      e.preventDefault()
      const sizes = new Map<string, Size>()
      for (const n of nodes) {
        const copiedNode = ids.has(n.id) || portNodes.some((p) => p.id === n.id)
        if (copiedNode && n.measured?.width && n.measured.height) sizes.set(n.id, { width: n.measured.width, height: n.measured.height })
      }
      const copied: Copied = { fragment: workspace.copy(diagram, ids), portNodes, fromDiagramId: diagram.id, sizes }
      if (action === 'copy') {
        clipboard.current = copied
        return
      }
      // Duplicate bypasses the clipboard so it doesn't overwrite what the user copied.
      rename.cancel()
      paste(copied, { x: DUPLICATE_OFFSET, y: DUPLICATE_OFFSET })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [nodes, clipboard, workspace, history, diagram, owner, rename, screenToFlowPosition, notifier])

  return (
    <RenameContext.Provider value={rename}>
      <div
        ref={canvas}
        className={dropTarget ? 'drop-active' : undefined}
        style={{ width: '100%', height: '100%' }}
        onPointerMove={(e) => {
          cursor.current = { x: e.clientX, y: e.clientY }
        }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          snapToGrid={gridMode}
          snapGrid={SNAP_GRID}
          edgeTypes={edgeTypes}
          onEdgeDoubleClick={(_, edge) => rename.start(edge.id)}
          defaultViewport={{ ...diagram.viewport }}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStart={() => rename.cancel()}
          // Dragging one member of a multi-selection moves all of them, so persist every moved node.
          onNodeDragStop={(e, __, moved) => onDragStop(e, moved)}
          onNodeDrag={(e, __, moved) => hoverComponent(e, moved)}
          onSelectionDrag={hoverComponent}
          onSelectionDragStart={() => rename.cancel()}
          onSelectionDragStop={onDragStop}
          // Loose mode lets a side handle (one source and one target Handle per side) start or end a Link.
          connectionMode={ConnectionMode.Loose}
          onPaneContextMenu={(e) => {
            e.preventDefault()
            openMenu(e)
          }}
          // A click that only clears a selection or dismisses the open menu must not open another one. React Flow
          // clears the selection after this handler runs, so `nodes` and `edges` still show what the click deselects.
          onPaneClick={(e) => {
            const deselects = nodes.some((n) => n.selected) || edges.some((x) => x.selected)
            if (menu || deselects) setMenu(null)
            else openMenu(e)
          }}
          onMoveStart={() => setMenu(null)}
          // Left-drag on empty canvas draws a selection box; pan moves to middle/right mouse (and scroll/trackpad).
          selectionOnDrag
          panOnDrag={[1, 2]}
          panOnScroll
          onMoveEnd={(_, viewport) => diagram.setViewport(viewport)}
          onConnect={onConnect}
          onBeforeDelete={onBeforeDelete}
          onSelectionChange={({ nodes: n, edges: e }) => {
            // React Flow re-reports the selection whenever this inline callback's identity changes (every render),
            // so without this guard any re-render within the Rename Delay cancelled the pending Rename.
            const key = selectionKey(n.map((x) => x.id), e.map((x) => x.id))
            if (key === lastSelection.current) return
            lastSelection.current = key
            rename.cancel()
            // A port node has nothing to inspect: it is edited on its component.
            if (n.length + e.length !== 1 || n[0]?.type === 'port') return onSelectionChange(null)
            onSelectionChange(
              n.length ? { kind: 'placement', id: n[0].id } : { kind: 'link', id: e[0].id },
            )
          }}
          // Double-click renames a Placement or Link, so it must not also zoom.
          zoomOnDoubleClick={false}
        >
          <Background gap={GRID_SIZE} />
          <Panel position="top-right">
            <button type="button" aria-pressed={gridMode} title="Lock placements to the grid" onClick={() => onGridModeChange(!gridMode)}>
              Snap
            </button>
          </Panel>
        </ReactFlow>
        {menu && (
          <div className="canvas-menu" role="menu" style={{ left: menu.screen.x, top: menu.screen.y }}>
            {(Object.keys(RESOURCE_KINDS) as ResourceKind[]).map((kind) => (
              <button
                type="button"
                role="menuitem"
                key={kind}
                onClick={() => {
                  // Text has no fields besides its content, so it is typed in place instead of through the picker.
                  if (kind === 'text') {
                    rename.start(workspace.createPlacedResource(diagram, { kind, name: '' }, menu.point).id)
                  } else {
                    setPicking({ kind, point: menu.point })
                  }
                  setMenu(null)
                }}
              >
                <ResourceIcon kind={kind} /> {KIND_LABELS[kind]}
              </button>
            ))}
          </div>
        )}
        {picking && <ResourcePicker kind={picking.kind} diagram={diagram} position={picking.point} onClose={() => setPicking(null)} />}
      </div>
    </RenameContext.Provider>
  )
}
