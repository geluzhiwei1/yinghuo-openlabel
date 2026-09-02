"""SMTP 配置读取。环境变量优先于 yaml(K8s/CI 友好,避免 secret 入库)。

敏感字段(user/password)通过环境变量注入:
  YH_SMTP_USER
  YH_SMTP_PASSWORD

业务字段(host/port/ssl/mail_from)只在 yaml 配置。
"""
import os

from yinghuo_conf.config import gConf


def get_smtp_config() -> dict:
    """返回 emails 库 m.send(smtp=...) 期望的 dict。"""
    cfg = gConf["global"].get("smtp") or {}

    env_overrides = {
        "user": os.environ.get("YH_SMTP_USER"),
        "password": os.environ.get("YH_SMTP_PASSWORD"),
    }
    for k, v in env_overrides.items():
        if v:
            cfg[k] = v

    for required in ("host", "port", "user", "password"):
        val = cfg.get(required)
        if not val or str(val).startswith("REPLACE_WITH_"):
            raise RuntimeError(
                f"global.smtp.{required} 未配置或仍为占位符;请在 yaml 替换占位符"
                f"或设置环境变量 YH_SMTP_USER / YH_SMTP_PASSWORD"
            )
    return cfg


def get_mail_from() -> str:
    """默认发件人地址。yaml mail_from 优先,占位符或缺失时 fallback 到 user
    (QQ 邮箱等要求 mail_from == 认证 user,get_smtp_config 已校验 user 非空)。
    """
    cfg = gConf["global"].get("smtp") or {}
    mail_from = cfg.get("mail_from")
    if mail_from and not str(mail_from).startswith("REPLACE_WITH_"):
        return mail_from
    return cfg.get("user")
