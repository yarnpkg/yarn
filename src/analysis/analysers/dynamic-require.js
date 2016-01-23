// Find potential dynamic requires that could be dangerous. Few notes:
//
// - We need to disallow using `require` as a value since we can't track it.
// - We can safely allow `require`s that are binary + expressions where the left side is a
//   string that starts with a special character.
// - We need to disallow `require`s to `module` too as that will give direct access to
//   module APIs.
// - We need to restrict access to `require.cache` and thus any computed access to
//   `require`.
// - Only allow access to `module.exports`, refuse use of `module` as a value. `module`
//   has several properties that can be escaped such as `parent` and `require`.
//
