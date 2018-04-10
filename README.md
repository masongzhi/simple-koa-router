# simple-koa-router

解读koa-router源码，并根据理解仿造一个精简版的router，实现基本的match、register、routes功能

> test暂未补全

#### 个人总结
解读源码最好的方法就是将代码拉下来，
先通读一遍代码，了解总体流程，
然后根据test用例从最简单的request开始，定点的打log或者debug，
一步步跟踪代码执行，就能知道每一步执行了什么，为什么要这么操作
