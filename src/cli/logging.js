import * as fs from '../../src/util/fs.js';

// outputs a string to the main CSV file
export function benchmark(str: string) {
  let log_location = "/stemn/yarn/yarn.csv"
  fs.appendFileSync(log_location, str, function(err){if (err) throw err;});
}

// outputs a string to the debugging log file
export function debug(str: string) {
  let log_location = "/stemn/yarn/debug.log"
  fs.appendFileSync(log_location, str, function(err){if (err) throw err;});
}

/*
  Other writes performed:
    -> header: truncate files
*/
