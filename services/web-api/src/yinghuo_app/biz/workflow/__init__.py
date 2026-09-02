"""审批工作流引擎(Stage 5)。

与 `yinghuo_app/flow/`(AI 推理功能开关)完全解耦;此处只做标注审批的状态机、
抽样、双审、仲裁。所有模型走 Tortoise/PostgreSQL,与 Stage 4 保持一致。
"""
