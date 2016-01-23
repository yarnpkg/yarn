/* @flow */

/**
 * Determines if a given array contains the min number of acceptable arguments.
 */

export function hasValidArgLength(
  requiredLength: number,
  minLength: number,
  args: Array<string> = []
): boolean {
  if (requiredLength !== undefined) {
    return minLength === args.length;
  }

  if (minLength !== undefined) {
    return args.length >= minLength;
  }

  return true;
}

/**
 * Gets the subarguments for a given command.
 */

export function getSubArguments(
  args: Array<string> = [],
  minArgumentLength: number = 0
): string {
  return args.slice(minArgumentLength).join(" ");
}
