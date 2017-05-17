/* @flow */
import {fixCmdWinSlashes} from '../../src/util/fix-cmd-win-slashes.js';

const cmdCases = [
  ['fixes just slashed command', 'some/command', 'some\\command'],
  ['fixes slashed command in double quotes', '"./some/command/more"', '".\\some\\command\\more"'],
  ['slashed command in single quotes', "'./some/command/more'", "'.\\some\\command\\more'"],
  [
    'fixes slashed command with slashed param',
    './some/command/more slashed/param',
    '.\\some\\command\\more slashed/param',
  ],
  [
    'fixes slashed command in single quotes with two slashed params',
    "'./some/command/more' justparam slashed/param --param slashed/param2",
    "'.\\some\\command\\more' justparam slashed/param --param slashed/param2",
  ],
  [
    'fixes two slashed commands (&&) with two slashed params',
    "'./some/command/more' justparam slashed/param &&  ../another/command with/slashed/param",
    "'.\\some\\command\\more' justparam slashed/param &&  ..\\another\\command with/slashed/param",
  ],
  [
    'fixes three slashed commands (&&) with two slashed params',
    "'./some/command/more' justparam slashed/param &&" +
      '  "../another/command" with/slashed/param | ./another/more/command with/slashed/param',
    "'.\\some\\command\\more' justparam slashed/param &&" +
      '  "..\\another\\command" with/slashed/param | .\\another\\more\\command with/slashed/param',
  ],
  [
    'does not change nested command (inside the quotes)',
    'command -c bash "slashed/nested/cmd && nested/bin/some"',
    'command -c bash "slashed/nested/cmd && nested/bin/some"',
  ],
];

describe('fixCmdWinSlashes', () => {
  cmdCases.forEach(cmdCase => {
    const name = cmdCase[0];
    const original = cmdCase[1];
    const fixed = cmdCase[2];
    it(name, () => {
      expect(fixCmdWinSlashes(original)).toEqual(fixed);
    });
  });
});
