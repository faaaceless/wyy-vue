'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

// targetMap[target]->depsMap[key]->dep->effect
// 这里记录的是依赖于这个target的依赖
var targetMap = new WeakMap();
// 全局变量让dep能记录到
var activeEffect;
// 依赖的结构
var Effect = /** @class */ (function () {
    function Effect(fn, scheduler) {
        // deps记录的是被这个依赖, 依赖的那些target的dep
        this.deps = [];
        this.active = true;
        this._fn = fn;
        this.scheduler = scheduler;
    }
    Effect.prototype.run = function () {
        // 这是为了stop后runner也能触发fn
        if (!this.active) {
            return this._fn();
        }
        // 把依赖给到全局变量, fn执行的时候会走get->track->收集effect
        activeEffect = this;
        // NOTE:vue3这里用shouldTrack来判断是否需要收集依赖, 和直接在结束后设定activeEffect=null有什么区别?
        // shouldTrack = true
        var res = this._fn();
        // 设为null来打断普通get的track
        activeEffect = null;
        // shouldTrack = false
        return res;
    };
    Effect.prototype.stop = function () {
        if (this.active) {
            cleanEffect(this);
            this.active = false;
            // onStop是stop的回调
            if (this.onStop) {
                this.onStop();
            }
        }
    };
    return Effect;
}());
function cleanEffect(effect) {
    // 从它依赖的所有target.key记录的依赖dep中删除它
    effect.deps.forEach(function (dep) {
        dep.delete(effect);
    });
    // 因为本身不再包含于那些Set(), 因此不用再记录了, 长度清零
    effect.deps.length = 0;
}
// 记录依赖
function track(target, key) {
    if (!tracking())
        return;
    // if (!shouldTrack) return
    var depsMap = targetMap.get(target);
    if (!depsMap) {
        depsMap = new Map();
        targetMap.set(target, depsMap);
    }
    var dep = depsMap.get(key);
    if (!dep) {
        // 用set是为了不重复收集
        dep = new Set();
        depsMap.set(key, dep);
    }
    trackEffect(dep);
}
function tracking() {
    // 如果不是通过Effect->run进来的, 而是普通get访问, 就不用track
    return activeEffect;
    // return activeEffect && shouldTrack
}
function trackEffect(dep) {
    // NOTE: 既然判断再添加, 为什么不用Array?
    // Set.has 性能优于 Array.includes
    if (dep.has(activeEffect))
        return;
    dep.add(activeEffect);
    activeEffect.deps.push(dep);
}
// 执行依赖
function trigger(target, key) {
    var depsMap = targetMap.get(target);
    // 都没对这个target进行track, depsMap是undefined
    if (!depsMap)
        return;
    var dep = depsMap.get(key);
    triggerEffects(dep);
}
function triggerEffects(dep) {
    for (var _i = 0, dep_1 = dep; _i < dep_1.length; _i++) {
        var effect_1 = dep_1[_i];
        // 有scheduler就不执行依赖
        if (effect_1.scheduler) {
            effect_1.scheduler();
        }
        else {
            effect_1.run();
        }
    }
}

var isObject = function (val) {
    return val !== null && typeof val === "object";
};

// 优化: 反复调用的情况
var get = createGetter(), set = createSetter(), shallowMutableGet = createGetter(false, true), readonlyGet = createGetter(true), shallowReadonlyGet = createGetter(true, true);
function createGetter(isReadonly, shallow) {
    if (isReadonly === void 0) { isReadonly = false; }
    if (shallow === void 0) { shallow = false; }
    return function getter(target, key, receiver) {
        // 用于isReactive
        if (key === "__v_isReactive" /* IS_REACTIVE */)
            return !isReadonly;
        // 用于isReadonly
        if (key === "__v_isReadonly" /* IS_READONLY */)
            return isReadonly;
        // 用于isShallow
        if (key === "__v_isShallow" /* IS_SHALLOW */)
            return shallow;
        var res = Reflect.get(target, key, receiver);
        // nested不作为响应对象
        if (shallow)
            return res;
        // nested reactive和readonly, 也就是get的时候转换成proxy
        if (isObject(res))
            return isReadonly ? readonly(res) : reactive(res);
        // 收集依赖
        if (!isReadonly)
            track(target, key);
        return res;
    };
}
function createSetter() {
    return function setter(target, key, value, receiver) {
        var res = Reflect.set(target, key, value, receiver);
        // 触发依赖
        trigger(target, key);
        return res;
    };
}
var mutableHandlers = {
    get: get,
    set: set
};
var readonlyHandlers = {
    readonlyGet: readonlyGet,
    set: function (target, key, value, receiver) {
        console.warn("Set operation on key \"".concat(key, "\" failed: target is readonly."));
        return true;
    }
};
Object.assign({}, mutableHandlers, { get: shallowMutableGet });
Object.assign({}, readonlyHandlers, { get: shallowReadonlyGet });

function reactive(origin) {
    return createActiveObject(origin, mutableHandlers);
}
function readonly(origin) {
    return createActiveObject(origin, readonlyHandlers);
}
function createActiveObject(origin, handlers) {
    return new Proxy(origin, handlers);
}

