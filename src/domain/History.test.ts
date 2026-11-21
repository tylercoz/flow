import { describe, expect, it, vi } from 'vitest'
import { ChangeSignal } from './ChangeSignal'
import { History, type Restorable } from './History'

class FakeWorkspace implements Restorable {
  private readonly signal = new ChangeSignal()
  subscribe = this.signal.subscribe
  getVersion = this.signal.getVersion
  content: string

  constructor(content = '') {
    this.content = content
  }

  set(content: string): void {
    this.content = content
    this.signal.notify()
  }

  capture(): string {
    return this.content
  }

  replaceContent(snapshot: string): void {
    this.set(snapshot)
  }
}

function setup(initial = '', limit?: number) {
  const workspace = new FakeWorkspace(initial)
  const levels = { reconcile: vi.fn() }
  const history = new History(workspace, levels, limit)
  history.start()
  return { workspace, levels, history }
}

describe('History', () => {
  it('starts with empty stacks', () => {
    const { history } = setup('a')
    expect(history.canUndo).toBe(false)
    expect(history.canRedo).toBe(false)
  })

  it('records an edit, undoes and redoes it, and reports availability after each step', () => {
    const { workspace, history, levels } = setup('a')
    workspace.set('b')
    expect(history.canUndo).toBe(true)
    expect(history.canRedo).toBe(false)

    history.undo()
    expect(workspace.content).toBe('a')
    expect(history.canUndo).toBe(false)
    expect(history.canRedo).toBe(true)
    expect(levels.reconcile).toHaveBeenCalledTimes(1)

    history.redo()
    expect(workspace.content).toBe('b')
    expect(history.canUndo).toBe(true)
    expect(history.canRedo).toBe(false)
  })

  it('clears the redo stack on a new edit after undo', () => {
    const { workspace, history } = setup('a')
    workspace.set('b')
    history.undo()
    workspace.set('c')
    expect(history.canRedo).toBe(false)
    history.undo()
    expect(workspace.content).toBe('a')
    expect(history.canUndo).toBe(false)
  })

  it('does nothing on undo or redo with empty stacks', () => {
    const { workspace, history, levels } = setup('a')
    const listener = vi.fn()
    history.subscribe(listener)
    history.undo()
    history.redo()
    expect(workspace.content).toBe('a')
    expect(listener).not.toHaveBeenCalled()
    expect(levels.reconcile).not.toHaveBeenCalled()
  })

  it('records one step for typing "abc" inside a group', () => {
    const { workspace, history } = setup('')
    history.beginGroup()
    workspace.set('a')
    workspace.set('ab')
    workspace.set('abc')
    history.endGroup()
    expect(history.canUndo).toBe(true)
    history.undo()
    expect(workspace.content).toBe('')
    expect(history.canUndo).toBe(false)
  })

  it('records nothing when a group ends with the original content', () => {
    const { workspace, history } = setup('x')
    history.beginGroup()
    workspace.set('xy')
    workspace.set('x')
    history.endGroup()
    expect(history.canUndo).toBe(false)
  })

  it('closes an open group on undo so the group is one step', () => {
    const { workspace, history } = setup('')
    history.beginGroup()
    workspace.set('a')
    workspace.set('ab')
    history.undo()
    expect(workspace.content).toBe('')
    history.redo()
    expect(workspace.content).toBe('ab')
  })

  it('drops the oldest steps beyond the limit', () => {
    const { workspace, history } = setup('0', 2)
    workspace.set('1')
    workspace.set('2')
    workspace.set('3')
    history.undo()
    history.undo()
    expect(workspace.content).toBe('1')
    expect(history.canUndo).toBe(false)
    history.redo()
    history.redo()
    history.redo()
    expect(workspace.content).toBe('3')
  })

  it('bounds the redo stack by the limit', () => {
    const { workspace, history } = setup('0', 2)
    workspace.set('1')
    workspace.set('2')
    history.undo()
    history.undo()
    expect(history.canRedo).toBe(true)
    history.redo()
    history.redo()
    expect(workspace.content).toBe('2')
    expect(history.canRedo).toBe(false)
  })

  it('notifies subscribers once per recorded step and per restore', () => {
    const { workspace, history } = setup('a')
    const listener = vi.fn()
    history.subscribe(listener)
    workspace.set('b')
    expect(listener).toHaveBeenCalledTimes(1)
    history.undo()
    expect(listener).toHaveBeenCalledTimes(2)
  })
})
