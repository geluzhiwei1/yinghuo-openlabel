<template>
  <div
    class="three-scene"
    ref="threeScene"
    :style="{
      width: width + 'px',
      height: height + 'px',
      'background-color': sceneColor,
    }"
  >
    <slot></slot>
    <div v-if="infoVisible" class="info">{{  infoMessage }}</div>
    <RightMenu
      v-if="showRight"
      :top="rightPosition.y"
      :left="rightPosition.x"
      :infoVisible="infoVisible"
      @reset="onReset"
      @save="onSave"
      @info="onInfo"
    />
    <ScaleBar
      :scale="scale"
      v-if="direction === 'main' && scaleVisible"
    ></ScaleBar>
    <div id="viewcube-container" v-if="cubeController && guide">
      <div class="cube" ref="navCube">
        <div
          v-for="key in Object.keys(ViewCubeController.CubeOrientation)"
          :key="key"
          :class="[`cube__face cube__face--${key.toLowerCase()}`]"
          @click="onCubeClick(ViewCubeController.CubeOrientation[key])"
        >
          {{ ViewCubeController.CubeOrientation[key] }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, unref, onMounted, watch } from "vue";
import * as THREE from "three";
import { GUI } from "three/addons/libs/lil-gui.module.min.js";
import Stats from "three/addons/libs/stats.module.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { NRRDLoader } from "three/addons/loaders/NRRDLoader.js";
import { VTKLoader } from "three/addons/loaders/VTKLoader.js";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import gsap from "gsap";
import ViewCubeController from "../libs/ViewCubeController";

import RightMenu from "./RightMenu.vue";
import ScaleBar from "./ScaleBar.vue";

// #region 变量定义
const props = defineProps([
  "width",
  "height",
  "direction",
  "infoVisible",
  "position",
  "value",
  "max",
  "status",
  "operation",
  "navDirection",
  "sceneColor",
  "guide",
  "scaleVisible",
  "max",
]);
const emits = defineEmits(["update:value", "update:infoVisible", "update:max"]);
const threeScene = ref(null);
let scene,
  camera,
  renderer,
  controls,
  vtkloader,
  cube,
  stats,
  font,
  cubeTips,
  gui;

const mat = new THREE.Matrix4();
const cubeController = ref(null);
const rightPosition = ref({ x: 0, y: 0, z: 0 });
const showRight = ref(false);
const defaultValue = unref(props.value);
const navCube = ref(null);
const scale = ref(1);
const infoMessage = ref("Ready")
// #endregion 变量定义

watch(
  () => props.width,
  () => {
    onResize();
  }
);

watch(
  () => props.status,
  () => {
    stats && (stats.domElement.style.display = props.status ? "block" : "none");
  }
);

watch(
  () => props.operation,
  () => {
    gui && (gui.domElement.style.display = props.operation ? "block" : "none");
  }
);

watch(
  () => props.position,
  () => {
    updateNRRDModel();
  },
  {
    deep: true,
  }
);

watch(
  () => props.navDirection,
  () => {
    const { offsetFactor } =
      ViewCubeController.ORIENTATIONS[props.navDirection];
    updateNav(offsetFactor);
  }
);

//#region 生命周期
onMounted(() => {
  loadFont();
  initThreeScene();
  threeScene.value.addEventListener("resize", onResize);
});

