"""实时通知(Stage 12 MVP)。

存储:Redis list + pub/sub channel,每用户独立。
事件 schema:
    {
        "id": "evt_xxx",            # 唯一 id
        "type": "instance.approved",
        "title": "...",
        "body": "...",
        "tenant_id": "test",
        "user_id": 42,
        "data": {...},              # type-specific 载荷
        "created_at": "2026-06-29T12:34:56Z",
        "read": False,
    }
"""
