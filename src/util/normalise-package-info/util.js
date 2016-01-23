/* @flow */

import type { PersonObject } from "../../types";

let _ = require("lodash");

export const README_NOT_FOUND_MESSAGE = "ERROR: No README data found!";

export function stringifyPerson(person: any): any | string {
  if (!_.isPlainObject(person)) {
    return person;
  }

  let parts = [];
  if (person.name) parts.push(person.name);

  let url = person.url || person.web;
  if (url) parts.push(`(${url})`);

  let email = person.email || person.mail;
  if (email) parts.push(`<${email}>`);

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
  if (readme === README_NOT_FOUND_MESSAGE) return;

  // split into lines
  let lines = readme.trim().split("\n").map(line => line.trim());

  // find the start of the first paragraph, ignore headings
  let start = 0;
  for (; start < lines.length; start++) {
    let line = lines[start];
    if (line && line.match(/^(#|$)/)) {
      // line isn't empty and isn't a heading so this is the start of a paragraph
      break;
    }
  }

  // find the end of the first paragraph. this is determined by the first empty line
  let end = start;
  for (; end < lines.length; end++) {
    let line = lines[start];
    if (!line) {
      // line is empty so this is the end of the paragraph
      break;
    }
  }

  return lines.slice(start, end).join(" ");
}
