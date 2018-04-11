# simple-koa-router
> test暂未补全

解读koa-router源码，并根据理解仿造一个精简版的router，之后应该不会更新拓展其他方法，多了反而对理解核心造成不必要的阻碍

### V0.0.1
实现基本的match、register、routes功能

### V0.0.2
实现对正则path的匹配

### V0.0.3
添加便于理解的log，增加readme个人总结

# 个人总结：解读并实现一个简单的koa-router
简书链接: [https://www.jianshu.com/p/7bf7f1368293](https://www.jianshu.com/p/7bf7f1368293)  
掘金链接: [https://juejin.im/post/5ace67a26fb9a028da7ce708](https://juejin.im/post/5ace67a26fb9a028da7ce708)

> Koa 应用程序是一个包含一组中间件函数的对象，它是按照类似堆栈的方式组织和执行的。 

这是 koa 对自己的介绍，其他 koa 依赖的库其实都可以算是中间件，koa-router 也不例外。

*ps: 本文代码中的中文解释是对代码的讲解，省略号(...)代表省略部分代码*
*文章最后有简版router的项目地址*

#### 对 koa-router 的猜想
通过 koa 最简单的 hellow world 例子可以看出原生对请求的处理方式:
```
const Koa = require('koa');
const app = new Koa();

app.use(async ctx => {
  ctx.body = 'Hello World';
});

app.listen(3000);
```
要是我们想简单的实现路由的话，可以添加一些判断条件
```
app.use(async ctx => {
  if (ctx.path === '/one' && ctx.method === 'get') {
    ctx.body = 'Hello World';
  } else {
    ctx.status = 404;
    ctx.body = '';
  }
});
```
这样的话能实现简单对路由的实现，不过路由越多的话消耗的性能也就越大，而且不容易对特殊路由添加中间件。而更好的方法是使用面向对象的方式，根据请求的 path 和 method 返回相应的中间件处理函数和执行函数。

#### 解读思路
这里要介绍下我解读 koa-router 源码的方法，我会先把 koa-router 的源码下载到本地，然后通读一遍（因为源码算是比较少的），从大体上知道 koa-router 执行流程，然后通过单元测试去 debug 分析。

#### Router 执行流程图
![koa-router 流程.png](https://upload-images.jianshu.io/upload_images/3708358-4be14d6677f6ddb5.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)


我认为 koa-router 最基本且核心的API有四个:
1. router.match
可以根据请求的 path 和 method 筛选出匹配的 route
2. router.register
注册 route
3. router.routes
返回用于 koa 加载的中间件，通过 koa-compose 将middlewares 压缩成一个函数
4. router.method(get、post等)
可以根据path、method 定义 router，并且可以将middleware绑定在路由上

#### 解读
我们可以结合代码和单元测试对源码进行理解，由最简单的测试开始debug：
```
it('router can be accecced with ctx', function (done) {
      var app = new Koa();
      var router = new Router();
      router.get('home', '/', function (ctx) {
          ctx.body = {
            url: ctx.router.url('home')
          };
      });

      console.log(router.routes()); // 这是我加的，查看最后加载的routes
      app.use(router.routes());
      request(http.createServer(app.callback()))
          .get('/')
          .expect(200)
          .end(function (err, res) {
              if (err) return done(err);
              expect(res.body.url).to.eql("/");
              done();
          });
  });
```
router.routes() 返回:
```
function dispatch(ctx, next) {
    debug('%s %s', ctx.method, ctx.path);
    var path = router.opts.routerPath || ctx.routerPath || ctx.path;
    var matched = router.match(path, ctx.method);
    var layerChain, layer, i;
    ...
    ctx.router = router;
    if (!matched.route) return next();
    // 获取已匹配的 routes (实例化 Layer 对象)
    var matchedLayers = matched.pathAndMethod
    ...
    // 若匹配了多个 route，则将多个执行函数 push 进一个数组
    layerChain = matchedLayers.reduce(function(memo, layer) {
      ...
      return memo.concat(layer.stack);
    }, []);

    return compose(layerChain)(ctx, next);
  }
```
**router.routes()** 返回一个 dispatch 函数，从中可以看出请求进来会经过 **router.match**(后面有分析)，然后将匹配到的 route 的执行函数 push 进数组，并通过 compose(koa-compose) 函数合并返回。

然后在打印出 compose(layerChain) 方法，可以看到其实最后请求执行的函数是对`ctx.body = {url: ctx.router.url('home')};` 的 compose 封装函数，在效果上相当于
```
app.use(ctx => {
  ctx.body = {
    url: ctx.router.url('home')
  };
});
```

* Router 构造函数
```
function Router(opts) {
  if (!(this instanceof Router)) {
    return new Router(opts);
  }

  this.opts = opts || {};
  // 定义各方法
  this.methods = this.opts.methods || [
    'HEAD',
    'OPTIONS',
    'GET',
    'PUT',
    'PATCH',
    'POST',
    'DELETE'
  ];

  this.params = {};
  // 初始化定义 route 栈
  this.stack = [];
};
```

* 分析 router.method 方法
```
// methods ['get', 'post', 'delete', 'put', 'patch', ...]
methods.forEach(function (method) {
  Router.prototype[method] = function (name, path, middleware) {
    var middleware;

    if (typeof path === 'string' || path instanceof RegExp) {
      // 若第二个参数是 string 或 正则表达式，则将后面的参数归为 middleware
      middleware = Array.prototype.slice.call(arguments, 2);
    } else {
      // 否则说明没有传 name 参数，将第一个参数置为path，之后的参数归为 middleware
      middleware = Array.prototype.slice.call(arguments, 1);
      path = name;
      name = null;
    }

    // 注册 route（下面会讲到 register 方法）
    this.register(path, [method], middleware, {
      name: name
    });
    
    // 返回 Router 对象，可以链式调用
    return this;
  };
});
```

* 分析 router.register 方法
```
Router.prototype.register = function (path, methods, middleware, opts) {
  opts = opts || {};

  var stack = this.stack;
  ...
  // create route
  // 实例化一个 Layer 对象，Layer 对象将 path 转为 regexp，并增加了匹配 path 的可选 ops 参数
  var route = new Layer(path, methods, middleware, {
    end: opts.end === false ? opts.end : true,
    name: opts.name,
    sensitive: opts.sensitive || this.opts.sensitive || false,
    strict: opts.strict || this.opts.strict || false,
    prefix: opts.prefix || this.opts.prefix || "",
    ignoreCaptures: opts.ignoreCaptures
  });

  console.log(route);
  /**
   * Layer {
   * ...省略部分属性
   * methods: [ 'HEAD', 'GET' ],
   * stack: [ [Function] ],
   * path: '/',
   * regexp: { /^(?:\/(?=$))?$/i keys: [] } } // 用于匹配 path
   */
  ...
  // 将注册的 route 存放在 stack 队列中
  stack.push(route);

  return route;
};
```
register 方法主要用于实例化 Layer 对象，并支持多各 path 同时注册、添加路由前缀等功能（展示代码忽略）。

* 分析 router.match
```
Router.prototype.match = function (path, method) {
  // 获取已经注册的 routes （实例化Layer对象）
  var layers = this.stack;
  var layer;
  var matched = {
    path: [],
    pathAndMethod: [],
    route: false
  };

  // 循环查找能够匹配的route
  for (var len = layers.length, i = 0; i < len; i++) {
    layer = layers[i];

    debug('test %s %s', layer.path, layer.regexp);

    // 根据layer.regexp.test(path) 匹配
    if (layer.match(path)) {
      matched.path.push(layer);

      // todo ~操作符暂时没懂
      if (layer.methods.length === 0 || ~layer.methods.indexOf(method)) {
        matched.pathAndMethod.push(layer);
        // 将匹配标志 route 设为 true，这里我觉得改为 hitRoute 更容易理解
        if (layer.methods.length) matched.route = true;
      }
    }
  }

  return matched;
};
```

#### 实现简版Router
通过上面的分析，其实已经讲解了 koa-router 核心的部分：构造 Router 对象 => 定义 router 入口 => 匹配路由 => 合并中间件和执行函数输出；这4个API可以处理简单的 restful 请求，额外的API例如重定向、router.use、路由前缀等在了解核心代码后阅读起来就简单很多了；简版其实就是上面api的精简版，原理一致，可以到我的项目看下
simple-koa-router：[https://github.com/masongzhi/simple-koa-router](https://github.com/masongzhi/simple-koa-router)

#### 总结
koa-router 帮我们定义并选择相应的路由，对路由添加中间件和一些兼容和验证的工作；在 koa 中间件应用的基础上，比较容易理解中间件的实现，koa-router 为我们做了更好的路由层管理，在设计上可以参考实现，同时研究优美源码也是对自己的一种提升。




