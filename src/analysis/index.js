/* @flow */

import type { AnalysisFileEntry as File } from "../types.js";
import walk from "./walk.js";
import map from "../util/map.js";

type FileMap = { [loc: string]: File };
type FileEntries = Array<File>;

type AnalysisEntry = {
  type: "new",
  file: File
} | {
  type: "deleted",
  file: File
} | {
  type: "modified",
  files: [File, File]
};
type AnalysisEntries = Array<AnalysisEntry>;

function buildByRelative(files: FileEntries): FileMap {
  let obj = map();
  for (let file of files) {
    obj[file.relative] = file;
  }
  return obj;
}

function maybePushIfChanged(a: File, b: File, changes) {
  if (a.size === b.size && a.mode === b.mode) {
    if (a.type === "symlink" && b.type === "symlink") {
      if (a.content === b.content) return;
    } else {
      if (a.hash === b.hash) return;
    }
  }

  changes.push({
    type: "modified",
    files: [a, b]
  });
}

export async function analyse(old: string, latest?: ?string): Promise<AnalysisEntries> {
  let changes: AnalysisEntries = [];

  // get old file structure
  let oldFiles: FileEntries  = await walk(old);
  let oldByRelative: FileMap = buildByRelative(oldFiles);

  if (latest) {
    // get new file structure
    let latestFiles: FileEntries = await walk(latest);
    let latestByRelative: FileMap = buildByRelative(latestFiles);

    // get new and same file entries
    for (let file of latestFiles) {
      let existing = oldByRelative[file.relative];
      if (existing) {
        maybePushIfChanged(existing, file, changes);
      } else {
        changes.push({ type: "new", file });
      }
    }

    // get removed file entries
    for (let file of oldFiles) {
      if (!latestByRelative[file.relative]) {
        changes.push({ type: "deleted", file });
      }
    }
  } else {
    for (let file of oldFiles) {
      changes.push({ type: "new", file });
    }
  }

  return changes;
}
