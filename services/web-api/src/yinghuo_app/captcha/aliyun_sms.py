"""阿里云短信(SendSms)直接 HTTP 实现。

不依赖任何阿里云 SDK,使用 RPC V1 签名(HMAC-SHA1 + base64),
通过项目已有的 httpx.AsyncClient 异步发送。

配置从 yaml `global.sms` 段读取,包含字段:
  access_key_id:      阿里云 AccessKey Id
  access_key_secret:  阿里云 AccessKey Secret
  sign_name:          短信签名(需在阿里云控制台审核通过)
  template_code:      短信模板 CODE(如 SMS_xxxxxxxxx)
  endpoint:           可选,默认 dysmsapi.aliyuncs.com

签名算法参考:
  https://help.aliyun.com/document_detail/315526.html
"""
import base64
import hashlib
import hmac
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from urllib.parse import quote

import httpx
from yinghuo_conf.config import gConf

logger = logging.getLogger(__name__)

DEFAULT_ENDPOINT = "dysmsapi.aliyuncs.com"
DEFAULT_REGION = "cn-hangzhou"


def _get_sms_config() -> dict:
    """读取短信配置。环境变量优先于 yaml(K8s/CI 友好,避免 secret 入库)。

    AccessKey 类敏感字段通过环境变量注入:
      ALIYUN_SMS_ACCESS_KEY_ID
      ALIYUN_SMS_ACCESS_KEY_SECRET
    业务字段(sign_name/template_code)只在 yaml 配置。
    """
    sms_cfg = gConf["global"].get("sms") or {}

    env_overrides = {
        "access_key_id": os.environ.get("ALIYUN_SMS_ACCESS_KEY_ID"),
        "access_key_secret": os.environ.get("ALIYUN_SMS_ACCESS_KEY_SECRET"),
    }
    for k, v in env_overrides.items():
        if v:
            sms_cfg[k] = v

    for required in ("access_key_id", "access_key_secret", "sign_name", "template_code"):
        val = sms_cfg.get(required)
        if not val or str(val).startswith("REPLACE_WITH_"):
            raise RuntimeError(
                f"global.sms.{required} 未配置或仍为占位符;请在 yaml 替换占位符"
                f"或设置环境变量 ALIYUN_SMS_ACCESS_KEY_ID / ALIYUN_SMS_ACCESS_KEY_SECRET"
            )
    return sms_cfg


def _pct_encode(value) -> str:
    """阿里云 RPC V1 要求的 RFC 3986 百分号编码。

    规则:字母数字与 -_.~ 不编码,其他全部 %XX;空格为 %20(不是 +)。
    """
    return quote(str(value), safe="-_.~")


def _sign(params: dict, access_key_secret: str) -> str:
    """计算 RPC V1 签名,返回 base64 字符串。

    阿里云 RPC V1 待签名字符串构造:
      canonical = "&".join(f"{pct(k)}%3D{pct(v)}")  # 注意 = 编码为 %3D,& 是字面分隔符
      sts = "GET&%2F&" + canonical                   # canonical 直接拼接,不再二次编码
      sig = base64(HMAC-SHA1(key=secret+"&", msg=sts))
    """
    canonical = "&".join(
        f"{_pct_encode(k)}%3D{_pct_encode(v)}" for k, v in sorted(params.items())
    )
    string_to_sign = "GET&" + _pct_encode("/") + "&" + canonical
    digest = hmac.new(
        (access_key_secret + "&").encode("utf-8"),
        string_to_sign.encode("utf-8"),
        hashlib.sha1,
    ).digest()
    return base64.b64encode(digest).decode("utf-8")


def _build_signed_url(params: dict, access_key_secret: str, endpoint: str) -> str:
    params = dict(params)
    params["Signature"] = _sign(params, access_key_secret)
    query = "&".join(f"{_pct_encode(k)}={_pct_encode(v)}" for k, v in params.items())
    return f"https://{endpoint}/?{query}"


async def send(code: str, mobile: str) -> bool:
    """发送验证码短信。成功返回 True,任何失败返回 False(已记录日志)。"""
    cfg = _get_sms_config()
    endpoint = cfg.get("endpoint", DEFAULT_ENDPOINT)

    params = {
        "PhoneNumbers": mobile,
        "SignName": cfg["sign_name"],
        "TemplateCode": cfg["template_code"],
        "TemplateParam": json.dumps({"code": code}, separators=(",", ":")),
        "Action": "SendSms",
        "Version": "2017-05-25",
        "Format": "JSON",
        "RegionId": DEFAULT_REGION,
        "AccessKeyId": cfg["access_key_id"],
        "SignatureMethod": "HMAC-SHA1",
        "SignatureVersion": "1.0",
        "SignatureNonce": uuid.uuid4().hex,
        "Timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    url = _build_signed_url(params, cfg["access_key_secret"], endpoint)

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url)
    except Exception as e:
        logger.exception("Aliyun SMS HTTP request failed: %s", e)
        return False

    if resp.status_code != 200:
        logger.error(
            "Aliyun SMS HTTP %d: body=%s", resp.status_code, resp.text[:500]
        )
        return False

    try:
        data = resp.json()
    except ValueError:
        logger.error("Aliyun SMS non-JSON response: %s", resp.text[:500])
        return False

    if data.get("Code") != "OK":
        logger.error(
            "Aliyun SMS rejected: Code=%s Message=%s RequestId=%s",
            data.get("Code"), data.get("Message"), data.get("RequestId"),
        )
        return False
    return True
