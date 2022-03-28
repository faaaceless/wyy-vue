const publicPropertiesMap = {
  $el: (instance) => instance.vnode.el
}

export const PublicInstanceProxyHandlers = {
  get({ _: instance }, key) {
    // setupState就是setupRes, 要在setup之后
    const { setupState } = instance
    if (key in setupState) return setupState[key]

    // 接口
    const publicGetter = publicPropertiesMap[key]
    // 如果有接口, 返回接口的值
    if (publicGetter) return publicGetter(instance)
  }
}