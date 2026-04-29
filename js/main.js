import * as THREE from './three.module.js';
import { GLTFLoader } from './GLTFLoader.js';
import { OrbitControls } from './OrbitControls.js';

let scene, camera, renderer, controls;
let loadedModels = []; // 存储所有加载的模型
let selectedModel = null; // 当前右键选中的模型
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// UI 元素引用
const modelInfoElement = document.getElementById('model-info');
const modelNameElement = document.getElementById('model-name');
const contextMenu = document.getElementById('context-menu');
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

    // 光源：多方向平行光和环境光，确保各个角度都有细节
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // 增强环境光作为基础亮度
    scene.add(ambientLight);

    // 主平行光 (Key Light)
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.0); // 增强主平行光强度
    keyLight.position.set(5, 5, 5).normalize();
    scene.add(keyLight);

    // 辅助平行光 (Fill Light)
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-5, -5, -5).normalize();
    scene.add(fillLight);

    // 背光 (Back Light) - 增加轮廓感
    const backLight = new THREE.DirectionalLight(0xffffff, 0.2);
    backLight.position.set(0, 5, -5).normalize();
    scene.add(backLight);

    // 加载 GLB 模型
    const modelsToLoad = ['radius.glb', 'ulna.glb'];
    let modelsLoadedCount = 0;

    modelsToLoad.forEach(modelName => {
        const loader = new GLTFLoader();
        loader.load(
            modelName,
            function (gltf) {
                const model = gltf.scene;
                loadedModels.push(model);
                scene.add(model);

                // 更新模型名称标签 (显示所有模型名称)
                modelNameElement.textContent = loadedModels.map(m => m.name || m.uuid).join(', ');

                // 将模型颜色设为黄色并准备材质属性
                model.traverse((child) => {
                    if (child.isMesh) {
                        if (!(child.material instanceof THREE.MeshStandardMaterial)) {
                            child.material = new THREE.MeshStandardMaterial();
                        }
                        child.material.color.set(0xffff00); // 设置初始颜色为黄色
                        child.material.transparent = true; // 启用透明度
                        child.material.opacity = 1; // 初始不透明
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
        if (loadedModels.length === 0) return;

        // 计算所有模型的包围盒
        const bbox = new THREE.Box3();
        loadedModels.forEach(model => bbox.union(new THREE.Box3().setFromObject(model)));

        const center = bbox.getCenter(new THREE.Vector3());
        const size = bbox.getSize(new THREE.Vector3());

        // 将所有模型整体居中
        const offset = center.negate();
        loadedModels.forEach(model => model.position.add(offset));

        // 重新计算中心点，现在应该在原点
        bbox.setFromObject(scene); // 重新计算整个场景中模型的包围盒
        const newCenter = bbox.getCenter(new THREE.Vector3());
        const newSize = bbox.getSize(new THREE.Vector3());

        // 自动调整相机位置，使所有模型完全可见
        const maxDim = Math.max(newSize.x, newSize.y, newSize.z);
        const fov = camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
        cameraZ *= 1.5; // 增加一些距离

        camera.position.set(newCenter.x, newCenter.y + cameraZ / 3, newCenter.z + cameraZ);
        camera.lookAt(newCenter);

        controls.target.copy(newCenter);
        controls.update(); // 更新控制器以反映新的相机位置
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

    // 右键菜单事件
    document.body.addEventListener('contextmenu', (event) => {
        event.preventDefault(); // 阻止默认右键菜单

        // 计算鼠标在标准化设备坐标系 (NDC) 中的位置
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);

        // 检查射线与所有加载模型中所有子对象的交集
        const intersects = raycaster.intersectObjects(loadedModels.flatMap(model => model.children), true);

        if (intersects.length > 0) {
            // 找到第一个相交的模型
            let intersectedObject = intersects[0].object;
            // 向上遍历直到找到属于 loadedModels 数组中的根模型
            while (intersectedObject && !loadedModels.includes(intersectedObject)) {
                intersectedObject = intersectedObject.parent;
            }
            selectedModel = intersectedObject;

            if (selectedModel) {
                // 更新模型名称显示
                modelNameElement.textContent = selectedModel.name || selectedModel.uuid;

                // 根据当前选中模型的状态更新菜单UI
                transparencySlider.value = selectedModel.children[0] && selectedModel.children[0].isMesh && selectedModel.children[0].material.opacity !== undefined ? selectedModel.children[0].material.opacity : 1;
                colorPicker.value = selectedModel.children[0] && selectedModel.children[0].isMesh && selectedModel.children[0].material.color !== undefined ? `#${selectedModel.children[0].material.color.getHexString()}` : '#ffff00';
                
                contextMenu.style.left = `${event.clientX}px`;
                contextMenu.style.top = `${event.clientY}px`;
                contextMenu.style.display = 'block';
            } else {
                contextMenu.style.display = 'none';
            }
        } else {
            selectedModel = null;
            contextMenu.style.display = 'none';
        }
    });

    // 点击其他地方隐藏右键菜单
    document.body.addEventListener('click', (event) => {
        if (contextMenu.style.display === 'block' && !contextMenu.contains(event.target)) {
            contextMenu.style.display = 'none';
        }
    });

    // 菜单项功能
    toggleVisibilityButton.addEventListener('click', () => {
        if (selectedModel) {
            selectedModel.visible = !selectedModel.visible;
        }
        contextMenu.style.display = 'none';
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
    controls.update(); // 只有当 controls.enableDamping 设置为 true 时才需要
    renderer.render(scene, camera);
}

init();
animate();
