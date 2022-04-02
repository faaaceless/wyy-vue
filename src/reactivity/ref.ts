import { trackEffect, tracking, triggerEffects } from "./effect"
import { reactive } from "./reactive"
import { isObject } from "./utils"

class RefImpl {
  private _value: any
  private _raw: any
  private _v__isRef: boolean = true
  public dep: Set<any>
  constructor(value: any) {
    // _raw是为了判断是否是同一个对象, reactive转换后的proxy肯定无法判断
    this._raw = value
    // 输入对象要转为reactive
    this._value = convert(value)
    this.dep = new Set()
  }

  get value() {
    if (tracking()) trackEffect(this.dep)
    return this._value
  }

  set value(newVal) {
    if (Object.is(this._raw, newVal)) return
    this._raw = newVal
    // NOTE：这里可以看到当ref.value是一个reactive对象的proxy时，
    // 即使这个proxy被换掉了，依然能trigger，因为effect记录在ref的dep里
    // 这样其实也扩宽了reactive的应用场景, 可以直接让ref.value等于一个新的对象, reactive要做只能修改对象的值
    this._value = convert(newVal)
    triggerEffects(this.dep)
  }
}

function convert(value) {
  return isObject(value) ? reactive(value) : value
}

function ref(value) {
  return new RefImpl(value)
}

function isRef(ref) {
  return !!ref._v__isRef
}

function unref(ref) {
  return isRef(ref) ? ref.value : ref
}

function proxyRefs(objWithRef) {
  return new Proxy(objWithRef, {
    get(target, key) {
      // get时要解包
      return unref(Reflect.get(target, key))
    },

    set(target, key, value) {
      // 如果新传入的不是ref但是之前的是ref, 希望的行为是更新之前ref的value
      if (isRef(target[key]) && !isRef(value)) {
        return (target[key].value = value)
        // 其他情况都可以直接取代
      } else {
        return Reflect.set(target, key, value)
      }
    },
  })
}

// TODO: shallowRef
function shallowRef() {}

// TODO: toRef
function toRef() {}

// TODO: toRefs
function toRefs() {}

export { ref, isRef, unref, proxyRefs, shallowRef, toRef, toRefs }
