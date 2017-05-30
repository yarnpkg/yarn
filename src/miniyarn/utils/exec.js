import * as Cp from 'child_process';

export async function spawnCommand(command, options) {
  return new Promise((resolve, reject) => {
    let process = Cp.spawn(
      command,
      Object.assign({}, options, {
        shell: true,
      }),
    );

    process.on(`error`, error => {
      reject(error);
    });

    process.on(`close`, code => {
      resolve(code);
    });
  });
}

export async function execCommand(command, options) {
  return new Promise((resolve, reject) => {
    Cp.exec(command, options, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`Failed to execute "${command}" (${(stderr || stdout || err.message).trim()})`));
      } else {
        resolve({stdout, stderr});
      }
    });
  });
}

export async function execFile(path, args, options) {
  return new Promise((resolve, reject) => {
    Cp.execFile(path, args, options, (err, stdout, stderr) => {
      if (err) {
        reject(
          new Error(
            `Failed to execute "${path}${args
              .map(arg => ` ${arg}`)
              .join(``)}" (${(stderr || stdout || err.message).trim()})`,
          ),
        );
      } else {
        resolve({stdout, stderr});
      }
    });
  });
}
