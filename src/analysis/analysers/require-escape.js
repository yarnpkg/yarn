// Check if the dependencies a module is trying to `require` exist in it's `package.json`.
// If they don't then it's a module potentially trying to escape and monkeypatch.
// Also check if a `require` is trying to look into the guts of a dependency. Could be
// attempting to monkeypatch it.
