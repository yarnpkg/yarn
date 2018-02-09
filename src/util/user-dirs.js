/* @flow */

const path = require('path');
const userHome = require('./user-home-dir').default;

export function getDataDir(): string {
  if (process.platform === 'win32') {
    return path.join(getLocalAppDataDir(), 'Data');
  } else if (process.env.XDG_DATA_HOME) {
    return path.join(process.env.XDG_DATA_HOME, 'yarn');
  } else {
    // This could arguably be ~/Library/Application Support/Yarn on Macs,
    // but that feels unintuitive for a cli tool

    // Instead, always use the typical location of XDG_DATA_HOME
    return path.join(userHome, '.local', 'share', 'yarn');
  }
}

export function getCacheDir(): string {
  if (process.platform === 'win32') {
    // process.env.TEMP also exists, but most apps put caches here
    return path.join(getLocalAppDataDir(), 'Cache');
  } else if (process.env.XDG_CACHE_HOME) {
    return path.join(process.env.XDG_CACHE_HOME, 'yarn');
  } else if (process.platform === 'darwin') {
    return path.join(userHome, 'Library', 'Caches', 'Yarn');
  } else {
    return path.join(userHome, '.cache', 'yarn');
  }
}

export function getConfigDir(): string {
  if (process.platform === 'win32') {
    return path.join(getLocalAppDataDir(), 'Config');
  } else if (process.env.XDG_CONFIG_HOME) {
    return path.join(process.env.XDG_CONFIG_HOME, 'yarn');
  } else {
    return path.join(userHome, '.config', 'yarn');
  }
}

function getLocalAppDataDir(): string {
  return path.join(process.env.LOCALAPPDATA || path.join(userHome, 'AppData', 'Local'), 'Yarn');
}
