import { ChangeSignal } from '../domain/ChangeSignal'
import type { History } from '../domain/History'
import type { IdGenerator } from '../domain/IdGenerator'
import type { Navigator } from '../domain/Navigator'
import type { Notifier } from '../domain/Notifier'
import type { ObservableStore } from '../domain/ObservableStore'
import { Workspace } from '../domain/Workspace'
import type { WorkspaceSnapshot } from '../domain/WorkspaceSnapshot'
import type { FileTransfer } from './FileTransfer'
import { PersistenceError } from './PersistenceError'
import type { WorkspaceSerializer } from './WorkspaceSerializer'

const NOTICE_KEY = 'project-file'

// Saves the project as a downloaded file and replaces it from an uploaded one.
// The browser never reports whether a download finished, so a save counts as done once the download starts.
export class ProjectFiles implements ObservableStore {
  private readonly signal = new ChangeSignal()
  // What the workspace looked like at the last save, open or new. Comparing contents rather than
  // flagging edits means undoing back to the saved state is clean again.
  private savedCapture: string
  private readonly workspace: Workspace
  private readonly serializer: WorkspaceSerializer
  private readonly history: History
  private readonly navigator: Navigator
  private readonly notifier: Notifier
  private readonly files: FileTransfer
  private readonly ids: IdGenerator
  private readonly now: () => string

  constructor(
    workspace: Workspace,
    serializer: WorkspaceSerializer,
    history: History,
    navigator: Navigator,
    notifier: Notifier,
    files: FileTransfer,
    ids: IdGenerator,
    now: () => string = () => new Date().toISOString(),
  ) {
    this.workspace = workspace
    this.serializer = serializer
    this.history = history
    this.navigator = navigator
    this.notifier = notifier
    this.files = files
    this.ids = ids
    this.now = now
    this.savedCapture = workspace.capture()
    workspace.subscribe(() => this.signal.notify())
  }

  subscribe = this.signal.subscribe
  getVersion = this.signal.getVersion

  get isDirty(): boolean {
    return this.workspace.capture() !== this.savedCapture
  }

  save(): void {
    this.workspace.stampSaved(this.now())
    this.files.download(fileName(this.workspace.project.name), JSON.stringify(this.serializer.serialize(this.workspace), null, 2))
    this.markClean()
  }

  // Leaves the current project untouched when the file cannot be read. Returns whether a project was opened.
  async open(): Promise<boolean> {
    const picked = await this.files.pick()
    if (!picked) return false
    let snapshot: WorkspaceSnapshot
    try {
      snapshot = this.serializer.deserialize(JSON.parse(picked.text))
    } catch (e) {
      if (!(e instanceof PersistenceError) && !(e instanceof SyntaxError)) throw e
      this.notifier.post(NOTICE_KEY, `Could not open ${picked.name}. It is not a Flow project this version can read.`, 'transient')
      return false
    }
    this.replaceWith(snapshot)
    return true
  }

  newProject(): void {
    this.replaceWith(Workspace.empty(this.ids, this.now).toSnapshot())
  }

  private replaceWith(snapshot: WorkspaceSnapshot): void {
    this.workspace.load(snapshot)
    // Undo across a swap would mix two projects.
    this.history.reset()
    this.navigator.reconcile()
    this.notifier.clear(NOTICE_KEY)
    this.markClean()
  }

  private markClean(): void {
    this.savedCapture = this.workspace.capture()
    this.signal.notify()
  }
}

function fileName(projectName: string): string {
  const slug = projectName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${slug || 'project'}.flow.json`
}
