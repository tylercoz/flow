# Clearing saved data

Flow keeps the workspace in the browser's `localStorage` under the key `flow.workspace`.

While the project is in development there are no migrations. After a `schemaVersion` bump, the app cannot read the old save. It shows "Saved data could not be read. Starting empty; changes will not be saved." and does not overwrite the old data.

The current `schemaVersion` is 8 (it added Resources and Placements). Saves with `schemaVersion` 7 cannot be read. Back up the old save if you want to keep it, then clear it.

Run these in the browser devtools console on the app's page.

## Back up the old workspace first (optional)

Copies the saved JSON to the clipboard so you can paste it into a file.

```js
copy(localStorage.getItem('flow.workspace'))
```

## Clear it

Reload the page afterwards. The app then starts with an empty workspace and autosave resumes.

```js
localStorage.removeItem('flow.workspace')
```
