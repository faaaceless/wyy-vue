import { getCurrentInstance } from "./component"

export function provide(key, value) {
  if (!key) return
  const currentInstance = getCurrentInstance()
  if (!currentInstance) return

  const parentComponent = currentInstance.parent

  // 第一次进Provide 初始化
  if (
    parentComponent &&
    Object.getPrototypeOf(currentInstance.provides) !== parentComponent.provides
  ) {
    // NOTE: 将父组件的provide作为子组件的原型对象, 这样避免覆盖, 而且可以一直往原型链上找
    // 若直接引用父组件的provides, 碰到相同key子组件赋值的时候父组件本身的也被覆盖了
    // 暂时来看浅拷贝一层也行, 但是每层都拷贝没意义的重复太多, 数据量会太大
    currentInstance.provides = Object.create(parentComponent.provides)
  }

  Reflect.set(currentInstance.provides, key, value)
}

export function inject(key, defaultValue) {
  const currentInstance = getCurrentInstance()
  if (!currentInstance) return

  // 从父组件的provides中读数据，因为子组件是直接inject的, 肯定不是从自己的provides中读
  const { provides } = currentInstance.parent

  if (key in provides) {
    return provides[key]
  } else if (defaultValue) {
    if (typeof defaultValue === "function") {
      return defaultValue()
    }
    return defaultValue
  }
}
