import {Minimatch} from 'minimatch';
import Path from 'path';

import * as archiveUtils from 'miniyarn/utils/archive';
import * as fsUtils from 'miniyarn/utils/fs';
import * as yarnUtils from 'miniyarn/utils/yarn';

export default concierge =>
  concierge
    .command(`pack [-o,--output PATH]`)
    .describe(`Build a release tarball for the current package`)
    .action(async args => {
      let {packagePath, packageInfo} = await yarnUtils.openPackage(args.dir);
      let env = await yarnUtils.openEnvironment(packagePath, args);

      let tarballPath = await getTarballPath(packageInfo, args.output || packagePath);
      let tarballWriter = await fsUtils.createFileWriter(tarballPath);

      let archivePacker = archiveUtils.createTarballWriter();
      archivePacker.pipe(tarballWriter);

      let includedPatterns = INCLUDED_PATTERNS.map(mapPattern);
      let ignoredPatterns = IGNORED_PATTERNS.map(mapPattern);
      let filesPatterns = packageInfo.files
        .concat([...packageInfo.bin.values(), packageInfo.main, packageInfo.browser])
        .filter(pattern => pattern)
        .map(mapPattern);

      let walker = fsUtils.walk(packagePath, {
        filter: path => {
          let patternPath = Path.relative(packagePath, path).replace(/^\.\//, ``);

          if (includedPatterns.some(pattern => pattern.match(patternPath))) return true;

          if (ignoredPatterns.some(pattern => pattern.match(patternPath))) return false;

          if (packageInfo.files.size === 0 || filesPatterns.some(pattern => pattern.match(patternPath))) return true;

          return false;
        },
      });

      walker.on(`data`, ({path, stats}) => {
        if (!stats.isFile()) return;

        let entryPath = Path.relative(packagePath, path).replace(/^\.\//, ``).replace(/^/, `package/`);
        let entryStream = fsUtils.createFileReader(path);

        archivePacker.entry({name: entryPath}, entryStream);
      });

      await walker.promise;

      archivePacker.finalize();

      await tarballWriter.promise;
    });

let INCLUDED_PATTERNS = [`package.json`, `README`, `CHANGES`, `CHANGELOG`, `HISTORY`, `LICENSE`, `LICENCE`, `NOTICE`];

let IGNORED_PATTERNS = [
  `CVS`,

  `.git`,
  `.svn`,
  `.hg`,

  `.npmrc`,
  `.yarnrc`,

  `node_modules`,
  `npm-debug.log*`,
  `config.gypi`,

  `.#*`,
  `*~`,
  `.*.swp`,
  `._*`,
  `*.orig`,

  `.lock-wscript`,
  `.wafpickle-N`,
  `.DS_Store`,

  `*-*.tar.gz`,
  `*-*.tgz`,
];

async function getTarballPath(packageInfo, output) {
  let outputDirectory;
  let outputName;

  if ((await fsUtils.exists(output)) && (await fsUtils.isDirectory(output))) {
    outputDirectory = output;
  } else {
    outputDirectory = Path.dirname(output);
    outputName = Path.basename(output);
  }

  if (!outputName) {
    let fileName = packageInfo.name || `unnamed`;
    let version = packageInfo.version || `x.x.x`;

    outputName = `${fileName}-${version}.tgz`;
  }

  return `${outputDirectory}/${outputName}`;
}

function mapPattern(pattern) {
  return new Minimatch(pattern, {
    matchBase: true,
  });
}
