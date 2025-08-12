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
import matplotlib
matplotlib.use('agg')
import matplotlib.pyplot as plt

import numpy as np
from .bbox import BBox


class Visualizer2D:
    
    @classmethod
    def frame_visualization(cla, bboxes_f7, ids=None, scores=None, gt_bboxes_f7=None, gt_ids=None, pc=None, output_fpn=None):
        visualizer = cla(figsize=(24, 24))
        if pc is not None:
            visualizer.handler_pc(pc)
        if gt_bboxes_f7 is not None:
            for _, bbox in enumerate(gt_bboxes_f7):
                bbox = BBox(x=bbox[0], y=bbox[1], z=bbox[2], h=bbox[5], w=bbox[4], l=bbox[3], o=bbox[6])
                visualizer.handler_box(bbox, message='', color='black')
        for i, bbox in enumerate(bboxes_f7):
            bbox = BBox(x=bbox[0], y=bbox[1], z=bbox[2], h=bbox[5], w=bbox[4], l=bbox[3], o=bbox[6])
            t = '' + str(ids[i]) if ids is not None else '' + f'{scores[i]:.3}' if scores is not None else ''
            visualizer.handler_box(bbox, message=t, color='light_blue')
        if output_fpn is not None:
            visualizer.save(output_fpn)
        visualizer.close()
    
    def __init__(self, name='', figsize=(8, 8), xlim=[-100, 100], ylim=[-100, 100]):
        self.figure = plt.figure(name, figsize=figsize)
        plt.axis('equal')
        plt.xlim(xlim)
        plt.ylim(ylim)
        self.COLOR_MAP = {
            'gray': np.array([140, 140, 136]) / 256,
            'light_blue': np.array([4, 157, 217]) / 256,
            'red': np.array([191, 4, 54]) / 256,
            'black': np.array([0, 0, 0]) / 256,
            'purple': np.array([224, 133, 250]) / 256, 
            'dark_green': np.array([32, 64, 40]) / 256,
            'green': np.array([77, 115, 67]) / 256
        }
    
    def show(self):
        plt.show()
    
    def close(self):
        plt.close()
    
    def save(self, path):
        plt.savefig(path)
    
    def handler_pc(self, pc, color='gray'):
        vis_pc = np.asarray(pc)
        plt.scatter(vis_pc[:, 0], vis_pc[:, 1], marker='o', color=self.COLOR_MAP[color], s=0.01)
    
    def handler_box(self, box: BBox, message: str='', color='red', linestyle='solid'):
        corners = np.array(BBox.box2corners2d(box))[:, :2]
        corners = np.concatenate([corners, corners[0:1, :2]])
        plt.plot(corners[:, 0], corners[:, 1], color=self.COLOR_MAP[color], linestyle=linestyle)
        corner_index = np.random.randint(0, 4, 1)
        plt.text(corners[corner_index, 0] - 1, corners[corner_index, 1] - 1, message, color=self.COLOR_MAP[color])