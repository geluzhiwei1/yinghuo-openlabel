/**
 * 用typescript实现类ObjectPool，管理threejs中的Object3D对象。
该类应该具有以下功能：
1 构造函数:用参数设定允许的最大数量
2 获取对象数组:按照参数指定数量，如果对象不足，则new新的对象 
3 更新最大数量:当超过最大数量时，删除超过的对象
4 获取对象数量:返回当前对象池中的对象数量
5 获取最大数量:返回最大数量
6 销毁对象池:执行清空操作，并释放对象池的内存
 */
abstract class SimpleObjectPool<T> {
    private maxSize: number;
    private objects: T[];

    constructor(maxSize: number) {
        this.maxSize = maxSize;
        this.objects = [];
    }

    // 获取对象数组
    public getObjects(count: number): T[] {
        const result: T[] = [];
        if (this.objects.length < count) {
            // 如果对象不足，则new新的对象
            while (this.objects.length < count)
                this.objects.push(this.createObject());
        }
        // 返回参数指定数量的对象
        for (let i = 0; i < count; i++) {
            const object = this.getObject();
            result.push(object);
        }
        return result;
    }

    // 更新最大数量
    public setMaxSize(maxSize: number): void {
        this.maxSize = maxSize;
        this.cleanExceedObjects();
    }

    // 获取对象数量
    public getObjectCount(): number {
        return this.objects.length;
    }

    // 获取最大数量
    public getMaxSize(): number {
        return this.maxSize;
    }

    // 销毁对象池
    public destroy(): void {
        this.objects.forEach(o => this.destroyObject(o));
        this.objects = [];
    }

    // 回收对象
    public returnObjects(objects:Array<T>) {
        this.objects.concat(objects)
    }

    // 当超过最大数量时，删除超过的对象
    private cleanExceedObjects(): void {
        while (this.objects.length > this.maxSize) {
            const o = this.objects.shift();
            this.destroyObject(o)
        }
    }

    // 获取对象
    private getObject(): T|undefined {
        if (this.objects.length > 0) {
            return this.objects.shift();
        } else {
            return undefined;
        }
    }

    abstract createObject(): T
    abstract destroyObject(object: T): void
}

export { SimpleObjectPool }