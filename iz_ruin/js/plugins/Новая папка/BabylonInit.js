//=============================================================================
// BabylonInit.js
//=============================================================================

/*:
 * @target MZ
 * @plugindesc Инициализация Babylon.js для 3D объектов на карте.
 * @author Ваше Имя
 *
 * @help
 * Этот плагин создает прозрачный canvas Babylon.js поверх игры.
 */

var Babylonia = Babylonia || {};

(function() {

    // 1. Создаем canvas для Babylon
    const createBabylonCanvas = function() {
        const canvas = document.createElement('canvas');
        canvas.id = 'babylonCanvas';
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100%';  // ОБЯЗАТЕЛЬНО: растягиваем на весь экран
        canvas.style.height = '100%'; // ОБЯЗАТЕЛЬНО: растягиваем на весь экран
        canvas.style.zIndex = '10';
        canvas.style.pointerEvents = 'none';
        document.body.appendChild(canvas);
        
        // Внутреннее разрешение холста
        canvas.width = Graphics.width;
        canvas.height = Graphics.height;
        return canvas;
    };

    // 2. Инициализация движка и сцены
    Babylonia.init = function() {
        if (this.engine) return;
        
        console.log("Babylon.js инициализируется...");
        
        this.canvas = createBabylonCanvas();
        this.engine = new BABYLON.Engine(this.canvas, true, { preserveDrawingBuffer: true, stencil: true, alpha: true });
        this.scene = new BABYLON.Scene(this.engine);
        
        this.scene.clearColor = new BABYLON.Color4(0, 0, 0, 0); 

        // Центр экрана RMMZ
        const centerX = Graphics.width / 2;
        const centerY = Graphics.height / 2;

        // Камера: радиус 400 (было 800 - поэтому был микроскопический)
        this.camera = new BABYLON.ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 3.5, 400, new BABYLON.Vector3(centerX, 0, centerY), this.scene);
        this.camera.fov = 0.8;
        
        // Свет
        const light1 = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(0, 1, 0), this.scene);
        light1.intensity = 1.0;

        // Тестовый ящик ставим ровно в центр
        const box = BABYLON.MeshBuilder.CreateBox("box", {height: 48, width: 48, depth: 48}, this.scene);
        box.position.x = centerX;
        box.position.z = centerY;
        box.position.y = 24; 

        // 3. Цикл рендера
        this.engine.runRenderLoop(() => {
            this.syncCameraWithRMMZ();
            this.scene.render();
        });

        // 4. Изменение размера окна
        window.addEventListener('resize', () => {
            this.engine.resize();
        });
    };

    // 5. Синхронизация 3D камеры со скроллом 2D карты
    Babylonia.syncCameraWithRMMZ = function() {
        if (!$gameMap) return;

        const displayX = $gameMap.displayX() * $gameMap.tileWidth();
        const displayY = $gameMap.displayY() * $gameMap.tileHeight();

        const targetX = displayX + Graphics.width / 2;
        const targetZ = displayY + Graphics.height / 2;

        this.camera.target = new BABYLON.Vector3(targetX, 0, targetZ);
    };

    // Перехватываем запуск игры
    const _SceneManager_run = SceneManager.run;
    SceneManager.run = function(sceneClass) {
        _SceneManager_run.call(this, sceneClass);
        Babylonia.init();
    };

})();