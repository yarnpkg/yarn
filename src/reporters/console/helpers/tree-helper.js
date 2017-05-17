/* @flow */

// types
import type {Trees} from '../../types.js';

export type FormattedOutput = {
  prefix: string,
  hint: any,
  color: string,
  name: string,
  formatter: any,
};

// public
export function sortTrees(trees: Trees): Trees {
  return trees.sort(function(tree1, tree2): number {
    return tree1.name.localeCompare(tree2.name);
  });
}

export function recurseTree(tree: Trees, prefix: string, recurseFunc: Function) {
  const treeLen = tree.length;
  const treeEnd = treeLen - 1;
  for (let i = 0; i < treeLen; i++) {
    const atEnd = i === treeEnd;
    recurseFunc(tree[i], prefix + getLastIndentChar(atEnd), prefix + getNextIndentChar(atEnd));
  }
}

export function getFormattedOutput(fmt: FormattedOutput): string {
  const item = formatColor(fmt.color, fmt.name, fmt.formatter);
  const suffix = getSuffix(fmt.hint, fmt.formatter);
  return `${fmt.prefix}─ ${item}${suffix}\n`;
}

function getNextIndentChar(end: boolean): string {
  return end ? '   ' : '│  ';
}

function getLastIndentChar(end: boolean): string {
  return end ? '└' : '├';
}

function getSuffix(hint: any, formatter: any): string {
  return hint ? ` (${formatter.grey(hint)})` : '';
}

function formatColor(color: string, strToFormat: string, formatter: any): string {
  return color ? formatter[color](strToFormat) : strToFormat;
}