//#endregion 生命周期
//#region Function
const initThreeScene = () => {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    75,
    props.width / props.height,
    0.1,
    1000
  );

  updateCameraPosition();

  scene.add(camera);

  renderer = new THREE.WebGLRenderer({
    //想把canvas画布上内容下载到本地，需要设置为true
    preserveDrawingBuffer: true,
    alpha: true,
  });
  renderer.setSize(props.width, props.height);

  renderer.domElement.addEventListener("mousedown", onMousedown, false);
  threeScene.value.appendChild(renderer.domElement);
  controls = new OrbitControls(camera, renderer.domElement);

  controls.minDistance = 1;
  // controls.maxDistance =1000;
  controls.enableRotate = false;
  controls.enablePan = true;

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x000000, 3);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
  dirLight.position.set(200, 200, 200);
  scene.add(dirLight);

  if (props.direction == "main") {
    gui = new GUI();
    gui.domElement.style.display = props.operation ? "block" : "none";
    gui.title("主视图控制");
    threeScene.value.appendChild(gui.domElement);
    cubeController.value = new ViewCubeController(camera);
    addStats();
  }
  // loadVTKModel();
  loadNRRDModel();
  animate();
};
const updateNRRDModel = () => {
  if (props.direction == "x" && sliceX) {
    sliceX.index = props.position;
    sliceX.repaint.call(sliceX);
  } else if (props.direction == "y" && sliceY) {
    sliceY.index = props.position;
    sliceY.repaint.call(sliceY);
  } else if (props.direction == "z" && sliceZ) {
    sliceZ.index = props.position;
    sliceZ.repaint.call(sliceZ);
  }
};
const updateCameraPosition = () => {
  if (props.direction == "x") {
    camera.position.x = 500;
  } else if (props.direction == "y") {
    camera.position.y = 500;
  } else if (props.direction == "z") {
    camera.position.z = 500;
  } else {
    camera.position.set(props.position.x, props.position.y, props.position.z);
  }
};

const updateNav = (offsetFactor) => {
  const offsetUnit = camera.position.length();
  const offset = new THREE.Vector3(
    offsetUnit * offsetFactor.x,
    offsetUnit * offsetFactor.y,
    offsetUnit * offsetFactor.z
  );
  //ease: "elastic",
  gsap.fromTo(
    camera.position,
    { ...camera.position },
    {
      ...offset,
      duration: 2,
      onUpdate: () => { },
      onComplete: () => {
        emits("update:value", offset.clone());
      },
    }
  );
};

const loadVTKModel = () => {
  const vtkmaterial = new THREE.MeshLambertMaterial({
    wireframe: false,
    side: THREE.DoubleSide,
    color: 0xff0000,
  });

  vtkloader = new VTKLoader();
  vtkloader.load("models/vtk/liver.vtk", function (geometry) {
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, vtkmaterial);
    const visibilityControl = {
      visible: true,
      cubeTips: true,
      color: "#FFF",
    };
    if (props.direction === "main") {
      gui
        .add(visibilityControl, "visible")
        .name("模型显示")
        .onChange(function () {
          mesh.visible = visibilityControl.visible;
        });
      gui
        .add(visibilityControl, "cubeTips")
        .name("模型盒标签")
        .onChange(function () {
          cubeTips.visible = visibilityControl.cubeTips;
        });
    }
    scene.add(mesh);
  });
};


// test
const createTestObj = () => {

const geometry = new THREE.IcosahedronGeometry( 1, 15 );
const color = new THREE.Color();
  color.setHSL( Math.random(), 0.7, Math.random() * 0.2 + 0.05 );

  const material = new THREE.MeshBasicMaterial( { color: color } );
const sphere = new THREE.Mesh( geometry, material );
sphere.position.x = Math.random() * 10 - 5;
sphere.position.y = Math.random() * 10 - 5;
sphere.position.z = Math.random() * 10 - 5;
sphere.position.normalize().multiplyScalar( Math.random() * 4.0 + 2.0 );
sphere.scale.setScalar( Math.random() * Math.random() + 0.5 );

return sphere
}

const assignSRGB = ( texture ) => {

texture.colorSpace = THREE.SRGBColorSpace;

};

function generateLabelMaterial( text ) {

const canvas = document.createElement( 'canvas' );
const ctx = canvas.getContext( '2d' );
canvas.width = 128;
canvas.height = 32;

ctx.fillStyle = 'rgba( 0, 0, 0, 0.95 )';
ctx.fillRect( 0, 0, 128, 32 );

ctx.fillStyle = 'white';
ctx.font = 'bold 12pt arial';
ctx.fillText( text, 10, 22 );

const map = new THREE.CanvasTexture( canvas );
map.colorSpace = THREE.SRGBColorSpace;

const material = new THREE.MeshBasicMaterial( { map: map, transparent: true } );

return material;

}

