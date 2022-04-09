// 给renderSlots用的
const Fragment = Symbol("Fragment");
const Text = Symbol("Text");
// shapeFlags指示自己是组件还是元素， 
// 以及children是text节点还是array
function createVNode(type, props, children) {
    const vnode = {
        type,
        props,
        children,
        key: props === null || props === void 0 ? void 0 : props.key,
        shapeFlag: getShapeFlag(type),
        el: null
    };
    if (typeof children === 'string') {
        vnode.shapeFlag |= 4 /* TEXT_CHILDREN */;
    }
    else if (Array.isArray(children)) {
        vnode.shapeFlag |= 8 /* ARRAY_CHILDREN */;
    }
    // 使用插槽时, children是object, key就是具名插槽的名字
    if (vnode.shapeFlag & 2 /* STATEFUL_COMPONENT */ && typeof children === 'object') {
        vnode.shapeFlag |= 16 /* SLOTS_CHILDREN */;
    }
    return vnode;
}
function createTextVNode(text) {
    return createVNode(Text, {}, text);
}
function getShapeFlag(type) {
    return typeof type === 'string' ? 1 /* ELEMENT */ : 2 /* STATEFUL_COMPONENT */;
}

function h(type, props, children) {
    return createVNode(type, props, children);
}

// key就是具名插槽的名字, props就是作用域插槽传递的数据
function renderSlots(slots, key, props) {
    const slot = slots[key];
    if (slot && typeof slot === 'function') {
        // 这个slot是在上级组件里定义的函数, 就是通过这里把子组件的参数传上去
        // 用div的话每个slot都会外套一个div, 不想要的话就用Fragment
        return createVNode(Fragment, {}, slot(props));
    }
}

