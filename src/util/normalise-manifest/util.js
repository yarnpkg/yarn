/* @flow */

import type {PersonObject} from '../../types.js';

const validateLicense = require('validate-npm-package-license');
const _ = require('lodash');

export function isValidLicense(license: string): boolean {
  return validateLicense(license).validForNewPackages;
}

export function stringifyPerson(person: any): any | string {
  if (!_.isPlainObject(person)) {
    return person;
  }

  const parts = [];
  if (person.name) {
    parts.push(person.name);
  }

  const email = person.email || person.mail;
  if (email) {
    parts.push(`<${email}>`);
  }

  const url = person.url || person.web;
  if (url) {
    parts.push(`(${url})`);
  }

  return parts.join(' ');
}

export function parsePerson(person: any): any | PersonObject {
  if (typeof person !== 'string') {
    return person;
  }

  // format: name (url) <email>
  const obj = {};

  let name = person.match(/^([^\(<]+)/);
  if (name) {
    name = name[0].trim();
    if (name) {
      obj.name = name;
    }
  }

  const email = person.match(/<([^>]+)>/);
  if (email) {
    obj.email = email[1];
  }

  const url = person.match(/\(([^\)]+)\)/);
  if (url) {
    obj.url = url[1];
  }

  return obj;
}

export function normalisePerson(person: mixed): mixed | PersonObject {
  return parsePerson(stringifyPerson(person));
}

export function extractDescription(readme: ?string): ?string {
  if (!readme) {
    return undefined;
  }

  // split into lines
  const lines = readme.trim().split('\n').map((line): string => line.trim());

  // find the start of the first paragraph, ignore headings
  let start = 0;
  for (; start < lines.length; start++) {
    const line = lines[start];
    if (line && line.match(/^(#|$)/)) {
      // line isn't empty and isn't a heading so this is the start of a paragraph
      start++;
      break;
    }
  }

  // skip newlines from the header to the first line
  while (start < lines.length && !lines[start]) {
    start++;
  }

  // continue to the first non empty line
  let end = start;
  while (end < lines.length && lines[end]) {
    end++;
  }

  return lines.slice(start, end).join(' ');
}
