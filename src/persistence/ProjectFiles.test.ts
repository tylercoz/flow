import { describe, expect, it } from 'vitest'
import { History } from '../domain/History'
import { Navigator } from '../domain/Navigator'
import { Notifier } from '../domain/Notifier'
import type { Scheduler } from '../domain/Scheduler'
import { Workspace } from '../domain/Workspace'
import type { FileTransfer, PickedFile } from './FileTransfer'
import { ProjectFiles } from './ProjectFiles'
import { WorkspaceSerializer } from './WorkspaceSerializer'

const scheduler: Scheduler = { set: () => 0 as never, cancel: () => {} }

class FakeFiles implements FileTransfer {
  downloads: { filename: string; text: string }[] = []
  next: PickedFile | null = null
  download(filename: string, text: string): void {
    this.downloads.push({ filename, text })
  }
  pick(): Promise<PickedFile | null> {
    return Promise.resolve(this.next)
  }
}

function setup() {
  let n = 0
  const ids = { next: () => `id${++n}` }
  const workspace = Workspace.empty(ids, () => '2024-01-01T00:00:00.000Z')
  const navigator = new Navigator(workspace)
  const history = new History(workspace, navigator)
  history.start()
  const notifier = new Notifier(scheduler)
  const files = new FakeFiles()
  const serializer = new WorkspaceSerializer()
  const project = new ProjectFiles(workspace, serializer, history, navigator, notifier, files, ids, () => '2025-05-05T00:00:00.000Z')
  return { workspace, history, navigator, notifier, files, serializer, project }
}

describe('ProjectFiles', () => {
  it('is clean at first, dirty after an edit, and clean again after undo', () => {
    const { workspace, history, project } = setup()
    expect(project.isDirty).toBe(false)
    workspace.setProjectName('Shop')
    expect(project.isDirty).toBe(true)
    history.undo()
    expect(project.isDirty).toBe(false)
  })

  it('does not count panning as a change', () => {
    const { workspace, project } = setup()
    workspace.root.setViewport({ x: 9, y: 9, zoom: 2 })
    expect(project.isDirty).toBe(false)
  })

  it('save downloads a slugged file, stamps the time and marks clean', () => {
    const { workspace, files, project, serializer } = setup()
    workspace.setProjectName('My Shop!')
    project.save()
    expect(files.downloads).toHaveLength(1)
    expect(files.downloads[0].filename).toBe('my-shop.flow.json')
    expect(serializer.deserialize(JSON.parse(files.downloads[0].text)).project.updatedAt).toBe('2025-05-05T00:00:00.000Z')
    expect(project.isDirty).toBe(false)
  })

  it('falls back to a default file name', () => {
    const { workspace, files, project } = setup()
    workspace.setProjectName('???')
    project.save()
    expect(files.downloads[0].filename).toBe('project.flow.json')
  })

  it('opens a saved file, replacing content and clearing History', async () => {
    const source = setup()
    source.workspace.setProjectName('Source')
    source.workspace.addDiagram('Second')
    source.project.save()
    const target = setup()
    target.workspace.setProjectName('Target')
    target.files.next = { name: 'source.flow.json', text: source.files.downloads[0].text }
    expect(await target.project.open()).toBe(true)
    expect(target.workspace.project.name).toBe('Source')
    expect(target.workspace.diagrams.map((d) => d.name)).toEqual(['Diagram 1', 'Second'])
    expect(target.history.canUndo).toBe(false)
    expect(target.project.isDirty).toBe(false)
  })

  it('does nothing when the picker is cancelled', async () => {
    const { workspace, project } = setup()
    workspace.setProjectName('Keep')
    expect(await project.open()).toBe(false)
    expect(workspace.project.name).toBe('Keep')
  })

  it.each([
    ['not JSON', 'nope'],
    ['an unsupported version', JSON.stringify({ schemaVersion: 13 })],
  ])('keeps the current project and says so when the file is %s', async (_, text) => {
    const { workspace, notifier, files, project } = setup()
    workspace.setProjectName('Keep')
    files.next = { name: 'bad.json', text }
    expect(await project.open()).toBe(false)
    expect(workspace.project.name).toBe('Keep')
    expect(notifier.messages).toEqual([expect.objectContaining({ key: 'project-file' })])
  })

  it('starts a new empty project and clears History', () => {
    const { workspace, history, project } = setup()
    workspace.setProjectName('Old')
    workspace.addDiagram('Second')
    project.newProject()
    expect(workspace.project.name).toBe('Untitled project')
    expect(workspace.diagrams).toHaveLength(1)
    expect(history.canUndo).toBe(false)
    expect(project.isDirty).toBe(false)
  })
})
