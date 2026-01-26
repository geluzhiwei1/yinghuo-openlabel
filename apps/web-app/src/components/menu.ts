/*
Copyright (C) 2025 格律至微

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/
import { type Menus } from '@/types/menu'

// TODO 后台接口获取
export const menuData: Menus[] = [
  {
    id: '0',
    title: 'home.menu.dashboard',
    index: '/dashboard',
    role: 'dashboard',
    icon: 'ic:sharp-dashboard'
  },
  {
    id: '2',
    title: 'home.menu.annojob',
    icon: 'fluent:clipboard-task-list-24-filled',
    index: '/annojob',
    role: 'annojob'
  },
  {
    id: '4',
    title: 'home.menu.anno-manager',
    index: '4',
    icon: 'icon-park-outline:data-user',
    children: [
      {
        id: '41',
        pid: '1',
        index: '/my-job',
        role: 'my-job',
        title: 'home.menu.my-job'
      },
      {
        id: '43',
        pid: '1',
        index: '/anno-specification',
        role: 'anno-specification',
        title: 'home.menu.anno-specification'
      }
      // {
      //     id: '42',
      //     pid: '1',
      //     index: '/data-package-manager',
      //     role: 'data-package-manager',
      //     title: '数据包管理'
      // },
      // {
      //     id: '45',
      //     pid: '1',
      //     index: '/label-batch',
      //     role: 'label-batch',
      //     title: '标注批次'
      // },
    ]
  },
  {
    id: '5',
    title: 'home.menu.system-data',
    index: '5',
    icon: 'bi:database-fill-gear',
    children: [
      {
        id: '13',
        pid: '5',
        index: '/system-user',
        role: 'system-user',
        title: 'home.menu.system-user'
      },
      {
        id: '10',
        pid: '5',
        index: '/system-dept',
        role: 'system-dept',
        title: 'home.menu.system-dept'
      },
      {
        id: '12',
        pid: '5',
        index: '/system-role',
        role: 'system-role',
        title: 'home.menu.system-role'
      }
    ]
  }
  // {
  //     id: '1',
  //     title: '系统设置',
  //     index: '2',
  //     icon: 'carbon:gui-management',
  //     children: [
  //         {
  //             id: '11',
  //             pid: '1',
  //             index: '/user-info',
  //             role: 'user-info',
  //             title: '我的信息',
  //         },
  //         {
  //             id: '13',
  //             pid: '1',
  //             index: '/system-menu',
  //             title: '菜单管理',
  //         },
  //     ],
  // },
]
