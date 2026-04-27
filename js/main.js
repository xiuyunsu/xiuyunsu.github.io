import * as THREE from './three.module.js';
import { GLTFLoader } from './GLTFLoader.js';
import { OrbitControls } from './OrbitControls.js';

let scene, camera, renderer, controls;

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

    // 光源
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // 环境光 0.5
    scene.add(ambientLight);

    // 弱平行光 0.8，斜上方照射
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(-1, 1, 1).normalize(); // 斜上方位置，并标准化向量
    scene.add(directionalLight);

    // 辅助平行光，从另一个方向照射，强度较低
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.4); // 辅助光强度 0.4
    fillLight.position.set(1, -1, -1).normalize(); // 从右下方照射
    scene.add(fillLight);

    // 加载 GLB 模型
    const loader = new GLTFLoader();
    loader.load(
        'femur.glb', // 假设 femur.glb 在与 index.html 同一目录下
        function (gltf) {
            scene.add(gltf.scene);
            // 将模型颜色设为黄色
            gltf.scene.traverse((child) => {
                if (child.isMesh) {
                    child.material = new THREE.MeshStandardMaterial({ color: 0xffff00 }); // 黄色
                }
            });
            // 调整模型位置和大小以适应场景
            const box = new THREE.Box3().setFromObject(gltf.scene);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());

            // 将模型中心移到原点
            gltf.scene.position.x += (gltf.scene.position.x - center.x);
            gltf.scene.position.y += (gltf.scene.position.y - center.y);
            gltf.scene.position.z += (gltf.scene.position.z - center.z);

            // 自动调整相机位置，使模型完全可见
            const maxDim = Math.max(size.x, size.y, size.z);
            const fov = camera.fov * (Math.PI / 180);
            let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
            cameraZ *= 1.5; // 增加一些距离
            camera.position.z = cameraZ;
            camera.position.y = cameraZ / 3; // 稍微抬高相机，提供更好的视角
            camera.lookAt(new THREE.Vector3(0, 0, 0));

            controls.update(); // 更新控制器以反映新的相机位置
        },
        undefined,
        function (error) {
            console.error('加载 GLB 模型时发生错误:', error);
            alert('无法加载 3D 模型。请确保 femur.glb 文件在同一目录下且未损坏。');
        }
    );

    // 轨道控制器 (OrbitControls)
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; // 启用阻尼（惯性），使动画更流畅
    controls.dampingFactor = 0.25;
    controls.screenSpacePanning = true; // 允许在屏幕空间平移
    controls.minDistance = 1;
    controls.maxDistance = 500;

    // 窗口大小调整
    window.addEventListener('resize', onWindowResize, false);
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
