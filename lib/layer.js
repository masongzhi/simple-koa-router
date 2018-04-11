var pathToRegExp = require('path-to-regexp');

module.exports = Layer;

function Layer(path, methods, middleware) {
  this.methods = [];
  this.stack = Array.isArray(middleware) ? middleware : [middleware];

  methods.forEach(function (method) {
    this.methods.push(method.toUpperCase());
  }, this);

  this.regexp = pathToRegExp(path, this.paramNames, this.opts);
  this.path = path;
};

/**
 * 因为最简版没有用到正则路径，所以是否match的条件是与this.path相等
 * @param path
 * @returns {boolean}
 */
Layer.prototype.match = function (path) {
  return this.regexp.test(path);
};
