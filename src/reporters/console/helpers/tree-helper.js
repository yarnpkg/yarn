/* @flow */

const repeat = require('repeating');

// types
import type {Trees} from '../../types.js';

export type FormattedOutput = {
  end: boolean, 
  level: number, 
  hint: any, 
  color: string, 
  name: string, 
  formatter: any,
};

// public
export const sortTrees = (trees: Trees): Trees => {
  return trees.sort(function(tree1, tree2): number {
    return tree1.name.localeCompare(tree2.name);
  });
};

export const recurseTree = (tree: Trees, level: number, recurseFunc: Function) => {
  const treeLen = tree.length;
  const treeEnd = treeLen - 1;
  for (let i = 0; i < treeLen; i++) {
    recurseFunc(tree[i], level + 1, i === treeEnd);
  }
};

export const getFormattedOutput = (fmt: FormattedOutput): string => {
  const item = formatColor(fmt.color, fmt.name, fmt.formatter);
  const indent = getIndent(fmt.end, fmt.level);
  const suffix = getSuffix(fmt.hint, fmt.formatter);
  return `${indent}─ ${item}${suffix}\n`;
};

// private
const getIndentChar = (end: boolean) : string => {
  return end ? '└' : '├';
};

const getIndent = (end: boolean, level: number) : string => {
  const base = repeat('│  ', level);
  const indentChar = getIndentChar(end);
  const hasLevel =  base + indentChar;
  return level ? hasLevel : indentChar;
};

const getSuffix = (hint: any, formatter: any) : string => {
  return hint ? ` (${formatter.grey(hint)})` : '';
};

const formatColor = (color: string, strToFormat: string, formatter: any) : string => {
  return color ? formatter[color](strToFormat) : strToFormat;
};