// targetMap[target]->depsMap[key]->dep->effect
// 这里记录的是依赖于这个target的依赖
const targetMap = new WeakMap();
// 全局变量让dep能记录到
let activeEffect;
// 依赖的结构
class Effect {
    constructor(fn, scheduler) {
        // deps记录的是被这个依赖, 依赖的那些target的dep
        this.deps = [];
        this.active = true;
        this._fn = fn;
        this.scheduler = scheduler;
    }
    run() {
        // 这是为了stop后runner也能触发fn
        if (!this.active) {
            return this._fn();
        }
        // 把依赖给到全局变量, fn执行的时候会走get->track->收集effect
        activeEffect = this;
        // NOTE:vue3这里用shouldTrack来判断是否需要收集依赖, 和直接在结束后设定activeEffect=null有什么区别?
        // shouldTrack = true
        const res = this._fn();
        // 设为null来打断普通get的track
        activeEffect = null;
        // shouldTrack = false
        return res;
    }
    stop() {
        if (this.active) {
            cleanEffect(this);
            this.active = false;
            // onStop是stop的回调
            if (this.onStop) {
                this.onStop();
            }
        }
    }
}
function cleanEffect(effect) {
    // 从它依赖的所有target.key记录的依赖dep中删除它
    effect.deps.forEach((dep) => {
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
    let depsMap = targetMap.get(target);
    if (!depsMap) {
        depsMap = new Map();
        targetMap.set(target, depsMap);
    }
    let dep = depsMap.get(key);
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
    let depsMap = targetMap.get(target);
    // 都没对这个target进行track, depsMap是undefined
    if (!depsMap)
        return;
    let dep = depsMap.get(key);
    triggerEffects(dep);
}
function triggerEffects(dep) {
    dep.forEach((effect) => {
        // 有scheduler就不执行依赖
        if (effect.scheduler) {
            effect.scheduler();
        }
        else {
            effect.run();
        }
    });
    // FIXME: 做到runtime-core更新element的时候发现for-of遍历不了，编译问题？
    // for (const effect of dep) {
    //   console.log(effect)
    //   if (effect.scheduler) {
    //     effect.scheduler()
    //   } else {
    //     effect.run()
    //   }
    // }
}
// 删除依赖
function stop(runner) {
    runner.effect.stop();
}
// 创建依赖
function effect(fn, options) {
    const _effect = new Effect(fn, options === null || options === void 0 ? void 0 : options.scheduler);
    // 把options给到effect
    Object.assign(_effect, options);
    // lazy option
    if (!(options === null || options === void 0 ? void 0 : options.lazy))
        _effect.run();
    // 返回runner
    const runner = _effect.run.bind(_effect);
    // 让stop函数能找到runner对应的effect
    runner.effect = _effect;
    return runner;
}

const isObject = (val) => {
    return val !== null && typeof val === "object";
};

// 优化: 反复调用的情况
const get = createGetter(), set = createSetter(), shallowMutableGet = createGetter(false, true), readonlyGet = createGetter(true), shallowReadonlyGet = createGetter(true, true);
function createGetter(isReadonly = false, shallow = false) {
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
        const res = Reflect.get(target, key, receiver);
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
        const res = Reflect.set(target, key, value, receiver);
        // 触发依赖
        trigger(target, key);
        return res;
    };
}
const mutableHandlers = {
    get,
    set
};
const readonlyHandlers = {
    readonlyGet,
    set(target, key, value, receiver) {
        console.warn(`Set operation on key "${key}" failed: target is readonly.`);
        return true;
    }
};
const shallowMutableHandlers = Object.assign({}, mutableHandlers, { get: shallowMutableGet });
const shallowReadonlyHandlers = Object.assign({}, readonlyHandlers, { get: shallowReadonlyGet });

function reactive(origin) {
    return createActiveObject(origin, mutableHandlers);
}
function readonly(origin) {
    return createActiveObject(origin, readonlyHandlers);
}
function shallowReactive(origin) {
    return createActiveObject(origin, shallowMutableHandlers);
}
function shallowReadonly(origin) {
    return createActiveObject(origin, shallowReadonlyHandlers);
}
function createActiveObject(origin, handlers) {
    return new Proxy(origin, handlers);
}
// isReactive和isReadonly通过传入特定的key到getter中判断
function isReactive(target) {
    // 如果没经过reactive, 都不会有proxy, 也不会走到判断, 会返回undefined
    // 因此用!!强制转换为boolean
    return !!target["__v_isReactive" /* IS_REACTIVE */];
}
function isReadonly(target) {
    return !!target["__v_isReadonly" /* IS_READONLY */];
}
function isProxy(target) {
    return !!target["__v_isReactive" /* IS_REACTIVE */] || !!target["__v_isReadonly" /* IS_READONLY */];
}
function isShallow(target) {
    return !!target["__v_isShallow" /* IS_SHALLOW */];
}
// TODO: toRaw
function toRaw() {
}
// TODO:markRaw
function markRaw() {
}

class RefImpl {
    constructor(value) {
        this._v__isRef = true;
        // _raw是为了判断是否是同一个对象, reactive转换后的proxy肯定无法判断
        this._raw = value;
        // 输入对象要转为reactive
        this._value = convert(value);
        this.dep = new Set();
    }
    get value() {
        if (tracking())
            trackEffect(this.dep);
        return this._value;
    }
    set value(newVal) {
        if (Object.is(this._raw, newVal))
            return;
        this._raw = newVal;
        // NOTE：这里可以看到当ref.value是一个reactive对象的proxy时，
        // 即使这个proxy被换掉了，依然能trigger，因为effect记录在ref的dep里
        // 这样其实也扩宽了reactive的应用场景, 可以直接让ref.value等于一个新的对象, reactive要做只能修改对象的值
        this._value = convert(newVal);
        triggerEffects(this.dep);
    }
}
function convert(value) {
    return isObject(value) ? reactive(value) : value;
}
function ref(value) {
    return new RefImpl(value);
}
function isRef(ref) {
    return !!ref._v__isRef;
}
function unref(ref) {
    return isRef(ref) ? ref.value : ref;
}
function proxyRefs(objWithRef) {
    return new Proxy(objWithRef, {
        get(target, key) {
            // get时要解包
            return unref(Reflect.get(target, key));
        },
        set(target, key, value) {
            // 如果新传入的不是ref但是之前的是ref, 希望的行为是更新之前ref的value
            if (isRef(target[key]) && !isRef(value)) {
                return (target[key].value = value);
                // 其他情况都可以直接取代
            }
            else {
                return Reflect.set(target, key, value);
            }
        },
    });
}
// TODO: shallowRef
function shallowRef() { }
// TODO: toRef
function toRef() { }
// TODO: toRefs
function toRefs() { }

class ComputedRefImpl {
    // 它的特点是不访问它的value的时候不会执行getter, 并且value值没变, 下一次访问value也不执行getter
    constructor(getter) {
        this._dirty = true;
        this._getter = getter;
        // 用schedule改变dirty表示更新了, 而没有触发get, 从而保持lazy更新
        this._effect = new Effect(getter, () => {
            this._dirty = true;
        });
    }
    get value() {
        // dirty 控制lazy更新, 不重复计算
        if (this._dirty) {
            this._dirty = false;
            // NOTE:这种做法一是没收集依赖, 改变依赖的值执行trigger会报错, 
            // 二是没法更新dirty, 依赖的值更新了它不知道要更新
            // this._value = this._getter()
            this._value = this._effect.run();
        }
        return this._value;
    }
}
function computed(getter) {
    return new ComputedRefImpl(getter);
}

function initProps(instance, rawProps = {}) {
    instance.props = rawProps;
}

const publicPropertiesMap = {
    $el: (instance) => instance.vnode.el,
    $props: (instance) => instance.props,
    $slots: (instance) => instance.slots
};
const PublicInstanceProxyHandlers = {
    get({ _: instance }, key) {
        // setupState就是setupResult
        const { setupState, props } = instance;
        // 返回setup里面定义的和props上的
        if (key in setupState)
            return setupState[key];
        if (key in props)
            return props[key];
        // 接口
        const publicGetter = publicPropertiesMap[key];
        // 如果有接口, 返回接口的值
        if (publicGetter)
            return publicGetter(instance);
    }
};

function emit(instance, event, ...args) {
    const { props } = instance;
    console.log("------test emit------");
    console.log("Emit", event);
    const handler = props[toHandlerKey(event)];
    handler && handler(...args);
}
function toHandlerKey(val) {
    // 把kebab case转变成camel case
    const camelize = (str) => str.replace(/-(\w)/g, (_, c) => c ? c.toUpperCase() : "");
    const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);
    const handlerKey = (str) => (str ? "on" + capitalize(str) : "");
    return handlerKey(camelize(val));
}