const textureLoader = new THREE.TextureLoader()
const createTest2 = () => {
  // https://github.com/mrdoob/three.js/blob/master/examples/webgl_materials_blending_custom.html
  const map4 = textureLoader.load( 'imgs/lensflare0_alpha.png', assignSRGB );
  // const blending = { name: 'SrcColor', constant: THREE.SrcColorFactor }
  const blendSrc = { name: 'DstAlpha', constant: THREE.DstAlphaFactor }
  const blendDst = { name: 'DstColor', constant: THREE.DstColorFactor }

const material = new THREE.MeshBasicMaterial( { map: map4 } );
material.transparent = true;
material.blending = THREE.CustomBlending;
material.blendSrc = blendSrc.constant;
material.blendDst = blendDst.constant;
material.blendEquation = THREE.AddEquation;


const geo1 = new THREE.PlaneGeometry( 100, 100 );
let mesh1 = new THREE.Mesh( geo1, material );
mesh1.position.set( 0,0,0 );
scene.add( mesh1 );

const geo2 = new THREE.PlaneGeometry( 100, 25 );
let mesh = new THREE.Mesh( geo2, generateLabelMaterial( blendSrc.name ) );
mesh.position.set( mesh1.position.x, mesh1.position.y - 75, mesh1.position.z );
scene.add( mesh );
}

let sliceX, sliceY, sliceZ;
const loadNRRDModel = () => {
  const loader = new NRRDLoader();
  loader.load("test2.nrrd", function (volume) {
    //z plane
    sliceZ = volume.extractSlice("z", Math.floor(volume.RASDimensions[2] / 4));
    // scene.add(sliceZ.mesh);

    //y plane
    sliceY = volume.extractSlice("y", Math.floor(volume.RASDimensions[1] / 2));
    // scene.add(sliceY.mesh);

    //x plane
    sliceX = volume.extractSlice("x", Math.floor(volume.RASDimensions[0] / 2));
    // scene.add(sliceX.mesh);

    // controls.addEventListener("change", () => {
    //     infoMessage.value = `${camera.zoom}`
    //     console.log(camera.view);
    // })

    let max;
    if (props.direction === "x") {
      max = volume.RASDimensions[0];
      scene.add(sliceX.mesh);
    } else if (props.direction === "y") {
      max = volume.RASDimensions[1];
      scene.add(sliceY.mesh);
    } else if (props.direction === "z") {
      max = volume.RASDimensions[2];
      scene.add(sliceZ.mesh);
      scene.add(createTestObj())
      createTest2();
      // sliceZ.volume.data
      infoMessage.value = `RAS:${sliceZ.volume.RASDimensions[0]} x ${sliceZ.volume.RASDimensions[1]} x ${sliceZ.volume.RASDimensions[2]}`;
    }
    emits("update:max", max);

    if (props.direction === "main") {
      controls.enableDamping = false;
      controls.enableRotate = true;
      controls.enablePan = true;
      controls.enableZoom = true;

      scene.add(sliceX.mesh);
      scene.add(sliceY.mesh);
      scene.add(sliceZ.mesh);

      let timer;
      controls.addEventListener("change", () => {
        scale.value = ((props.max - camera.position.length()) / 256).toFixed(2);
        timer && clearTimeout(timer);
        timer = setTimeout(() => {
          emits("update:value", camera.position.clone());
        }, 500);
      });

      gui
        .add(sliceX, "index", 0, volume.RASDimensions[0], 1)
        .name("A")
        .onChange(function () {
          sliceX.repaint.call(sliceX);
        });
      gui
        .add(sliceY, "index", 0, volume.RASDimensions[1], 1)
        .name("S")
        .onChange(function () {
          sliceY.repaint.call(sliceY);
        });
      gui
        .add(sliceZ, "index", 0, volume.RASDimensions[2], 1)
        .name("R")
        .onChange(function () {
          sliceZ.repaint.call(sliceZ);
        });

      gui
        .add(volume, "lowerThreshold", volume.min, volume.max, 1)
        .name("低阈值")
        .onChange(function () {
          volume.repaintAllSlices();
        });
      gui
        .add(volume, "upperThreshold", volume.min, volume.max, 1)
        .name("高阈值")
        .onChange(() => {
          volume.repaintAllSlices();
        });
      gui
        .add(volume, "windowLow", volume.min, volume.max, 1)
        .name("低窗")
        .onChange(() => {
          volume.repaintAllSlices();
        });
      gui
        .add(volume, "windowHigh", volume.min, volume.max, 1)
        .name("高窗")
        .onChange(() => {
          volume.repaintAllSlices();
        });
      const box = createModelCube(volume);
      createBoxCenterText(volume, box);
    }
  });
};

