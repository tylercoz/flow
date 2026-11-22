// Components refer to an EnvironmentVariable by id, so renaming one updates every component that relies on it.
export type EnvironmentVariable = { id: string; name: string }
