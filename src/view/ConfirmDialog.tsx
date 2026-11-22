import type { DeleteFlow } from './DeleteFlow'
import { useStore } from './useStore'

const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`

export function ConfirmDialog({ deleteFlow }: { deleteFlow: DeleteFlow }) {
  const { pending } = useStore(deleteFlow)
  if (!pending) return null
  const { counts } = pending
  return (
    <div className="dialog-backdrop">
      <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-delete-title">
        <p id="confirm-delete-title">
          {`Deleting this resource also deletes ${plural(counts.placements, 'placement')} in all diagrams and ${plural(counts.links, 'attached link')}.`}
          {counts.contents &&
            ` Its diagram holds ${plural(counts.contents.nodes, 'node')} and ${plural(counts.contents.links, 'link')}, which are deleted too.`}
          {' Continue?'}
        </p>
        <button type="button" onClick={() => deleteFlow.cancel()}>
          Cancel
        </button>
        <button type="button" className="btn-danger" onClick={() => deleteFlow.confirm()}>
          Delete
        </button>
      </div>
    </div>
  )
}
