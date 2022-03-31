const publicPropertiesMap = {
  $el: (instance) => instance.vnode.el,
  $props: (instance) => instance.props,
  $slots: (instance) => instance.slots
}

export const PublicInstanceProxyHandlers = {
  get({ _: instance }, key) {
    // setupState就是setupResult
    const { setupState, props } = instance

    // 返回setup里面定义的和props上的
    if (key in setupState) return setupState[key]
    if (key in props) return props[key]

    // 接口
    const publicGetter = publicPropertiesMap[key]
    // 如果有接口, 返回接口的值
    if (publicGetter) return publicGetter(instance)
  }
}