function initSlots(instance, children) {
    const { vnode } = instance;
    if (vnode.shapeFlag & 16 /* SLOTS_CHILDREN */) {
        for (const key in children) {
            // 这里函数的返回值, 会在renderSlots里被createVNode调用, 接受的参数是数组 
            instance.slots[key] = (props) => normalizeSlot(children[key](props));
        }
    }
}
function normalizeSlot(val) {
    return Array.isArray(val) ? val : [val];
}

// NOTE: 这页注册组件主要实现几个功能:
// 1.把setup的结果挂载到组件实例上
// 2.为实例创建代理，子dom通过代理访问组件的props, state, 和一些api
// 2.把render方法挂载到组件实例上
function createComponentInstance(vnode, parent) {
    const instance = {
        vnode,
        parent,
        subTree: {},
        setupState: {},
        props: {},
        slots: {},
        provides: {},
        isMounted: false,
        emit: (event) => { },
    };
    // instance直接作为bind的参数，无需另外传入
    instance.emit = emit.bind(null, instance);
    return instance;
}
function setupComponent(instance) {
    // 把组件的props挂到组件实例上
    initProps(instance, instance.vnode.props);
    // 把slots挂到组件实例
    initSlots(instance, instance.vnode.children);
    setupStatefulComponent(instance);
}
// 可以看出来，通过setup函数定义的东西，都是先挂到组件实例上，然后再被组件下面的dom使用的
function setupStatefulComponent(instance) {
    const component = instance.vnode.type;
    const { setup } = component;
    // 执行setup
    if (setup) {
        // 可以在setup里执行getCurrentInstance
        setCurrentInstance(instance);
        // props可以作为setup的输入, 并且是readonly的
        // NOTE: 这里emit忘记传入instance.emit, 导致传入导入的emit，debug半天
        const setupRes = setup(shallowReadonly(instance.props), {
            emit: instance.emit,
        });
        setCurrentInstance(null);
        handleSetupResult(setupRes, instance);
    }
    // 任意代理一个对象, 返回setup结果
    // 主要是用于绑定render的this指向
    instance.proxy = new Proxy({ _: instance }, PublicInstanceProxyHandlers);
}
function handleSetupResult(setupRes, instance) {
    if (typeof setupRes === "object") {
        instance.setupState = proxyRefs(setupRes);
    }
    finishComponentSetup(instance);
}
function finishComponentSetup(instance) {
    const component = instance.vnode.type;
    // 挂载render方法至实例
    if (component.render) {
        instance.render = component.render;
    }
}
let currentInstance = null;
function getCurrentInstance() {
    return currentInstance;
}
// NOTE: 相比于在上边写死, 抽离出来的好处在于出问题方便跟踪, 就在这个函数打断点
function setCurrentInstance(val) {
    currentInstance = val;
}

