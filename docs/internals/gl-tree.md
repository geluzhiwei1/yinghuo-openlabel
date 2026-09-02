# point cloud
## pcd
x,y,z,rgb,intensity,normal_x,normal_y,normal_z,intensity,label

## las
Point Format 7
https://laspy.readthedocs.io/en/latest/intro.html

# gl tree

- camera
- scene
  - rangeRefer
  - SensorAxes
  - groundGrid
  - transform control
  - viewsGroup 'view-z-camera'
    - z-camera
  - viewsGroup 'view-y-camera'
    - y-camera
  - viewsGroup 'view-x-camera'
    - x-camera
  - framesGroup 'frames '
    - egoFrame  'ego-ts' # matrix设置为 ego在world的pose
      - lidar 'sensor-id' # matrix设置为 lidar 在 ego 的外参
        - point cloud mesh  'pcd-' # 点为lidar坐标系
        - box3d 'boxes in lidar'  'boxes3d-'
        - pointsGroup #'points-ts'
          - pointsObjectGroup 'pointsObject-id' # 点组成的对象，1到n个
          - selectedGroup '已经选择的点'
          - highlightGroup '鼠标滑过的点'
        - polylineGroup # 线组成的对象，1到那个
          - selected
          - highlight
          - polylineObject-line
            - line
          - polylineObject-control points
            - control points group
              - control points 
        - polygonsObject # 多边形

      - camera 'sensor-idxx'
        - point cloud mesh  'ipcd-'
        - box3d 'boxes in camera'  'camera-boxes-'

      - map 'sensor-map'
        - map line mesh