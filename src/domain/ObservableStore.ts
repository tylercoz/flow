export interface ObservableStore {
  subscribe(listener: () => void): () => void
  getVersion(): number
}
