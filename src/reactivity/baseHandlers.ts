import { track, trigger } from "./effect"
import { ReactiveFlags } from "./reactive"

// 优化: 反复调用的情况
const get = createGetter(),
    set = createSetter(),
    readonlyGet = createGetter(true)


function createGetter(isReadonly = false) {
    return function getter(target, key, receiver) {
        // 用于isReactive
        if (key === ReactiveFlags.IS_REACTIVE) return !isReadonly
        // 用于isReadonly
        if (key === "__v_isReadonly") return isReadonly
        const res = Reflect.get(target, key, receiver)
        // 收集依赖
        if (!isReadonly) track(target, key)
        return res
    }
}

function createSetter() {
    return function setter(target, key, value, receiver) {
        const res = Reflect.set(target, key, value, receiver)
        // 触发依赖
        trigger(target, key)
        return res
    }
}

const mutableHandlers = {
    get,
    set
}

const readonlyHandlers = {
    readonlyGet,
    set(target, key, value, receiver) {
        console.warn(`Set ${key} failed: ${target} is readonly`)
        return true
    }
}

export {
    mutableHandlers,
    readonlyHandlers
}