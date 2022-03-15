import { reactive } from '../reactive'

describe('reactive', () => {
    it('happy path', () => {
        const obj = { age: 1 };
        const observed = reactive(obj);
        expect(observed).not.toBe(obj);
        expect(observed.age).toBe(1);
    });
});