# 2d bbox

## 主动功能
拉框
点框
插值

onnx model 单帧

本地、网络、label导出

高级：
    ground dino
    SAM: 点辅助，框辅助
    Video： Detect & Track

VLM


API 标准化，用户可以自定义模型

## TODO
- 【√】插值
- 【√】提示词标注-ui改进
- 【√】辅助分割-ui改进
- 【√】视频辅助标注
- 设置  简化
- 【√】保存、加载标注
- 标注导入、导出
- 单个图像标注：本地、网络  标注贴入、贴出
- 【√】seq属性：序列-帧-对象

# 2d rbbox

## 示例数据 https://www.kaggle.com/datasets/andrewmvd/ship-detection

# video
- 删除标注
  - 删除后保存
  - 删除后undo
- 左侧标注表格
  - 点击后，视频跳转到开始时间
- 字幕
  - 如果有则显示，否则隐藏