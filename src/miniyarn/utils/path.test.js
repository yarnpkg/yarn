import * as pathUtils from 'miniyarn/utils/path';

describe(`pathUtils.normalize`, () => {
  test.concurrent(`it should return a single dot if nothing changes`, async () => {
    expect(pathUtils.normalize(`.`)).toEqual(`.`);
    expect(pathUtils.normalize(`./`)).toEqual(`.`);
    expect(pathUtils.normalize(`./a/..`)).toEqual(`.`);
  });

  test.concurrent(`it should never return a leading ./`, async () => {
    expect(pathUtils.normalize(`./a/b/c`)).toEqual(`a/b/c`);
    expect(pathUtils.normalize(`.\\a/b/c`)).toEqual(`a/b/c`);
  });

  test.concurrent(`it should never return backslashes`, async () => {
    expect(pathUtils.normalize(`a\\b\\c`)).toEqual(`a/b/c`);
  });
});

describe(`pathUtils.isAbsolute`, () => {
  test.concurrent(`it should return true if the path starts with a drive letter`, async () => {
    expect(pathUtils.isAbsolute(`c:/a/b/c`)).toEqual(true);
  });
});

describe(`pathUtils.isRelative`, () => {
  test.concurrent(`it should return false if the path starts with a drive letter`, async () => {
    expect(pathUtils.isRelative(`c:/a/b/c`)).toEqual(false);
  });
});

describe(`pathUtils.isForward`, () => {
  test.concurrent(`it should return true if the path always stays in the same filesystem hierarchy`, async () => {
    expect(pathUtils.isForward(`a/b/c`)).toEqual(true);
    expect(pathUtils.isForward(`./a/b/c`)).toEqual(true);
  });

  test.concurrent(`it should return false if the path go back in the filesystem hierarchy`, async () => {
    expect(pathUtils.isForward(`../a/b/c`)).toEqual(false);
  });

  test.concurrent(`it should return false even if the parent directives are hidden deep into the path`, async () => {
    expect(pathUtils.isForward(`a/b/../../../c`)).toEqual(false);
  });

  test.concurrent(
    `it should return true if the path stays in the same filesystem hierarchy even with the parent directives`,
    async () => {
      expect(pathUtils.isForward(`a/b/../c`)).toEqual(true);
    },
  );
});
