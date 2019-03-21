'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.isValidLicense = isValidLicense;
exports.stringifyPerson = stringifyPerson;
exports.parsePerson = parsePerson;
exports.normalizePerson = normalizePerson;
exports.extractDescription = extractDescription;
exports.extractRepositoryUrl = extractRepositoryUrl;


const validateLicense = require('validate-npm-package-license');

function isValidLicense(license) {
  return !!license && validateLicense(license).validForNewPackages;
}

function stringifyPerson(person) {
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

function parsePerson(person) {
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

function normalizePerson(person) {
  return parsePerson(stringifyPerson(person));
}

function extractDescription(readme) {
  if (typeof readme !== 'string' || readme === '') {
    return undefined;
  }

  // split into lines
  const lines = readme.trim().split('\n').map(line => line.trim());

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

function extractRepositoryUrl(repository) {
  if (!repository || typeof repository !== 'object') {
    return repository;
  }
  return repository.url;
}