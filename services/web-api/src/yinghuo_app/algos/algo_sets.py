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
"""
main app
"""
__author__ = "Zhang Lizhi"
__date__ = "2024-04-19"


class Register(object):
    def __init__(self, name):
        self.algos = dict()
        self.name = name

    def register_module(self):
        def _register(target):
            name = target.__name__.lower()
            self.algos[name] = target
            return target

        return _register


ALGOS = Register("algos")
