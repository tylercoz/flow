import { useState } from 'react'
import type { Resource } from '../domain/Resource'
import { webUrl } from './webUrl'
// Shows a link while the value is a valid web URL and the field is not being edited; otherwise the input.
export function RemoteField({ resource, id }: { resource: Resource; id: string }) {
  const [editing, setEditing] = useState(false)
  const remote = resource.remote ?? ''
  const href = webUrl(remote)
  if (href && !editing) {
    return (
      <div className="remote-link">
        <a href={href} target="_blank" rel="noopener noreferrer">
          {remote}
        </a>
        <button type="button" onClick={() => setEditing(true)}>
          Edit
        </button>
      </div>
    )
  }
  return (
    <input
      id={id}
      type="url"
      placeholder="https://github.com/org/repo"
      value={remote}
      // Focused on entering edit mode so the Edit button leads straight to typing.
      autoFocus={editing}
      onChange={(e) => resource.setRemote(e.target.value)}
      onBlur={() => setEditing(false)}
    />
  )
}
