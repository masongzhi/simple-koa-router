var Layer = require('./layer');
var compose = require('koa-compose');

module.exports = Router;

var METHODS = ['HEAD', 'OPTIONS', 'GET', 'PUT', 'PATCH', 'POST', 'DELETE'];

/**
 * 构造函数Router，初始化methods和stack队列
 * @constructor
 */
function Router() {
  this.methods = METHODS;

  this.stack = [];
};

// 定义method方法
var LOWER_METHODS = METHODS.map(function (method) {
  return method.toLowerCase();
});
LOWER_METHODS.forEach(function (method) {
  Router.prototype[method] = function (path) {
    var middleware = Array.prototype.slice.call(arguments, 1);

    // 注册route
    this.register(path, [method], middleware);
    return this;
  };
});

// 注册route方法
Router.prototype.register = function (path, methods, middleware) {
  var stack = this.stack;

  var route = new Layer(path, methods, middleware);

  stack.push(route);

  return route;
};

/**
 * 根据path和method选择相应的route
 * @param path
 * @param method
 * @returns {{path: Array, pathAndMethod: Array, hitRoute: boolean}}
 */
Router.prototype.match = function (path, method) {
  var layers = this.stack;
  var layer;
  var matched = {
    path: [],
    pathAndMethod: [],
    hitRoute: false // 改为hitRoute更容易理解
  };

  for (var len = layers.length, i = 0; i < len; i++) {
    layer = layers[i];
    console.log('test ', layer.path);

    if (layer.match(path)) {
      matched.path.push(layer);

      // todo ~这个操作符是什么含义
      if (layer.methods.length === 0 || ~layer.methods.indexOf(method)) {
        matched.pathAndMethod.push(layer);
        if (layer.methods.length) matched.hitRoute = true;
      }
    }

    return matched;
  }
};

/**
 * 返回已注册的route，并通过koa-compose将中间件和执行函数压成一个函数，通过闭包返回
 * @returns {dispatch}
 */
Router.prototype.routes = function () {
  var router = this;
  var dispatch = function (ctx, next) {
    console.log('%s %s', ctx.method, ctx.path);

    var path = ctx.routerPath || ctx.path;
    var matched = router.match(path, ctx.method);

    console.log('matched==>>', matched);

    ctx.matched = matched.path;
    ctx.router = router;
    console.log('ctx.matched==>>', matched.path);

    if (!matched.hitRoute) return next();

    var matchedLayers = matched.pathAndMethod;

    var layerChain = matchedLayers.reduce(function(memo, layer) {
      return memo.concat(layer.stack);
    }, []);

    return compose(layerChain)(ctx, next);
  };

  return dispatch;
};