const createModelCube = (volume) => {
  const geometry = new THREE.BoxGeometry(
    volume.xLength,
    volume.yLength,
    volume.zLength
  );

  const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
  const cube = new THREE.Mesh(geometry, material);
  cube.visible = false;

  const box = new THREE.Box3().setFromObject(cube);
  const x = box.max.x - box.min.x;
  const y = box.max.y - box.min.y;
  const z = box.max.z - box.min.z;
  const maxDim = Math.max(x, y, z);
  const scale = 100;
  cube.scale.set(scale, scale, scale);
  scene.add(cube);

  const boxHelper = new THREE.BoxHelper(cube);
  boxHelper.applyMatrix4(volume.matrix);
  scene.add(boxHelper);
  return boxHelper;
};

const createBoxCenterText = (volume, box) => {
  const R = createText("R");
  console.log("volume.xLength", volume.xLength, box.position);
  R.position.set(0, 0, volume.zLength / 2 + 30);
  const L = createText("L");
  L.position.set(0, 0, -volume.zLength / 2 - 30);
  L.rotateY(Math.PI);
  const A = createText("A");
  A.position.set(volume.xLength / 2, 0, 0);
  A.rotateY(Math.PI / 2);
  const P = createText("P");
  P.position.set(-volume.xLength / 2, 0, 0);
  P.rotateY(-Math.PI / 2);
  const S = createText("S");
  S.position.set(0, volume.yLength / 2, 0);
  S.rotateX(-Math.PI / 2);
  const I = createText("I");
  cubeTips = new THREE.Group();
  I.position.set(0, -volume.yLength / 2, 0);
  I.rotateX(-Math.PI / 2);
  cubeTips.add(R);
  cubeTips.add(L);
  cubeTips.add(A);
  cubeTips.add(P);
  cubeTips.add(S);
  cubeTips.add(I);

  scene.add(cubeTips);
};

const createText = (text) => {
  const shapes = font.generateShapes(text, 20);
  const geometry = new THREE.ShapeGeometry(shapes);
  geometry.computeBoundingBox();
  const textMaterial = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, textMaterial);
  return mesh;
};

const epsilon = (value) => {
  return Math.abs(value) < 1e-10 ? 0 : value;
};
const getCameraCSSMatrix = (matrix) => {
  const { elements } = matrix;
  return `matrix3d(
    ${epsilon(elements[0])},
    ${epsilon(-elements[1])},
    ${epsilon(elements[2])},
    ${epsilon(elements[3])},
    ${epsilon(elements[4])},
    ${epsilon(-elements[5])},
    ${epsilon(elements[6])},
    ${epsilon(elements[7])},
    ${epsilon(elements[8])},
    ${epsilon(-elements[9])},
    ${epsilon(elements[10])},
    ${epsilon(elements[11])},
    ${epsilon(elements[12])},
    ${epsilon(-elements[13])},
    ${epsilon(elements[14])},
    ${epsilon(elements[15])})`;
};
const onResize = () => {
  console.log("onResize");
  camera.aspect = props.width / props.height;
  camera.updateProjectionMatrix();
  renderer.setSize(props.width, props.height);
};
const onCubeClick = (orientation) => {
  if (!cubeController.value) {
    return;
  }

  const { offsetFactor } = ViewCubeController.ORIENTATIONS[orientation];
  updateNav(offsetFactor);
};

