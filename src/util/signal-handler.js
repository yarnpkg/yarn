/* @flow */
import {forwardSignalToSpawnedProcesses} from './child.js';

function forwardSignalAndExit(signal: string) {
  forwardSignalToSpawnedProcesses(signal);
  process.exit(1); // eslint-disable-line no-process-exit
}

export default function handleSignals() {
  process.on('SIGTERM', () => {
    forwardSignalAndExit('SIGTERM');
  });
}
