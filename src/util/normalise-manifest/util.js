/**
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 */

import type { PersonObject } from "../../types.js";

let _ = require("lodash");

export function stringifyPerson(person: any): any | string {
  if (!_.isPlainObject(person)) {
    return person;
  }

  let parts = [];
  if (person.name) parts.push(person.name);

  let email = person.email || person.mail;
  if (email) parts.push(`<${email}>`);

  let url = person.url || person.web;
  if (url) parts.push(`(${url})`);

  return parts.join(" ");
}

export function parsePerson(person: any): any | PersonObject {
  if (typeof person !== "string") {
    return person;
  }

  // format: name (url) <email>
  let obj = {};

  let name = person.match(/^([^\(<]+)/);
  if (name) {
    name = name[0].trim();
    if (name) obj.name = name;
  }

  let email = person.match(/<([^>]+)>/);
  if (email) {
    obj.email = email[1];
  }

  let url = person.match(/\(([^\)]+)\)/);
  if (url) {
    obj.url = url[1];
  }

  return obj;
}

export function normalisePerson(person: mixed): mixed | PersonObject {
  return parsePerson(stringifyPerson(person));
}

export function extractDescription(readme: string): ?string {
  if (!readme) return;

  // split into lines
  let lines = readme.trim().split("\n").map((line) => line.trim());

  // find the start of the first paragraph, ignore headings
  let start = 0;
  for (; start < lines.length; start++) {
    let line = lines[start];
    if (line && line.match(/^(#|$)/)) {
      // line isn't empty and isn't a heading so this is the start of a paragraph
      start++;
      break;
    }
  }

  // skip newlines from the header to the first line
  while (start < lines.length && !lines[start]) start++;

  // continue to the first non empty line
  let end = start;
  while (end < lines.length && lines[end]) end++;

  return lines.slice(start, end).join(" ");
}
