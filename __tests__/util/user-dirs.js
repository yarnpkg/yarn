/* @flow */

import {getDataDir, getCacheDir, getConfigDir} from '../../src/util/user-dirs';
import userHome from '../../src/util/user-home-dir';

const path = require('path');

describe('getDataDir', () => {
  describe('on windows', () => {
    beforeEach(() => {
      mockProcessPlatform('win32');
    });

    it('uses Yarn/data within LOCALAPPDATA if it exists', () => {
      process.env.LOCALAPPDATA = 'foo';
      expect(getDataDir()).toBe(path.join('foo', 'Yarn', 'Data'));
      delete process.env.LOCALAPPDATA;
    });

    it('uses AppData\\Local\\Data otherwise', () => {
      expect(getDataDir()).toBe(path.join(userHome, 'AppData', 'Local', 'Yarn', 'Data'));
    });
  });

  describe('on linux/darwin', () => {
    beforeEach(() => {
      mockProcessPlatform('linux');
    });

    it('uses XDG_DATA_HOME if it is set', () => {
      process.env.XDG_DATA_HOME = 'foo';
      expect(getDataDir()).toBe(path.join('foo', 'yarn'));
      delete process.env.XDG_DATA_HOME;
    });

    it('falls back to .local/share/yarn', () => {
      expect(getDataDir()).toBe(path.join(userHome, '.local', 'share', 'yarn'));
    });
  });
});

describe('getCacheDir', () => {
  describe('on windows', () => {
    beforeEach(() => {
      mockProcessPlatform('win32');
    });

    it('uses Yarn\\Cache within LOCALAPPDATA if it exists', () => {
      process.env.LOCALAPPDATA = 'foo';
      expect(getCacheDir()).toBe(path.join('foo', 'Yarn', 'Cache'));
      delete process.env.LOCALAPPDATA;
    });

    it('uses AppData\\Local\\Cache otherwise', () => {
      expect(getCacheDir()).toBe(path.join(userHome, 'AppData', 'Local', 'Yarn', 'Cache'));
    });
  });

  describe('on darwin (macOS)', () => {
    beforeEach(() => {
      mockProcessPlatform('darwin');
    });

    it('uses XDG_CACHE_HOME if it is set', () => {
      process.env.XDG_CACHE_HOME = 'foo';
      expect(getCacheDir()).toBe(path.join('foo', 'yarn'));
      delete process.env.XDG_CACHE_HOME;
    });

    it('falls back to Library/Caches/Yarn', () => {
      expect(getCacheDir()).toBe(path.join(userHome, 'Library', 'Caches', 'Yarn'));
    });
  });

  describe('on others (linux, etc)', () => {
    beforeEach(() => {
      mockProcessPlatform('linux');
    });

    it('uses XDG_CACHE_HOME if it is set', () => {
      process.env.XDG_CACHE_HOME = 'foo';
      expect(getCacheDir()).toBe(path.join('foo', 'yarn'));
      delete process.env.XDG_CACHE_HOME;
    });

    it('falls back to .cache/yarn', () => {
      expect(getCacheDir()).toBe(path.join(userHome, '.cache', 'yarn'));
    });
  });
});

describe('getConfigDir', () => {
  describe('on windows', () => {
    beforeEach(() => {
      mockProcessPlatform('win32');
    });

    it('uses Yarn\\Config within LOCALAPPDATA if it exists', () => {
      process.env.LOCALAPPDATA = 'foo';
      expect(getConfigDir()).toBe(path.join('foo', 'Yarn', 'Config'));
      delete process.env.LOCALAPPDATA;
    });

    it('uses AppData\\Local\\Config otherwise', () => {
      expect(getConfigDir()).toBe(path.join(userHome, 'AppData', 'Local', 'Yarn', 'Config'));
    });
  });

  describe('on linux/darwin', () => {
    beforeEach(() => {
      mockProcessPlatform('linux');
    });

    it('uses XDG_CONFIG_HOME if it is set', () => {
      process.env.XDG_CONFIG_HOME = 'foo';
      expect(getConfigDir()).toBe(path.join('foo', 'yarn'));
      delete process.env.XDG_CONFIG_HOME;
    });

    it('falls back to .config/yarn', () => {
      expect(getConfigDir()).toBe(path.join(userHome, '.config', 'yarn'));
    });
  });
});

function mockProcessPlatform(name: string) {
  // $FlowFixMe this is valid
  Object.defineProperty(process, 'platform', {
    get: jest.fn(() => name),
  });
}
