import { useEffect, useRef, useState, type MouseEvent, type RefObject } from 'react'
import {
  Background,
  ConnectionMode,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { Size } from '../domain/Component'
import type { Diagram } from '../domain/Diagram'
import { DomainError } from '../domain/DomainError'
import type { Notifier } from '../domain/Notifier'
import type { Fragment } from '../domain/WorkspaceSnapshot'
import { useApp } from './AppProvider'
import type { DeleteFlow, DeleteTarget } from './DeleteFlow'
import { ComponentNode, RenameContext } from './ComponentNode'
import { LinkEdge } from './LinkEdge'
import { PlacementNode } from './PlacementNode'
import { KIND_LABELS, ResourcePicker } from './ResourcePicker'
import { ResourceIcon } from './resourceIcons'
import { RESOURCE_KINDS, type ResourceKind } from '../domain/ResourceKinds'
import { toEdges, toNodes } from './DiagramProjector'
import { createComponentAt, isEmptyCanvas } from './createAtPoint'
import { RenameController } from './RenameController'
import { DUPLICATE_OFFSET, clipboardAction } from './clipboardShortcut'
import { offsetToCenter } from './pasteOffset'
import { selectionKey } from './selectionKey'
import { useStore } from './useStore'

const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent)

function centreOf(el: HTMLElement | null): { x: number; y: number } | null {
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

// Must be module-level: a new object per render would make React Flow remount every node.
const nodeTypes = { component: ComponentNode, resource: PlacementNode }
const edgeTypes = { link: LinkEdge }

/** The single selected Component, Placement or Link of the current Level, or null. */
type CanvasSelection = DeleteTarget | null

interface CanvasViewProps {
  /** Shared with ConfirmDialog; deletions from the Delete key go through it. */
  deleteFlow: DeleteFlow
  /** Called whenever the selection changes, including when it is cleared (e.g. after a Level change or deletion). */
  onSelectionChange: (selection: CanvasSelection) => void
}

export function CanvasView({ deleteFlow, onSelectionChange }: CanvasViewProps) {
  const { navigator, notifier } = useApp()
  useStore(navigator)
  // Lives here, not in Level, so a copy survives navigating to another Level.
  const clipboard = useRef<Copied | null>(null)
  const diagram = navigator.current
  // Keyed by Diagram id so each Level remounts and applies its own saved defaultViewport.
  return (
    <Level key={diagram.id} diagram={diagram} notifier={notifier} clipboard={clipboard} deleteFlow={deleteFlow} onSelectionChange={onSelectionChange} />
  )
}

interface LevelProps extends CanvasViewProps {
  diagram: Diagram
  notifier: Notifier
  clipboard: RefObject<Copied | null>
}

// Sizes are captured at copy time because the copied Components may be on another Level when pasted.
interface Copied {
  fragment: Fragment
  sizes: ReadonlyMap<string, Size>
}

function Level({ diagram, notifier, clipboard, deleteFlow, onSelectionChange }: LevelProps) {
  const { workspace, scheduler } = useApp()
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
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(toNodes(diagram))
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(toEdges(diagram))
  const [syncedVersion, setSyncedVersion] = useState(version)
  const { screenToFlowPosition } = useReactFlow()
  // Where the pane context menu was opened (screen) and the flow point a new Placement will take.
  const [menu, setMenu] = useState<{ screen: { x: number; y: number }; point: { x: number; y: number } } | null>(null)
  const [picking, setPicking] = useState<{ kind: ResourceKind; point: { x: number; y: number } } | null>(null)
  // Ids of elements just created by double-click or paste; selected on the next model sync (state, not a ref, because the sync runs during render).
  const [pendingFocus, setPendingFocus] = useState<ReadonlySet<string> | null>(null)

  // React Flow needs local state to animate drags and selection, so rebuild it from the model
  // whenever the model changes, carrying `selected` over so a rename doesn't drop the selection.
  if (syncedVersion !== version) {
    setSyncedVersion(version)
    // Freshly created elements replace the previous selection.
    const selected = pendingFocus ?? new Set([...nodes, ...edges].filter((e) => e.selected).map((e) => e.id))
    setPendingFocus(null)
    setNodes(toNodes(diagram).map((n) => ({ ...n, selected: selected.has(n.id) })))
    setEdges(toEdges(diagram).map((e) => ({ ...e, selected: selected.has(e.id) })))
  }

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
    gone.forEach((n) => deleteFlow.request(diagram, { kind: n.type === 'resource' ? 'placement' : 'component', id: n.id }))
    // Edges attached to a deleted node are handled by the cascade, and must survive a pending confirmation.
    goneEdges
      .filter((e) => !goneIds.has(e.source) && !goneIds.has(e.target))
      .forEach((e) => deleteFlow.request(diagram, { kind: 'link', id: e.id }))
    return false
  }

  // React Flow has no pane double-click event; only the pane itself counts as empty canvas.
  const onDoubleClick = (e: MouseEvent) => {
    if (!isEmptyCanvas(e.target)) return
    const point = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    setPendingFocus(new Set([createComponentAt(diagram, point, rename).id]))
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
      // A rejected paste (MISSING_RESOURCE) changes nothing, so the reason is posted instead of thrown.
      const paste = (fragment: Fragment, offset: { x: number; y: number }) => {
        try {
          const added = workspace.paste(diagram, fragment, offset)
          setPendingFocus(new Set([...added.components, ...added.placements, ...added.links].map((x) => x.id)))
        } catch (err) {
          if (!(err instanceof DomainError)) throw err
          notifier.post('paste', err.message, 'transient')
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
        const { fragment, sizes } = copied
        paste(fragment, offsetToCenter(fragment, screenToFlowPosition(screen), sizes))
        return
      }
      const ids = new Set(nodes.filter((n) => n.selected).map((n) => n.id))
      // Acting on nothing keeps the previous copy instead of clearing it.
      if (ids.size === 0) return
      // Cmd+D is the browser's bookmark shortcut, so it is only taken over when it does something.
      e.preventDefault()
      const fragment = workspace.copy(diagram, ids)
      if (action === 'copy') {
        const sizes = new Map<string, Size>()
        for (const n of nodes) if (ids.has(n.id) && n.measured?.width && n.measured.height) sizes.set(n.id, { width: n.measured.width, height: n.measured.height })
        clipboard.current = { fragment, sizes }
        return
      }
      // Duplicate bypasses the clipboard so it doesn't overwrite what the user copied.
      rename.cancel()
      paste(fragment, { x: DUPLICATE_OFFSET, y: DUPLICATE_OFFSET })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [nodes, clipboard, workspace, diagram, rename, screenToFlowPosition, notifier])

  return (
    <RenameContext.Provider value={rename}>
      <div
        ref={canvas}
        style={{ width: '100%', height: '100%' }}
        onDoubleClick={onDoubleClick}
        onPointerMove={(e) => {
          cursor.current = { x: e.clientX, y: e.clientY }
        }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onEdgeDoubleClick={(_, edge) => rename.start(edge.id)}
          defaultViewport={{ ...diagram.viewport }}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStart={() => rename.cancel()}
          // Dragging one member of a multi-selection moves all of them, so persist every moved node.
          onNodeDragStop={(_, __, moved) => moved.forEach((n) => diagram.positioned(n.id)?.setPosition(n.position))}
          onSelectionDragStart={() => rename.cancel()}
          onSelectionDragStop={(_, moved) => moved.forEach((n) => diagram.positioned(n.id)?.setPosition(n.position))}
          // Loose mode lets a side handle (one source and one target Handle per side) start or end a Link.
          connectionMode={ConnectionMode.Loose}
          onPaneContextMenu={(e) => {
            e.preventDefault()
            setMenu({ screen: { x: e.clientX, y: e.clientY }, point: screenToFlowPosition({ x: e.clientX, y: e.clientY }) })
          }}
          onPaneClick={() => setMenu(null)}
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
            if (n.length + e.length !== 1) return onSelectionChange(null)
            onSelectionChange(
              n.length ? { kind: n[0].type === 'resource' ? 'placement' : 'component', id: n[0].id } : { kind: 'link', id: e[0].id },
            )
          }}
          // Double-click renames a Component or Link, or creates a Component, so it must not also zoom.
          zoomOnDoubleClick={false}
        >
          <Background />
        </ReactFlow>
        {menu && (
          <div className="canvas-menu" role="menu" style={{ left: menu.screen.x, top: menu.screen.y }}>
            {(Object.keys(RESOURCE_KINDS) as ResourceKind[]).map((kind) => (
              <button
                type="button"
                role="menuitem"
                key={kind}
                onClick={() => {
                  setPicking({ kind, point: menu.point })
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