function provide(key, value) {
    if (!key)
        return;
    const currentInstance = getCurrentInstance();
    if (!currentInstance)
        return;
    const parentComponent = currentInstance.parent;
    // 第一次进Provide 初始化
    if (parentComponent &&
        Object.getPrototypeOf(currentInstance.provides) !== parentComponent.provides) {
        // NOTE: 将父组件的provide作为子组件的原型对象, 这样避免覆盖, 而且可以一直往原型链上找
        // 若直接引用父组件的provides, 碰到相同key子组件赋值的时候父组件本身的也被覆盖了
        // 暂时来看浅拷贝一层也行, 但是每层都拷贝没意义的重复太多, 数据量会太大
        currentInstance.provides = Object.create(parentComponent.provides);
    }
    Reflect.set(currentInstance.provides, key, value);
}
function inject(key, defaultValue) {
    const currentInstance = getCurrentInstance();
    if (!currentInstance)
        return;
    // 从父组件的provides中读数据，因为子组件是直接inject的, 肯定不是从自己的provides中读
    const { provides } = currentInstance.parent;
    if (key in provides) {
        return provides[key];
    }
    else if (defaultValue) {
        if (typeof defaultValue === "function") {
            return defaultValue();
        }
        return defaultValue;
    }
}

function createAppAPI(render) {
    return function createApp(rootComponent) {
        return {
            mount(rootContainer) {
                const vnode = createVNode(rootComponent);
                render(vnode, rootContainer);
            },
        };
    };
}

