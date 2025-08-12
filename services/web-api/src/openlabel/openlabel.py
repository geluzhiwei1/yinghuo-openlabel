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
base class
"""
__author__ = "Zhang Lizhi"
__date__ = "2023-11-14"

import os
import json
import yaml
import pydash
from glob import glob

class OpenLabel():
    """_summary_

    Args:
        object (_type_): _description_
    """
    
    JSON_PATHS = ["./", "~/.cache", os.path.join(os.path.dirname(__file__), '../')]

    @classmethod
    def from_taxonomy_key(cls, taxonomy_key: str, domain_key:str):
        json_name = f"{taxonomy_key}"
        for p in cls.JSON_PATHS:
            full_path = os.path.join(
                p, "openlabel-specs", domain_key, json_name)
            if os.path.exists(full_path):
                print(f"Load from {full_path}")
                return cls.from_json_file(full_path)

        raise Exception(f"Can't find {json_name} in {cls.JSON_PATHS}")

    @classmethod
    def from_json(cls, json: dict):
        return cls(json)

    @classmethod
    def from_json_file(cls, json_fpn: str):
        doc = json.load(open(json_fpn, "rt"))
        return cls(doc)
    
    @classmethod
    def available_domains(cls):
        return [
            {"key": "intelligent-driving", "name": "智能驾驶"},
            {"key": "medical-ultrasound", "name": "医疗-超声影像"},
            {"key": "open-dataset", "name": "公开数据集"},
        ]
    
    @classmethod
    def available_taxonomy(cls, domain_key = 'intelligent-driving'):
        merged_json_files = set()
        for p in cls.JSON_PATHS:
            full_path = os.path.join(
                p, "openlabel-specs", domain_key)
            json_files = glob(f'{full_path}/*.json')
            for jf in json_files:
                if jf not in merged_json_files:
                    merged_json_files.add(jf)
                    
        taxonomys = []
        for jf in merged_json_files:
            base_name = os.path.basename(jf)
            taxonomy = base_name
            version = ""
            language = ""
            
            doc = json.load(open(jf, "rt"))
            taxonomy_info = doc['openlabel']['meta']
            taxonomy_info['taxonomy'] = taxonomy
            taxonomy_info['taxonomy_key'] = taxonomy
            taxonomy_info['version'] = version
            taxonomy_info['language'] = language
            taxonomy_info['json_file'] = jf
            taxonomy_info['domain'] = domain_key
            
            taxonomys.append(taxonomy_info)
        
        return taxonomys
    
    def __init__(self, json: dict) -> None:
        self._doc = json
        self._process_property()

    def _openlabel(self):
        return self._doc

    def _process_property(self):
        """
        类别树父节点们的属性，追加到叶子节点
        """
        child_to_parent_dict = {}
        cla_to_properties = {}

        def _property(cur_cls):
            parent_properties = []
            # find parent's properties
            cur_cls_name = cur_cls['name']
            parent_properties.append(cla_to_properties[cur_cls_name])
            while cur_cls_name in child_to_parent_dict:
                cur_cls_name = child_to_parent_dict[cur_cls_name]
                print(f'Process properties {cur_cls_name}')
                parent_properties.append(cla_to_properties[cur_cls_name])

            merged_properties = {}
            for parent_properties_ in parent_properties:
                merged_properties.update(parent_properties_)

            cur_cls['properties'] = merged_properties
            # cur_cls['ui:order'] = ['status', 'firstName', '*', 'password']

        def process_cls(cur_cls: dict):
            if "properties" not in cur_cls:
                cur_cls["properties"] = {}
            cla_to_properties[cur_cls["name"]] = cur_cls["properties"]
            childrens = pydash.get(cur_cls, "children", [])
            for next_cls in childrens:
                child_to_parent_dict[next_cls["name"]] = cur_cls["name"]
            if len(childrens) == 0:
                # 叶子节点
                _property(cur_cls)
            for next_cls in childrens:
                process_cls(next_cls)

        for cls in pydash.get(self._doc, "openlabel.classes", []):
            process_cls(cls)

    def _get_class_names(self, leaf_node_only: bool = True):
        """获取类名列表

        Args:
            leaf_node_only (bool, optional): 是否只返回叶子节点的类别. Defaults to True.
        """
        class_names = []

        def process_cls(cur_cls: dict):
            cla_name = pydash.get(cur_cls, "name", "")
            childrens = pydash.get(cur_cls, "children", [])
            if leaf_node_only:
                # 只要叶子节点
                if len(childrens) == 0:
                    class_names.append(cla_name)
            else:
                class_names.append(cla_name)

            for next_cls in childrens:
                process_cls(next_cls)
        for cls in pydash.get(self._doc, "openlabel.classes", []):
            process_cls(cls)

        # default_cla = 'Car'
        # class_names.remove(default_cla)
        # class_names.insert(0, default_cla)

        return class_names

    def openlabel(self):
        return self._openlabel()

    def get_class_names(self, leaf_node_only: bool = True):
        return self._get_class_names(leaf_node_only=leaf_node_only)
    
    def __str__(self) -> str:
        def process_node(l:int, node, lines:list):
            lines.append('\t'*l + node['name'])
            if 'children' in node:
                for sub_node in node['children']:
                    process_node(l+1, sub_node, lines)
        lines = []
        lines.append(pydash.get(self._doc, 'openlabel.name', ''))
        for node in self._doc['openlabel']['classes']:
            layer = 1
            process_node(layer, node, lines)
            
        return '\n'.join(lines)
    
    def get_class_tree(self):
        class_names = []
        class_name_id_map = {}

        self.class_id = -1
        
        def process_cls(cur_cls: dict, parent):
            cla_name = pydash.get(cur_cls, "name", "")
            childrens = pydash.get(cur_cls, "children", [])

            self.class_id = self.class_id + 1
            node = {
                "id": self.class_id,
                "name": cla_name,
            }
            if parent == -1:
                node['parent'] = None
            else:
                node['parent'] = parent
            class_names.append(node)
            
            class_name_id_map[cla_name] = self.class_id
            
            parent = self.class_id
            for next_cls in childrens:
                process_cls(next_cls, parent)
            
        parent = self.class_id
        for cls in self._doc['openlabel']['classes'][0]['children']:
            process_cls(cls, parent)

        return class_names, class_name_id_map
