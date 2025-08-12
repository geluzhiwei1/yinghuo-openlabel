# Copyright (C) 2025 geluzhiwei.com
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.
import threading
import time
from collections import OrderedDict
from datetime import datetime, timedelta

class TimedObject:
    def __init__(self, key, obj):
        self.key = key
        self.obj = obj
        self.timestamp = datetime.now()

class ObjectPool:
    def __init__(self, expiration_time=180):
        """
        初始化对象池
        :param expiration_time: 对象过期时间（秒）
        """
        self.expiration_time = expiration_time
        self.pool = OrderedDict()  # 使用OrderedDict以保持插入顺序
        self.lock = threading.Lock()
        self._cleanup_thread = threading.Thread(target=self._cleanup_worker)
        self._cleanup_thread.daemon = True
        self._cleanup_thread.start()

    def _cleanup_worker(self):
        """
        清理工作线程，定期检查并移除过期对象
        """
        while True:
            time.sleep(60)  # 每分钟检查一次
            with self.lock:
                now = datetime.now()
                while self.pool:
                    key, timed_obj = self.pool.popitem(last=False)  # popitem(last=False)会弹出最旧的项目
                    if (now - timed_obj.timestamp) > timedelta(seconds=self.expiration_time):
                        # 对象已过期，不进行放回
                        continue
                    # 对象未过期，放回池中
                    self.pool[key] = timed_obj
                    break  # 每次只检查最旧的一个对象，以减少锁的持有时间

    def get_object(self, key):
        """
        通过key从池中获取一个对象，如果对象已过期或不存在，则返回None
        """
        with self.lock:
            timed_obj = self.pool.get(key)
            if timed_obj and (datetime.now() - timed_obj.timestamp) <= timedelta(seconds=self.expiration_time):
                # 更新时间戳
                timed_obj.timestamp = datetime.now()
                return timed_obj.obj
            return None  # 对象不存在或已过期

    def release_object(self, key, obj):
        """
        将对象放回池中，使用新的时间戳
        """
        with self.lock:
            self.pool[key] = TimedObject(key, obj)

    def remove_object(self, key):
        """
        从池中移除一个对象
        """
        with self.lock:
            if key in self.pool:
                del self.pool[key]

# 使用示例
pool = ObjectPool(expiration_time=180)

# 创建并存储一个对象
key1 = "obj1"
obj1 = f"Object_{key1}_{time.time()}"
pool.release_object(key1, obj1)

# 获取对象
retrieved_obj1 = pool.get_object(key1)
print(f"Retrieved object: {retrieved_obj1}")

# 等待一段时间后再次尝试获取，以观察自动清理效果（可选）
time.sleep(5)  # 这里的等待时间只是为了演示，实际使用时应根据需要调整
retrieved_obj1_after_sleep = pool.get_object(key1)
if retrieved_obj1_after_sleep:
    print(f"Object still exists after sleep: {retrieved_obj1_after_sleep}")
else:
    print("Object has expired or been removed.")

# 移除对象
pool.remove_object(key1)