/* @flow */

import type { AnalysisFileEntry as File } from "../types.js";
import similarity from "./text/similarity.js";
import walk from "./walk.js";
import map from "../util/map.js";

type FileMap = { [loc: string]: File };
type FileEntries = Array<File>;

type ActionAnalysisEntry = {
  type: "deleted" | "new",
  file: File
};

type ChangedAnalysisEntry = {
  type: "renamed" | "modified",
  files: [File, File]
};

type AnalysisEntry = ActionAnalysisEntry | ChangedAnalysisEntry;
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
      if (a.location === b.location) return;
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
    //
    let newFiles: Array<File> = [];

    // get new file structure
    let latestFiles: FileEntries = await walk(latest);
    let latestByRelative: FileMap = buildByRelative(latestFiles);

    // get new and same file entries
    for (let file of latestFiles) {
      let existing = oldByRelative[file.relative];
      if (existing) {
        maybePushIfChanged(existing, file, changes);
      } else {
        newFiles.push(file);
      }
    }

    // get removed and renamed file entries
    for (let file of oldFiles) {
      if (latestByRelative[file.relative]) {
        // it exists
        continue;
      }

      // check whether the deleted file is at least 80% similar to any new files
      if (file.type === "binary" || file.type === "file") {
        let maxSimilarity = 0;
        let renamedTo: ?File;

        for (let newFile of newFiles) {
          let similarity = 0;

          // it could be a binary so let's just go for this quick sloppy check
          if (newFile.hash === file.hash) {
            similarity = 1;
          }

          // if both files are plain text then perform a comparison
          if (!similarity && file.type === "file" && newFile.type === "file") {
            similarity = similarity(newFile.buffer, file.buffer);
          }

          if (similarity >= 0.80 && similarity > maxSimilarity) {
            maxSimilarity = similarity;
            renamedTo = newFile;
          }
        }

        if (renamedTo) {
          newFiles.splice(newFiles.indexOf(renamedTo), 1);
          changes.push({ type: "renamed", files: [file, renamedTo] });
          continue;
        }
      }

      // file doesn't exist in new location and we couldn't find a valid rename
      changes.push({ type: "deleted", file });
    }

    // by this point newFiles will have been filtered with all the renamed files so all
    // the files within are valid new ones
    for (let file of newFiles) {
      changes.push({ type: "new", file });
    }
  } else {
    for (let file of oldFiles) {
      changes.push({ type: "new", file });
    }
  }

  return changes;
}
