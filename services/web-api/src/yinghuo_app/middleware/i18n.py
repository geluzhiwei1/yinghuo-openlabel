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
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from babel.support import Translations
from typing import List, Callable
from contextvars import ContextVar

# 1. Define a context variable with a default dummy gettext function.
_gettext_ctx: ContextVar[Callable[[str], str]] = ContextVar('gettext', default=lambda s: s)

# 2. Create a proxy callable class
class _Translator:
    def __call__(self, text: str) -> str:
        return _gettext_ctx.get()(text)

_ = _Translator()

class I18nMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app,
        default_lang: str = "en_US",
        available_langs: List[str] = ["en_US", "zh_CN"],
        translation_path: str = "locales",
    ):
        super().__init__(app)
        self.default_lang = default_lang
        self.available_langs = available_langs
        self.translation_path = translation_path
        self.translations = self._load_translations()

    def _load_translations(self) -> dict[str, Translations]:
        """Loads all translations from the locales directory."""
        translations = {}
        for lang in self.available_langs:
            translations[lang] = Translations.load(
                self.translation_path, [lang], domain="messages"
            )
        return translations

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint):
        lang_code = request.headers.get("Accept-Language", self.default_lang)
        if 'lang' in request.query_params:
            lang_code = request.query_params['lang']

        if lang_code not in self.available_langs:
            lang_code = self.default_lang
        
        translator = self.translations.get(lang_code)
        
        if translator:
            token = _gettext_ctx.set(translator.gettext)
            response = await call_next(request)
            _gettext_ctx.reset(token)
            return response
        
        # Fallback for untranslated languages
        response = await call_next(request)
        return response
