'use strict';

module.exports = function(context) {
  var MESSAGE = 'Use a language key instead of a literal';
  var LOG_METHODS = ['info', 'log', 'step', 'error', 'warn', 'success'];

  function isLiteral(node) {
    return (
      node.type === 'Literal' ||
      (node.type === 'BinaryExpression' &&
        (isLiteral(node.left) || isLiteral(node.right)))
    );
  }

  function getCallee(node) {
    if (node.type !== 'CallExpression' || node.arguments.length === 0) {
      return;
    }

    var callee = node.callee;
    while (
      callee.type === 'MemberExpression' &&
      callee.property.type === 'MemberExpression'
    ) {
      callee = callee.property;
    }
    if (callee.type !== 'MemberExpression' || callee.computed) {
      return;
    }

    var object = callee.object;
    if (object.type !== 'Identifier' || object.name !== 'reporter') {
      return;
    }

    return callee;
  }

  return {
    CallExpression: function(node) {
      var callee = getCallee(node);
      if (callee && LOG_METHODS.indexOf(callee.property.name) >= 1) {
        var arg = node.arguments[node.arguments.length - 1];
        if (isLiteral(arg)) {
          context.report(arg, MESSAGE);
        }
      }
    },

    ThrowStatement: function(node) {
      var argument = node.argument;
      if (argument.type !== 'NewExpression') {
        return;
      }

      var callee = argument.callee;
      if (callee.type !== 'Identifier' || callee.name !== 'MessageError') {
        return;
      }

      var args = argument.arguments;
      if (args.length && isLiteral(args[0])) {
        context.report(args[0], MESSAGE);
      }
    },
  };
};

module.exports.schema = [];
