import type { DeleteFlow } from './DeleteFlow'
import { useStore } from './useStore'

export function ConfirmDialog({ deleteFlow }: { deleteFlow: DeleteFlow }) {
  const { pending } = useStore(deleteFlow)
  if (!pending) return null

  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-delete-title">
      <p id="confirm-delete-title">
        Deleting this component also deletes {pending.contents} item{pending.contents === 1 ? '' : 's'} inside it and{' '}
        {pending.links} attached link{pending.links === 1 ? '' : 's'}. Continue?
      </p>
      <button type="button" onClick={() => deleteFlow.cancel()}>
        Cancel
      </button>
      <button type="button" onClick={() => deleteFlow.confirm()}>
        Delete
      </button>
    </div>
  )
}
