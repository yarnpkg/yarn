// Detect globals being assigned, include places where globals are used as values.
// This does not prevent access to globals via the prototype chain such as:
//
//   ({}).__proto__ === Object;
//
// This would need to be combined with a runtime patch of:
//
//   Object.freeze(Object);
//   Object.freeze(Object.prototype);
//   // same for all other type variables
//