function createRenderer(options) {
    const { createElement: hostCreateElement, patchProp: hostPatchProp, insert: hostInsert, remove: hostRemove, setElementText: hostSetElementText, } = options;
    function render(vnode, container) {
        patch(null, vnode, container, null, null);
    }
    // n1:prevVnode n2:curVnode
    function patch(n1, n2, container, parentComponent, anchor) {
        const { type, shapeFlag } = n2;
        switch (type) {
            // Fragment 只渲染子节点
            case Fragment:
                processFragment(n1, n2, container, parentComponent, anchor);
                break;
            case Text:
                processText(n1, n2, container);
                break;
            default:
                if (shapeFlag & 1 /* ELEMENT */) {
                    // 处理DOM Element
                    processElement(n1, n2, container, parentComponent, anchor);
                }
                else if (shapeFlag & 2 /* STATEFUL_COMPONENT */) {
                    // 处理组件
                    processComponent(n1, n2, container, parentComponent, anchor);
                }
        }
    }
    function processFragment(n1, n2, container, parentComponent, anchor) {
        mountChildren(n2.children, container, parentComponent, anchor);
    }
    function processText(n1, n2, container) {
        const textNode = (n2.el = document.createTextNode(n2.children));
        container.append(textNode);
    }
    function processElement(n1, n2, container, parentComponent, anchor) {
        // 没有n1走初始化， 有n1走更新
        if (!n1) {
            mountElement(n2, container, parentComponent, anchor);
        }
        else {
            patchElement(n1, n2, parentComponent, anchor);
        }
    }
    function patchElement(n1, n2, parentComponent, anchor) {
        var _a, _b;
        console.log(n1, n2);
        // n1经历了mountElement 而n2还没有，所以只能从n1读dom
        const el = (n2.el = n1.el);
        // 更新props
        const prevProps = (_a = n1.props) !== null && _a !== void 0 ? _a : {};
        const curProps = (_b = n2.props) !== null && _b !== void 0 ? _b : {};
        // 从这里开始container变成了n2.el
        patchChildren(n1, n2, el, parentComponent, anchor);
        patchProps(prevProps, curProps, el);
    }
    function patchChildren(n1, n2, container, parentComponent, anchor) {
        const { shapeFlag: prevShapeFlag } = n1;
        const { shapeFlag: curShapeFlag } = n2;
        if (curShapeFlag & 4 /* TEXT_CHILDREN */) {
            // unmount 如果是Array to Text
            if (prevShapeFlag & 8 /* ARRAY_CHILDREN */) {
                unmountChildren(n1.children);
            }
            if (n1.children !== n2.children) {
                hostSetElementText(container, n2.children);
            }
        }
        else {
            if (prevShapeFlag & 4 /* TEXT_CHILDREN */) {
                // 清空之前的文本
                hostSetElementText(container, "");
                // mount 新的
                mountChildren(n2.children, container, parentComponent, anchor);
            }
            else {
                // array to array
                patchKeyedChildren(n1.children, n2.children, container, parentComponent, anchor);
            }
        }
    }
    function patchKeyedChildren(c1, c2, container, parentComponent, anchor) {
        let i = 0;
        // end
        let e1 = c1.length - 1;
        let e2 = c2.length - 1;
        // 收缩左侧
        while (i <= e1 && i <= e2) {
            const n1 = c1[i];
            const n2 = c2[i];
            // 如果在这一层是相同的，送入patch继续递归
            if (isSameVNodeType(n1, n2)) {
                patch(n1, n2, container, parentComponent, anchor);
            }
            else {
                // move i to the first item that is different
                break;
            }
            i++;
        }
        // 收缩右侧
        while (i <= e1 && i <= e2) {
            const n1 = c1[e1];
            const n2 = c2[e2];
            if (isSameVNodeType(n1, n2)) {
                patch(n1, n2, container, parentComponent, anchor);
            }
            else {
                // move e1 and e2 respectively to the last items that are different
                break;
            }
            e1--;
            e2--;
        }
        // 简单情况下，cur是prev的一部分，或prev是cur的一部分
        if (i > e1 && i <= e2) {
            // cur的某侧比prev长，直接mount新的来扩展该侧
            // 通过anchor决定左侧还是右侧
            const anchor = e1 < 0 ? c2[e2 + 1].el : null;
            for (let idx = i; idx <= e2; idx++) {
                patch(null, c2[idx], container, parentComponent, anchor);
            }
        }
        else if (i > e2) {
            // cur的某侧比prev短，删除prev来缩短
            for (let idx = i; idx <= e1; idx++) {
                hostRemove(c1[idx].el);
            }
        }
        else {
            // 两边一样，中间不同
            const keyToNewIdx = new Map();
            // curChildren 的 key : idx
            for (let idx = i; idx <= e2; idx++) {
                const curChild = c2[idx];
                keyToNewIdx.set(curChild.key, idx);
            }
            // i 到 e2 之间的节点，也就是cur要用来比较的节点
            const toBePatched = e2 - i + 1;
            let patched = 0;
            // 为prev找对应的cur
            for (let idx = i; idx <= e1; idx++) {
                const prevChild = c1[idx];
                // cur全找到对应的prev了， 剩下的都要remove
                if (patched >= toBePatched) {
                    hostRemove(prevChild.el);
                }
                let newIdx;
                if (prevChild.key) {
                    newIdx = keyToNewIdx.get(prevChild.key);
                    patched++;
                }
                else {
                    for (let curIdx = i; curIdx <= e2; curIdx++) {
                        if (isSameVNodeType(c2[curIdx], prevChild)) {
                            newIdx = curIdx;
                            patched++;
                            break;
                        }
                    }
                }
                // 找不到就删除，找到了进一步patch
                if (newIdx === undefined) {
                    hostRemove(prevChild.el);
                }
                else {
                    patch(prevChild, c2[newIdx], container, parentComponent, anchor);
                }
            }
        }
    }
    function isSameVNodeType(n1, n2) {
        return n1.type === n2.type && n1.key === n2.key;
    }
    function unmountChildren(children) {
        for (let i = 0; i < children.length; i++) {
            const el = children[i].el;
            hostRemove(el);
        }
    }
    function patchProps(prevProps, curProps, el) {
        if (prevProps === curProps)
            return;
        for (const key in curProps) {
            const prevProp = prevProps[key];
            const curProp = curProps[key];
            // 新值不等于老值, 以前不存在的prop也包含在内
            if (prevProp !== curProp) {
                hostPatchProp(el, key, prevProp, curProp);
            }
        }
        // 删除不再存在的prop
        for (const key in prevProps) {
            if (!(key in curProps)) {
                hostPatchProp(el, key, prevProps[key], null);
            }
        }
    }
    function mountElement(vnode, container, parentComponent, anchor) {
        const { type, props, children, shapeFlag } = vnode;
        // 把创建的dom传给vnode.el
        const el = (vnode.el = hostCreateElement(type));
        if (shapeFlag & 4 /* TEXT_CHILDREN */) {
            // 文字节点
            el.textContent = children;
        }
        else if (shapeFlag & 8 /* ARRAY_CHILDREN */) {
            // 多个子节点
            mountChildren(children, el, parentComponent, anchor);
        }
        // 设置属性
        for (const key in props) {
            hostPatchProp(el, key, null, props[key]);
        }
        // 把dom挂载到container上
        hostInsert(el, container, anchor);
    }
    function mountChildren(children, container, parentComponent, anchor) {
        children.forEach((child) => {
            // 再分为用vnode定义的DOM子节点和文本节点
            if (isObject(child)) {
                patch(null, child, container, parentComponent, anchor);
            }
        });
    }
    function processComponent(n1, n2, container, parentComponent, anchor) {
        mountComponent(n2, container, parentComponent, anchor);
    }
    function mountComponent(vnode, container, parentComponent, anchor) {
        const instance = createComponentInstance(vnode, parentComponent);
        setupComponent(instance);
        setupRenderEffect(instance, container, anchor);
    }
    function setupRenderEffect(instance, container, anchor) {
        // 用effect包裹, 在响应对象发生改变后，会再次触发render
        effect(() => {
            if (!instance.isMounted) {
                const { proxy } = instance;
                // NOTE: setup注册的东西绑定在实例上, 都通过proxy获取
                // 用call把render的this绑定到proxy上,
                // 之后就能在render里用this来访问到instance的setup结果
                const subTree = (instance.subTree = instance.render.call(proxy));
                // subTree 就是组件的虚拟dom树
                patch(null, subTree, container, instance, anchor);
                // NOTE: patch先进到mountElement, el把dom挂到自己的vnode上,
                // 等children全部render完了, 才能把组件实例的el绑定到根dom元素
                // 这样就实现 $el 接口, 在proxy设置
                instance.vnode.el = subTree.el;
                instance.isMounted = true;
            }
            else {
                const { proxy } = instance;
                const prevTree = instance.subTree;
                const subTree = (instance.subTree = instance.render.call(proxy));
                patch(prevTree, subTree, container, instance, anchor);
            }
        });
    }
    return {
        createApp: createAppAPI(render),
    };
}

