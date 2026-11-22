import type { DeleteFlow } from './DeleteFlow'
import { useStore } from './useStore'

const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`

export function ConfirmDialog({ deleteFlow }: { deleteFlow: DeleteFlow }) {
  const { pending } = useStore(deleteFlow)
  if (!pending) return null
  return (
    <div className="dialog-backdrop">
      <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-delete-title">
        <p id="confirm-delete-title">
          {pending.subject === 'component'
            ? `Deleting this component also deletes ${plural(pending.counts.contents, 'item')} inside it and ${plural(pending.counts.links, 'attached link')}. Continue?`
            : `Deleting this resource also deletes ${plural(pending.counts.placements, 'placement')} in all diagrams and ${plural(pending.counts.links, 'attached link')}. Continue?`}
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
