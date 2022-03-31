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
var shallowReadonlyHandlers = Object.assign({}, readonlyHandlers, { get: shallowReadonlyGet });

function reactive(origin) {
    return createActiveObject(origin, mutableHandlers);
}
function readonly(origin) {
    return createActiveObject(origin, readonlyHandlers);
}
function shallowReadonly(origin) {
    return createActiveObject(origin, shallowReadonlyHandlers);
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

function initProps(instance, rawProps) {
    if (rawProps === void 0) { rawProps = {}; }
    instance.props = rawProps;
}

var publicPropertiesMap = {
    $el: function (instance) { return instance.vnode.el; },
    $props: function (instance) { return instance.props; },
    $slots: function (instance) { return instance.slots; }
};
var PublicInstanceProxyHandlers = {
    get: function (_a, key) {
        var instance = _a._;
        // setupState就是setupResult
        var setupState = instance.setupState, props = instance.props;
        // 返回setup里面定义的和props上的
        if (key in setupState)
            return setupState[key];
        if (key in props)
            return props[key];
        // 接口
        var publicGetter = publicPropertiesMap[key];
        // 如果有接口, 返回接口的值
        if (publicGetter)
            return publicGetter(instance);
    }
};

function emit(instance, event) {
    var args = [];
    for (var _i = 2; _i < arguments.length; _i++) {
        args[_i - 2] = arguments[_i];
    }
    var props = instance.props;
    console.log("------test emit------");
    console.log("Emit", event);
    var handler = props[toHandlerKey(event)];
    handler && handler.apply(void 0, args);
}
function toHandlerKey(val) {
    // 把kebab case转变成camel case
    var camelize = function (str) { return str.replace(/-(\w)/g, function (_, c) { return c ? c.toUpperCase() : ""; }); };
    var capitalize = function (str) { return str.charAt(0).toUpperCase() + str.slice(1); };
    var handlerKey = function (str) { return (str ? "on" + capitalize(str) : ""); };
    return handlerKey(camelize(val));
}

function initSlots(instance, children) {
    var vnode = instance.vnode;
    if (vnode.shapeFlags & 16 /* SLOTS_CHILDREN */) {
        var _loop_1 = function (key) {
            // 这里函数的返回值, 会在renderSlots里被createVNode调用, 接受的参数是数组 
            instance.slots[key] = function (props) { return normalizeSlot(children[key](props)); };
        };
        for (var key in children) {
            _loop_1(key);
        }
    }
}
function normalizeSlot(val) {
    return Array.isArray(val) ? val : [val];
}

function createComponentInstance(vnode) {
    var instance = {
        vnode: vnode,
        setupState: {},
        props: {},
        slots: {},
        emit: function (event) { }
    };
    // instance直接作为bind的参数，无需另外传入
    instance.emit = emit.bind(null, instance);
    return instance;
}
// NOTE: 这页注册组件主要实现几个功能:
// 1.把setup的结果挂载到组件实例上
// 2.把render方法挂载到组件实例上
function setupComponent(instance) {
    // 把组件的props挂到组件实例上
    initProps(instance, instance.vnode.props);
    // 把slots挂到组件实例
    initSlots(instance, instance.vnode.children);
    setupStatefulComponent(instance);
}
function setupStatefulComponent(instance) {
    var component = instance.vnode.type;
    var setup = component.setup;
    // 执行setup
    if (setup) {
        // props可以作为setup的输入, 并且是readonly的
        // NOTE: 这里emit忘记传入instance.emit, 导致传入导入的emit，debug半天
        var setupRes = setup(shallowReadonly(instance.props), { emit: instance.emit });
        handleSetupResult(setupRes, instance);
    }
    // 任意代理一个对象, 返回setup结果
    // 主要是用于绑定render的this指向
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
    // 挂载render方法至实例
    if (component.render) {
        instance.render = component.render;
    }
}

function render(vnode, container) {
    patch(vnode, container);
}
function patch(vnode, container) {
    if (vnode.shapeFlags & 1 /* ELEMENT */) {
        // 处理DOM Element
        processElement(vnode, container);
    }
    else if (vnode.shapeFlags & 2 /* STATEFUL_COMPONENT */) {
        // 处理组件
        processComponent(vnode, container);
    }
}
function processElement(vnode, container) {
    mountElement(vnode, container);
}
function mountElement(vnode, container) {
    var type = vnode.type, props = vnode.props, children = vnode.children, shapeFlags = vnode.shapeFlags;
    // 把dom传给vnode
    var el = vnode.el = document.createElement(type);
    if (shapeFlags & 4 /* TEXT_CHILDREN */) {
        // 文字节点
        el.textContent = children;
    }
    else if (shapeFlags & 8 /* ARRAY_CHILDREN */) {
        // 多个子节点
        mountChildren(children, el);
    }
    // 设置属性
    var isEvent = function (key) { return /^on[A-Z]/.test(key); };
    for (var key in props) {
        // NOTE:注册事件
        if (isEvent(key)) {
            el.addEventListener(key.slice(2).toLowerCase(), props[key]);
        }
        // 或者attribute
        el.setAttribute(key, props[key]);
    }
    // 把dom挂载到container上
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
    // NOTE: setup注册的东西绑定在实例上, 都通过proxy获取
    // 把render的this绑定到proxy上,
    // 之后就能在render里用this来访问到instance的setup结果
    var subTree = instance.render.call(proxy);
    patch(subTree, container);
    // NOTE: patch先进到mountElement, ele把dom挂到自己的vnode上,
    // 等children全部render完了, 才能把组件实例的el绑定到根dom元素
    // 这样就实现 $el 接口, 在proxy设置
    instance.vnode.el = subTree.el;
}

// shapeFlags指示自己是组件还是元素， 
// 以及children是text节点还是array
function createVNode(type, props, children) {
    var vnode = {
        type: type,
        props: props,
        children: children,
        shapeFlags: getShapeFlag(type),
        el: null
    };
    if (typeof children === 'string') {
        vnode.shapeFlags |= 4 /* TEXT_CHILDREN */;
    }
    else if (Array.isArray(children)) {
        vnode.shapeFlags |= 8 /* ARRAY_CHILDREN */;
    }
    // 使用插槽时, children是object, key就是具名插槽的名字
    if (vnode.shapeFlags & 2 /* STATEFUL_COMPONENT */ && typeof children === 'object') {
        vnode.shapeFlags |= 16 /* SLOTS_CHILDREN */;
    }
    return vnode;
}
function getShapeFlag(type) {
    return typeof type === 'string' ? 1 /* ELEMENT */ : 2 /* STATEFUL_COMPONENT */;
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

// key就是具名插槽的名字, props就是作用域插槽传递的数据
function renderSlots(slots, key, props) {
    var slot = slots[key];
    if (slot && typeof slot === 'function') {
        // 这个slot是在上级组件里定义的函数, 就是通过这里把子组件的参数传上去
        return createVNode("div", {}, slot(props));
    }
}

exports.createApp = createApp;
exports.h = h;
exports.renderSlots = renderSlots;
