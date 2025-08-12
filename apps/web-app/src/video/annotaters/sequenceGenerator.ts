/**
 * 生成number类型的序号；
 * 包括如下功能：
 * 1 获取序号，每次获取的序号不可以重复
 * 2 归还序号
 * 3 用构造函数设置序号区间 start,end；序号从start开始，到end结束后，自动从start开始
 * @author Zhang Lizhi
 * @email erlingba@qq.com
 * @date 2024年4月16日16:12:00
 * @date 甲辰 [龙] 年 三月初八
 */
class SequenceGenerator {
    private currentNumber: number;
    private start: number;
    private end: number;
    private usedNumbers: Set<number>;

    constructor(start: number, end: number) {
        this.start = start;
        this.end = end;
        this.currentNumber = start - 1; // 初始化时，当前序号设为起始值的前一个值
        this.usedNumbers = new Set<number>();
    }

    reset(): void {
        this.currentNumber = this.start - 1; // 初始化时，当前序号设为起始值的前一个值
        this.usedNumbers.clear();
    }

    getUsedNumbers(): Set<number> {
        return this.usedNumbers;
    }

    /**
     * 获取序号
     * @returns 返回一个未使用的序号
     * @throws 如果所有序号都已被使用，则抛出异常
     */
    useNext(): number {
        if (this.usedNumbers.size >= (this.end - this.start + 1)) {
            throw new Error('All numbers in the sequence have been used.');
        }

        // 寻找下一个可用的序号
        while (true) {
            this.currentNumber = this.currentNumber + 1
            if (!this.usedNumbers.has(this.currentNumber)) {
                this.usedNumbers.add(this.currentNumber);
                return this.currentNumber;
            }
        }
    }

    /**
     * 归还序号
     * @param number 要归还的序号
     * @throws 如果传入的序号不在序号区间内，则抛出异常
     */
    release(number: number): void {
        if (number < this.start || number > this.end) {
            // throw new Error(`The number ${number} is not within the sequence range.`);
            return
        }

        this.usedNumbers.delete(number);
    }
}


export { SequenceGenerator }