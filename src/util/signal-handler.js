/* @flow */
import {forwardSignalToSpawnedProcesses} from './child.js';

function forwardSignalAndExit(signal: string) {
  forwardSignalToSpawnedProcesses(signal);
  // We want to exit immediately here since `SIGTERM` means that
  // If we lose stdout messages due to abrupt exit, shoot the messenger?
  process.exit(1); // eslint-disable-line no-process-exit
}

export default function handleSignals() {
  process.on('SIGTERM', () => {
    forwardSignalAndExit('SIGTERM');
  });
}
