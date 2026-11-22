// A null typeId means the port has no type yet. The id lets a Link keep its endpoint when ports are renamed or removed.
export type Port = { id: string; name: string; typeId: string | null }
// A port not yet in the model; Workspace.setPorts assigns its id.
export type NewPort = Omit<Port, 'id'> & { id?: string }