//#region  Update
const addStats = () => {
  stats = new Stats();
  stats.domElement.style.position = "absolute";
  stats.domElement.style.inset = "unset";
  stats.domElement.style.left = "20px";
  stats.domElement.style.top = "60px";
  stats.domElement.style.display = props.status ? "block" : "none";
  threeScene.value.appendChild(stats.domElement);
};
const render = () => {
  if (!cube) {
    cube = document.querySelector(".cube");
  }
  if (navCube.value && camera) {
    mat.extractRotation(camera.matrixWorldInverse);
    const matrix = getCameraCSSMatrix(mat);
    navCube.value.style.transform = `translateZ(-300px) ${matrix}`;
  }
  if (cubeController.value) {
    cubeController.value.tweenCallback();
  }
  if (stats) {
    stats.update();
  }

  renderer.render(scene, camera);
};
const animate = () => {
  requestAnimationFrame(animate);
  controls.update();
  render();
};
//#endregion

//#region  Function

const loadFont = () => {
  const loader = new FontLoader();
  loader.load("fonts/optimer_bold.typeface.json", function (response) {
    font = response;
  });
};
//#endregion

//#region event
const onMousedown = (e) => {
  if (e.button === 2) {
    showRight.value = true;
    rightPosition.value.x = e.layerX;
    rightPosition.value.y = e.layerY;
  } else {
    showRight.value = false;
  }
  e.preventDefault();
};
const onSave = () => {
  // 创建一个超链接元素，用来下载保存数据的文件
  const link = document.createElement("a");
  // 通过超链接herf属性，设置要保存到文件中的数据
  const canvas = renderer.domElement; //获取canvas对象
  link.href = canvas.toDataURL("image/png");
  link.download = `${props.direction}.png`; //下载文件名
  link.click(); //js代码触发超链接元素a的鼠标点击事件，开始下载文件到本地
  showRight.value = false;
};
const onReset = () => {
  if (defaultValue.hasOwnProperty("x")) {
    defaultValue.value = {
      x: defaultValue.x,
      y: defaultValue.y,
      z: defaultValue.z,
    };
  }
  emits("update:value", defaultValue);
  updateCameraPosition();
  showRight.value = false;
};

const onInfo = () => {
  emits("update:infoVisible", !props.infoVisible);
  showRight.value = false;
};

//#endregion event

//#endregion Function
</script>

<style scoped lang="less">
.three-scene {
  border: 1px solid var(--y-color-canvas-border);
  position: relative;
  user-select: none;
  background-color: var(--y-color-canvas-bg);
}

:deep(.lil-gui.autoPlace) {
  position: absolute;
  right: 0px;
  top: 30px;
  width: 35%;
}

.info {
  position: absolute;
  bottom: 20px;
  left: 20px;
  color: var(--y-color-canvas-text);
}

#viewcube-container {
  width: 120px;
  height: 120px;
  margin: 10px;
  perspective: 600px;
  position: absolute;
  right: 20px;
  bottom: 10px;
  z-index: 2;
}

.cube {
  width: 100px;
  height: 100px;
  position: relative;
  transform-style: preserve-3d;
  transform: translateZ(-300px);
  text-transform: uppercase;
}

.cube__face {
  display: flex;
  justify-content: center;
  align-items: center;
  position: absolute;
  width: 120px;
  height: 120px;
  border: 2px solid var(--y-color-border);
  line-height: 100px;
  font-size: 25px;
  font-weight: var(--y-font-weight-bold);
  color: var(--y-color-text-secondary);
  text-align: center;
  background: var(--y-color-bg-card);
  transition: all 0.1s;
  cursor: pointer;
  user-select: none;
}

.cube__face:hover {
  background: var(--y-color-bg-hover);
  color: var(--y-color-text-primary);
}

.cube__face--top {
  transform: rotateY(0deg) rotateX(90deg) translateZ(-60px);
}

.cube__face--bottom {
  transform: rotateX(270deg) translateZ(-60px);
}

.cube__face--left {
  transform: rotateY(-90deg) rotateX(180deg) rotateZ(0deg) translateZ(-60px);
}

.cube__face--right {
  transform: rotateY(90deg) rotateX(180deg) rotateZ(0deg) translateZ(-60px);
}

.cube__face--front {
  transform: rotateX(180deg) translateZ(-60px);
}

.cube__face--back {
  transform: rotateZ(180deg) translateZ(-60px);
}
</style>
