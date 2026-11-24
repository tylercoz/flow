export type PickedFile = { name: string; text: string }

// Download and upload instead of the File System Access API, so it works in every browser.
export interface FileTransfer {
  download(filename: string, text: string): void
  /** Null when the user cancels the picker. */
  pick(): Promise<PickedFile | null>
}

export class BrowserFileTransfer implements FileTransfer {
  download(filename: string, text: string): void {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  pick(): Promise<PickedFile | null> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.json,application/json'
      input.addEventListener('change', () => {
        const file = input.files?.[0]
        if (!file) return resolve(null)
        file.text().then((text) => resolve({ name: file.name, text }), reject)
      })
      // Fires when the picker is dismissed, so the caller's promise does not hang.
      input.addEventListener('cancel', () => resolve(null))
      input.click()
    })
  }
}
