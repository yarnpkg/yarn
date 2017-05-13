/* @flow */

const realInquirer = (require: any).requireActual('inquirer');

realInquirer.prompt = jest.fn(questions => {
  const chosenVersion = questions[0].choices[0];
  return Promise.resolve({package: chosenVersion});
});

module.exports = realInquirer;