/** @class */ ((function () {
    function RefImpl(value) {
        this._v__isRef = true;
        // _raw是为了判断是否是同一个对象, reactive转换后的proxy肯定无法判断
        this._raw = value;
        // 输入对象要转为reactive
        this._value = convert(value);
        this.dep = new Set();
    }
    Object.defineProperty(RefImpl.prototype, "value", {
        get: function () {
            if (tracking())
                trackEffect(this.dep);
            return this._value;
        },
        set: function (newVal) {
            if (Object.is(this._raw, newVal))
                return;
            this._raw = newVal;
            this._value = convert(newVal);
            triggerEffects(this.dep);
        },
        enumerable: false,
        configurable: true
    });
    return RefImpl;
})());
function convert(value) {
    return isObject(value) ? reactive(value) : value;
}

/** @class */ ((function () {
    // 它的特点是不访问它的value的时候不会执行getter, 并且value值没变, 下一次访问value也不执行getter
    function ComputedRefImpl(getter) {
        var _this = this;
        this._dirty = true;
        this._getter = getter;
        // 用schedule改变dirty表示更新了, 而没有触发get, 从而保持lazy更新
        this._effect = new Effect(getter, function () {
            _this._dirty = true;
        });
    }
    Object.defineProperty(ComputedRefImpl.prototype, "value", {
        get: function () {
            // dirty 控制lazy更新, 不重复计算
            if (this._dirty) {
                this._dirty = false;
                // NOTE:这种做法一是没收集依赖, 改变依赖的值执行trigger会报错, 
                // 二是没法更新dirty, 依赖的值更新了它不知道要更新
                // this._value = this._getter()
                this._value = this._effect.run();
            }
            return this._value;
        },
        enumerable: false,
        configurable: true
    });
    return ComputedRefImpl;
})());

var publicPropertiesMap = {
    $el: function (instance) { return instance.vnode.el; }
};
var PublicInstanceProxyHandlers = {
    get: function (_a, key) {
        var instance = _a._;
        // setupState就是setupRes, 要在setup之后
        var setupState = instance.setupState;
        if (key in setupState)
            return setupState[key];
        // 接口
        var publicGetter = publicPropertiesMap[key];
        // 如果有接口, 返回接口的值
        if (publicGetter)
            return publicGetter(instance);
    }
};

function createComponentInstance(vnode) {
    var instance = {
        vnode: vnode,
        setupState: {}
    };
    return instance;
}
function setupComponent(instance) {
    setupStatefulComponent(instance);
}
function setupStatefulComponent(instance) {
    var component = instance.vnode.type;
    var setup = component.setup;
    if (setup) {
        var setupRes = setup();
        handleSetupResult(setupRes, instance);
    }
    // 任意代理一个对象, 这里是为了把instance传进去, 返回setup结果
    instance.proxy = new Proxy({ _: instance }, PublicInstanceProxyHandlers);
}
function handleSetupResult(setupRes, instance) {
    if (typeof setupRes === 'object') {
        instance.setupState = setupRes;
    }
    finishComponentSetup(instance);
}
function finishComponentSetup(instance) {
    var component = instance.vnode.type;
    if (component.render) {
        instance.render = component.render;
    }
}

function render(vnode, container) {
    patch(vnode, container);
}
function patch(vnode, container) {
    if (typeof vnode.type === "string") {
        // 处理DOM Element
        processElement(vnode, container);
    }
    else if (isObject(vnode.type)) {
        // 处理组件
        processComponent(vnode, container);
    }
}
function processElement(vnode, container) {
    mountElement(vnode, container);
}
function mountElement(vnode, container) {
    var type = vnode.type, props = vnode.props, children = vnode.children;
    // 把dom挂到vnode上
    var el = vnode.el = document.createElement(type);
    if (typeof children === 'string') {
        // 文字节点
        el.textContent = children;
    }
    else if (Array.isArray(children)) {
        // 多个子节点
        mountChildren(children, el);
    }
    for (var key in props) {
        el.setAttribute(key, props[key]);
    }
    container.append(el);
}
function mountChildren(children, container) {
    children.forEach(function (child) {
        // 再分为DOM子节点和当前节点的文本内容
        if (isObject(child)) {
            patch(child, container);
        }
        else if (typeof child === 'string') {
            container.textContent = child;
        }
    });
}
function processComponent(vnode, container) {
    mountComponent(vnode, container);
}
function mountComponent(vnode, container) {
    var instance = createComponentInstance(vnode);
    setupComponent(instance);
    setupRenderEffect(instance, container);
}
function setupRenderEffect(instance, container) {
    var proxy = instance.proxy;
    // 把render的this绑定到proxy上,
    // 之后就能在render里用this来访问到instance的setup结果
    var subTree = instance.render.call(proxy);
    patch(subTree, container);
    // NOTE: patch先进到mountElement, 把dom挂到vnode上
    // 再把组件实例的el绑定到根dom元素
    // 这样就实现 $el 接口, 在proxy设置
    instance.vnode.el = subTree.el;
}

function createVNode(type, props, children) {
    var vnode = {
        type: type,
        props: props,
        children: children,
        el: null
    };
    return vnode;
}

function createApp(rootComponent) {
    return {
        mount: function (rootContainer) {
            var vnode = createVNode(rootComponent);
            render(vnode, rootContainer);
        },
    };
}

function h(type, props, children) {
    return createVNode(type, props, children);
}

exports.createApp = createApp;
exports.h = h;
