import * as THREE from 'three'


const objectPositionToScreen = (camera:THREE.Camera, object:THREE.Object3D, renderer:THREE.Renderer) => {
  const vector = new THREE.Vector3();
  object.matrixWorldNeedsUpdate = true
  object.updateMatrixWorld()
  vector.setFromMatrixPosition(object.matrixWorld)
  console.log(vector)
  vector.project(camera)

  const centerx = renderer.domElement.width * 0.5
  const centery = renderer.domElement.height * 0.5

  // const x = Math.round((0.5 + vector.x / 2) * (width / window.devicePixelRatio))
  // const y = Math.round((0.5 - vector.y / 2) * (height / window.devicePixelRatio))
  // return {x, y}

  return {
      x: (vector.x * centerx + centerx),
      y: (vector.y * centery - centery)
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

export { objectPositionToScreen, pointToScreen }