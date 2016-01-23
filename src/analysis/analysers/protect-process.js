// Check if any files attempt to touch the `process` variable in potentially dangerous ways.
// Include cases where `process` is used as a value.
// Only allow references to specific safe `process.env` variables such as `NODE_ENV` etc.
