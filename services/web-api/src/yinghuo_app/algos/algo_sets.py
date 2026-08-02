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
