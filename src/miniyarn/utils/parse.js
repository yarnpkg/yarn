export function parseJson(string) {
  if (string instanceof Buffer) string = string.toString();

  return JSON.parse(string);
}

export function stringifyJson(string) {
  return JSON.stringify(string);
}
