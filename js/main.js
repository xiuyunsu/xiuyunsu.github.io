import * as THREE from './three.module.js';
import { GLTFLoader } from './GLTFLoader.js';
import { OrbitControls } from './OrbitControls.js';

let scene, camera, renderer, controls, directionalLight;
let loadedModels = []; // 存储所有加载的模型
let selectedModel = null; // 当前选中的模型

// UI 元素引用
const modelListContainer = document.getElementById('model-list-container');
const modelList = document.getElementById('model-list');
const modelControlsPanel = document.getElementById('model-controls-panel');
const selectedModelNameElement = document.getElementById('selected-model-name');
const toggleVisibilityButton = document.getElementById('toggle-visibility');
const transparencySlider = document.getElementById('transparency-slider');
const colorPicker = document.getElementById('color-picker');

function init() {
    // 场景
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff); // 设置背景颜色为纯白色

    // 摄像头
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 5);

    // 渲染器
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // 光源：相机跟随式平行光、环境光和半球光，便于观察细节和质感
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // 基础环境光
    scene.add(ambientLight);

    // 半球光，提供柔和的整体光照，上方为天空色，下方为地面色
    const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x000000, 0.8); // 天空白，地面黑，强度0.8
    scene.add(hemisphereLight);

    directionalLight = new THREE.DirectionalLight(0xffffff, 1.0); // 相机跟随式平行光
    scene.add(directionalLight); // 添加到场景中
    directionalLight.target.position.set(0, 0, 0); // 初始目标看向原点

    // 加载 GLB 模型
    const modelsToLoad = ['radius.glb', 'ulna.glb'];
    let modelsLoadedCount = 0;

    modelsToLoad.forEach(modelName => {
        const loader = new GLTFLoader();
        loader.load(
            modelName,
            function (gltf) {
                const model = gltf.scene;
                // 赋予模型一个名称，如果GLB中没有则使用文件名
                model.name = modelName.replace('.glb', '');
                loadedModels.push(model);
                scene.add(model);

                // 创建模型列表项
                const listItem = document.createElement('li');
                listItem.textContent = model.name;
                listItem.style.padding = '5px 8px';
                listItem.style.cursor = 'pointer';
                listItem.style.borderBottom = '1px solid #eee';
                listItem.style.whiteSpace = 'nowrap';
                listItem.style.overflow = 'hidden';
                listItem.style.textOverflow = 'ellipsis';
                listItem.style.backgroundColor = 'transparent';
                listItem.onmouseover = function() { this.style.backgroundColor = '#e0e0e0'; };
                listItem.onmouseout = function() { if (selectedModel !== model) this.style.backgroundColor = 'transparent'; };
                listItem.onclick = () => {
                    // 清除之前选中项的样式
                    Array.from(modelList.children).forEach(child => child.style.backgroundColor = 'transparent');
                    // 设置当前选中项的样式
                    listItem.style.backgroundColor = '#cceeff';

                    selectedModel = model;
                    selectedModelNameElement.textContent = model.name;
                    modelControlsPanel.style.display = 'block';

                    // 更新控制面板UI以反映选中模型的状态
                    if (selectedModel && selectedModel.children[0] && selectedModel.children[0].isMesh && selectedModel.children[0].material) {
                        transparencySlider.value = selectedModel.children[0].material.opacity !== undefined ? selectedModel.children[0].material.opacity : 1;
                        colorPicker.value = selectedModel.children[0].material.color !== undefined ? `#${selectedModel.children[0].material.color.getHexString()}` : '#ffff00';
                    } else {
                        // 如果模型没有可控制的材质，则禁用或重置UI
                        transparencySlider.value = 1;
                        colorPicker.value = '#ffff00';
                    }
                };
                modelList.appendChild(listItem);

                // 将模型颜色设为黄色并准备材质属性
                model.traverse((child) => {
                    if (child.isMesh) {
                        if (!(child.material instanceof THREE.MeshStandardMaterial)) {
                            child.material = new THREE.MeshStandardMaterial();
                        }
                        child.material.color.set(0xffff00); // 设置初始颜色为黄色
                        child.material.transparent = true; // 启用透明度
                        child.material.opacity = 1; // 初始不透明
                        child.material.roughness = 0.4; // 调整粗糙度，让表面有点光泽
                        child.material.metalness = 0.1; // 调整金属度，非金属质感
                    }
                });

                modelsLoadedCount++;
                if (modelsLoadedCount === modelsToLoad.length) {
                    // 所有模型加载完毕后调整相机和控制器
                    adjustCameraAndControls();
                }
            },
            undefined,
            function (error) {
                console.error(`加载 GLB 模型 ${modelName} 时发生错误:`, error);
                alert(`无法加载 3D 模型 ${modelName}。请确保文件在同一目录下且未损坏。`);
            }
        );
    });

    function adjustCameraAndControls() {
        if (loadedModels.length === 0) {
            console.warn("没有模型加载，无法调整相机和控制器。");
            return;
        }

        // 计算所有模型在原始坐标下的包围盒
        const bbox = new THREE.Box3();
        loadedModels.forEach(model => bbox.union(new THREE.Box3().setFromObject(model)));

        const center = bbox.getCenter(new THREE.Vector3());
        const size = bbox.getSize(new THREE.Vector3());

        console.log("Combined BBox:", bbox);
        console.log("Center of all models:", center);
        console.log("Size of all models:", size);

        // 自动调整相机位置，使所有模型完全可见
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = camera.fov * (Math.PI / 180);
        let cameraDistance = Math.abs(maxDim / 2 / Math.tan(fov / 2));
        cameraDistance *= 1.5; // 增加一些距离

        // 设置相机位置，看向所有模型的中心
        camera.position.set(center.x, center.y + cameraDistance / 3, center.z + cameraDistance);
        camera.lookAt(center);

        controls.target.copy(center); // 控制器目标也指向模型中心
        controls.update(); // 更新控制器以反映新的相机位置和目标

        console.log("Final Camera Position:", camera.position);
        console.log("Final Controls Target:", controls.target);
    }

    // 轨道控制器 (OrbitControls)
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; // 启用阻尼（惯性），使动画更流畅
    controls.dampingFactor = 0.25;
    controls.screenSpacePanning = true; // 允许在屏幕空间平移
    controls.minDistance = 1;
    controls.maxDistance = 500;

    // 窗口大小调整
    window.addEventListener('resize', onWindowResize, false);

    // 点击其他地方隐藏控制面板
    document.body.addEventListener('click', (event) => {
        if (modelControlsPanel.style.display === 'block' &&
            !modelControlsPanel.contains(event.target) &&
            !modelListContainer.contains(event.target)) {
            modelControlsPanel.style.display = 'none';
            // 清除模型列表中的选中样式
            Array.from(modelList.children).forEach(child => child.style.backgroundColor = 'transparent');
            selectedModel = null;
            selectedModelNameElement.textContent = '无';
        }
    });

    // 菜单项功能
    toggleVisibilityButton.addEventListener('click', () => {
        if (selectedModel) {
            selectedModel.visible = !selectedModel.visible;
        }
    });

    transparencySlider.addEventListener('input', (event) => {
        if (selectedModel) {
            const opacity = parseFloat(event.target.value);
            selectedModel.traverse((child) => {
                if (child.isMesh && child.material) {
                    child.material.opacity = opacity;
                    child.material.transparent = opacity < 1; // 当不透明度小于1时启用透明
                }
            });
        }
    });

    colorPicker.addEventListener('input', (event) => {
        if (selectedModel) {
            const newColor = new THREE.Color(event.target.value);
            selectedModel.traverse((child) => {
                if (child.isMesh && child.material) {
                    child.material.color.copy(newColor);
                }
            });
        }
    });
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);

    // 更新平行光位置和目标，使其始终从相机前方照射
    directionalLight.position.copy(camera.position); // 光源位置与相机位置相同
    const target = new THREE.Vector3();
    camera.getWorldDirection(target); // 获取相机前方方向向量
    target.multiplyScalar(100); // 延长方向向量，确保目标在模型之外
    directionalLight.target.position.copy(camera.position).add(target);
    directionalLight.target.updateMatrixWorld(); // 更新目标的世界矩阵
    controls.update(); // 只有当 controls.enableDamping 设置为 true 时才需要
    renderer.render(scene, camera);
}

init();
animate();
