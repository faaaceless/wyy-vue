import { PublicInstanceProxyHandlers } from "./componentPublicInstance"

export function createComponentInstance(vnode: any) {

  const instance = {
    vnode,
    setupState: {}
  }
  return instance
}

export function setupComponent(instance: any) {

  setupStatefulComponent(instance)
}

function setupStatefulComponent(instance: any) {
  const component = instance.vnode.type

  const { setup } = component
  if (setup) {
    const setupRes = setup()
    handleSetupResult(setupRes, instance)
  }

  // 任意代理一个对象, 这里是为了把instance传进去, 返回setup结果
  instance.proxy = new Proxy({ _: instance }, PublicInstanceProxyHandlers)
}

function handleSetupResult(setupRes, instance) {

  if (typeof setupRes === 'object') {
    instance.setupState = setupRes
  }

  finishComponentSetup(instance)
}

function finishComponentSetup(instance: any) {
  const component = instance.vnode.type

  if (component.render) {
    instance.render = component.render
  }
}

