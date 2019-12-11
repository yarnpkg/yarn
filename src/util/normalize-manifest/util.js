/* @flow */

import type {PersonObject} from '../../types.js';

const path = require('path');
const validateLicense = require('validate-npm-package-license');

const PARENT_PATH = /^\.\.([\\\/]|$)/;

export function isValidLicense(license: string): boolean {
  return !!license && validateLicense(license).validForNewPackages;
}

export function isValidBin(bin: string): boolean {
  return !path.isAbsolute(bin) && !PARENT_PATH.test(path.normalize(bin));
}

export function stringifyPerson(person: mixed): any {
  if (!person || typeof person !== 'object') {
    return person;
  }

  const parts = [];
  if (person.name) {
    parts.push(person.name);
  }

  const email = person.email || person.mail;
  if (typeof email === 'string') {
    parts.push(`<${email}>`);
  }

  const url = person.url || person.web;
  if (typeof url === 'string') {
    parts.push(`(${url})`);
  }

  return parts.join(' ');
}

export function parsePerson(person: mixed): any {
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

export function normalizePerson(person: mixed): mixed | PersonObject {
  return parsePerson(stringifyPerson(person));
}

export function extractDescription(readme: mixed): ?string {
  if (typeof readme !== 'string' || readme === '') {
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

export function extractRepositoryUrl(repository: mixed): any {
  if (!repository || typeof repository !== 'object') {
    return repository;
  }
  return repository.url;
}
