import * as THREE from 'three'
import { OlTypeEnum, type BBox3d } from '@/openlabel'

const glObjectToBBox = (glBox: THREE.Object3D):BBox3d => {
    const ann = {
      ...glBox.userData.anno,
      // position: {
      //   x: glBox.position.x,
      //   y: glBox.position.y,
      //   z: glBox.position.z
      // },
      // scale: {
      //   x: glBox.scale.x,
      //   y: glBox.scale.y,
      //   z: glBox.scale.z
      // },
      // rotation: {
      //   x: glBox.rotation.x,
      //   y: glBox.rotation.y,
      //   z: glBox.rotation.z
      // }
      val: [glBox.position.x, glBox.position.y, glBox.position.z,
            glBox.rotation.x, glBox.rotation.y, glBox.rotation.z,
            glBox.scale.x, glBox.scale.y, glBox.scale.z]
    } as BBox3d
    return ann
}

const glObjectToBBox3d = (glBox: THREE.Object3D):BBox3d => {
  const ann = {
    ...glBox.userData.anno,
    val: [glBox.position.x, glBox.position.y, glBox.position.z,
          glBox.rotation.x, glBox.rotation.y, glBox.rotation.z,
          glBox.scale.x, glBox.scale.y, glBox.scale.z],
    ol_type_: OlTypeEnum.BBox3d
  } as BBox3d
  return ann
}

const objectPositionToScreen = (camera:THREE.Camera, object:THREE.Object3D, renderer:THREE.Renderer) => {
  const vector = new THREE.Vector3();
  vector.setFromMatrixPosition(object.matrixWorld); // 设置向量为对象的世界坐标
  vector.project(camera); // 将世界坐标转换为屏幕坐标

  const widthHalf = 0.5 * renderer.domElement.width;
  const heightHalf = 0.5 * renderer.domElement.height;

  return {
      x: (vector.x * widthHalf + widthHalf) * renderer.domElement.width,
      y: ( - vector.y * heightHalf + heightHalf) * renderer.domElement.height // 注意Y轴的方向
  };
}

const pointToScreen = (camera:THREE.Camera, vector:THREE.Vector3, renderer:THREE.Renderer) => {
  vector.project(camera); // 将世界坐标转换为屏幕坐标
  const widthHalf = 0.5 * renderer.domElement.width;
  const heightHalf = 0.5 * renderer.domElement.height;

  return {
      x: (vector.x * widthHalf + widthHalf) * renderer.domElement.width,
      y: ( - vector.y * heightHalf + heightHalf) * renderer.domElement.height // 注意Y轴的方向
  };
}

export { glObjectToBBox3d, objectPositionToScreen, pointToScreen }