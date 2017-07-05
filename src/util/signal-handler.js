/* @flow */
import {forwardSignalToSpawnedProcesses} from './child.js';

function forwardSignalAndExit(signal: string) {
  forwardSignalToSpawnedProcesses(signal);
  process.exit(1);
}

export default function handleSignals() {
  process.on('SIGTERM', () => {
    forwardSignalAndExit('SIGTERM');
  });
}
