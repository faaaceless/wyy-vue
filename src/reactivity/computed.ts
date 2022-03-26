import { Effect } from "./effect"

class ComputedRefImpl {
    private _getter: any
    private _value: any
    public _dirty: boolean = true
    private _effect: any
    // 它的特点是不访问它的value的时候不会执行getter, 并且value值没变, 下一次访问value也不执行getter
    constructor(getter) {
        this._getter = getter
        // 用schedule改变dirty表示更新了, 而没有触发get, 从而保持lazy更新
        this._effect = new Effect(getter, () => {
            this._dirty = true
        })
    }

    get value() {
        // dirty 控制lazy更新, 不重复计算
        if (this._dirty) {
            this._dirty = false
            // NOTE:这种做法一是没收集依赖, 改变依赖的值执行trigger会报错, 
            // 二是没法更新dirty, 依赖的值更新了它不知道要更新
            // this._value = this._getter()
            this._value = this._effect.run()
        }
        return this._value
    }
}

function computed(getter) {
    return new ComputedRefImpl(getter)
}

export { computed }