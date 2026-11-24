// Belongs to one component and is meaningful only inside it, unlike an EnvironmentVariable, which is shared by id.
export type LocalVariable = { id: string; name: string }
// A variable not yet in the model; ComponentDefinition.setLocalVariables assigns its id.
export type NewLocalVariable = Omit<LocalVariable, 'id'> & { id?: string }
