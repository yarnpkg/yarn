const fs = require('fs');

// outputs a string to the main CSV file
export function benchmark(str: string) {
  let log_location = process.env["YARN_LOG_PATH"] || "/tmp/yarn.csv";
  // let log_location = "/stemn/yarn/yarn.csv"
  fs.appendFileSync(log_location, str, function(err){if (err) throw err;});
}

// outputs a string to the debugging log file
export function debug(str: string) {
  let log_location = process.env["YARN_DEBUG_PATH"] || "/tmp/debug.log";
  // let log_location = "/stemn/yarn/debug.log"
  fs.appendFileSync(log_location, str, function(err){if (err) throw err;});
}

/*
  Other writes performed:
    -> src/reporters/console/console-rpeorter.js 
        -> Header (truncating log file)
        -> Footer (post-process log(s))
*/