function createElement(type) {
    return document.createElement(type);
}
function patchProp(el, key, prevVal, curVal) {
    const isEvent = (key) => /^on[A-Z]/.test(key);
    // NOTE:注册事件或者attribute
    if (isEvent(key)) {
        el.addEventListener(key.slice(2).toLowerCase(), curVal);
    }
    else {
        // 新的prop是 undefined or null，则删除
        if (curVal === undefined || curVal === null) {
            el.removeAttribute(key);
        }
        else {
            el.setAttribute(key, curVal);
        }
    }
}
function insert(el, container, anchor = null) {
    container.insertBefore(el, anchor);
}
function remove(child) {
    const parent = child.parentNode;
    if (parent) {
        parent.removeChild(child);
    }
}
function setElementText(el, text) {
    el.textContent = text;
}
// 传入render参数, 返回的renderer包含createAppAPI调用的结果, 即重构前的createApp函数
const renderer = createRenderer({
    createElement,
    patchProp,
    insert,
    remove,
    setElementText,
});
// 再调用之前的createApp函数, 实际上就是在外面套了一层renderer, 通过这个renderer传入一些方法, 但是在js里调用方法不变
// 整个流程是createRenderer-(options)->render-(render)->createAppAPI-(render)->createApp-(args)->render
function createApp(...args) {
    return renderer.createApp(...args);
}

export { Effect, computed, createApp, createRenderer, createTextVNode, effect, getCurrentInstance, h, inject, isObject, isProxy, isReactive, isReadonly, isRef, isShallow, markRaw, mutableHandlers, provide, proxyRefs, reactive, readonly, readonlyHandlers, ref, renderSlots, shallowReactive, shallowReadonly, shallowReadonlyHandlers, shallowRef, stop, toRaw, toRef, toRefs, track, trackEffect, tracking, trigger, triggerEffects, unref };
