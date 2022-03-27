export function createComponentInstance(vnode: any) {

  const instance = {
    vnode,
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

