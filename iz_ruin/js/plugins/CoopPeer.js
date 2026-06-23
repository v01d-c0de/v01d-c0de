// =========================================================================
// CoopPeer.js - Кооператив через PeerJS
// =========================================================================

/*:
@target MZ
@plugindesc v3.0 Кооператив через PeerJS. Синхронизация движения, переключателей, ролей.
@author Твой Ник
*/

// Наш глобальный объект сети
window.CoopNetwork = {
    peer: null,
    connection: null,
    isHost: false,
    partnerData: { x: 0, y: 0, mapId: 0, direction: 2 },
    roomCode: null,
    myActorId: 0, // 1 для Хоста (Рид), 2 для Гостя (Мишель)
    isReceivingData: false // Флаг для предотвращения бесконечного цикла отправки
};

// =========================================================================
// 1. ДОБАВЛЕНИЕ КНОПКИ В ГЛАВНОЕ МЕНЮ
// =========================================================================

const _Window_TitleCommand_makeCommandList = Window_TitleCommand.prototype.makeCommandList;
Window_TitleCommand.prototype.makeCommandList = function() {
    _Window_TitleCommand_makeCommandList.call(this);
    this.addCommand("Кооператив", "coop", true);
};

const _Scene_Title_createCommandWindow = Scene_Title.prototype.createCommandWindow;
Scene_Title.prototype.createCommandWindow = function() {
    _Scene_Title_createCommandWindow.call(this);
    this._commandWindow.setHandler("coop", this.commandCoop.bind(this));
};

Scene_Title.prototype.commandCoop = function() {
    this._commandWindow.close();
    SceneManager.goto(Scene_Coop);
};

// =========================================================================
// 2. СОЗДАНИЕ СЦЕНЫ КООПЕРАТИВА
// =========================================================================

function Scene_Coop() {
    this.initialize(...arguments);
}
Scene_Coop.prototype = Object.create(Scene_MenuBase.prototype);
Scene_Coop.prototype.constructor = Scene_Coop;

Scene_Coop.prototype.initialize = function() {
    Scene_MenuBase.prototype.initialize.call(this);
};

Scene_Coop.prototype.create = function() {
    Scene_MenuBase.prototype.create.call(this);
    this.createBackground();
    this.createCoopWindow();
    this.createStatusWindow();
};

Scene_Coop.prototype.createCoopWindow = function() {
    const rect = new Rectangle(0, 0, 320, 180); // Увеличили высоту под новые кнопки
    rect.x = (Graphics.width - rect.width) / 2;
    rect.y = (Graphics.height - rect.height) / 2;
    this._coopWindow = new Window_Coop(rect);
    this._coopWindow.setHandler("host", this.commandHost.bind(this));
    this._coopWindow.setHandler("host_load", this.commandHostLoad.bind(this));
    this._coopWindow.setHandler("guest", this.commandGuest.bind(this));
    this._coopWindow.setHandler("guest_load", this.commandGuestLoad.bind(this));
    this._coopWindow.setHandler("cancel", this.popScene.bind(this));
    this.addWindow(this._coopWindow);
};

Scene_Coop.prototype.createStatusWindow = function() {
    const rect = new Rectangle(0, 0, 400, 120);
    rect.x = (Graphics.width - rect.width) / 2;
    rect.y = (Graphics.height / 2) + 100;
    this._statusWindow = new Window_Base(rect);
    this.addWindow(this._statusWindow);
    this.updateStatus("Выберите роль для игры.");
};

Scene_Coop.prototype.updateStatus = function(text) {
    this._statusWindow.contents.clear();
    this._statusWindow.drawText(text, 0, 0, this._statusWindow.innerWidth, "center");
};

// --- НОВАЯ ИГРА (ХОСТ) ---
Scene_Coop.prototype.commandHost = function() {
    this._coopWindow.deactivate();
    window.CoopNetwork.isHost = true;
    
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    window.CoopNetwork.roomCode = code;
    window.CoopNetwork.peer = new Peer("RPGMZ_" + code);

    this.updateStatus("Создание комнаты... Код: " + code);

    window.CoopNetwork.peer.on('open', (id) => {
        this.updateStatus("Комната создана! Код для друга: " + code + "\nЖдем подключения...");
    });

    window.CoopNetwork.peer.on('connection', (conn) => {
        window.CoopNetwork.connection = conn;
        this.setupConnection(false); // false = не загружать сохранение
    });

    window.CoopNetwork.peer.on('error', (err) => {
        console.error(err);
        if (err.type === 'unavailable-id') {
            this.updateStatus("Ошибка: Код занят. Попробуйте еще раз.");
            this._coopWindow.activate();
        }
    });
};

// --- ЗАГРУЗКА ИГРЫ (ХОСТ) ---
Scene_Coop.prototype.commandHostLoad = function() {
    this._coopWindow.deactivate();
    window.CoopNetwork.isHost = true;
    
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    window.CoopNetwork.roomCode = code;
    window.CoopNetwork.peer = new Peer("RPGMZ_" + code);

    this.updateStatus("Создание комнаты... Код: " + code);

    window.CoopNetwork.peer.on('open', (id) => {
        this.updateStatus("Комната создана! Код: " + code + "\nЖдем подключения...");
    });

    window.CoopNetwork.peer.on('connection', (conn) => {
        window.CoopNetwork.connection = conn;
        this.setupConnection(true); // true = загрузить сохранение
    });

    window.CoopNetwork.peer.on('error', (err) => {
        console.error(err);
        if (err.type === 'unavailable-id') {
            this.updateStatus("Ошибка: Код занят. Попробуйте еще раз.");
            this._coopWindow.activate();
        }
    });
};

// --- НОВАЯ ИГРА (ГОСТЬ) ---
Scene_Coop.prototype.commandGuest = function() {
    this._coopWindow.deactivate();
    window.CoopNetwork.isHost = false;

    const code = prompt("Введите код комнаты (4 цифры):");
    if (!code || code.length !== 4) {
        this.updateStatus("Неверный код. Попробуйте снова.");
        this._coopWindow.activate();
        return;
    }

    this.updateStatus("Подключение к комнате " + code + "...");
    window.CoopNetwork.peer = new Peer();

    window.CoopNetwork.peer.on('open', () => {
        window.CoopNetwork.connection = window.CoopNetwork.peer.connect("RPGMZ_" + code);
        this.setupConnection(false); // false = не загружать сохранение
    });

    window.CoopNetwork.peer.on('error', (err) => {
        console.error(err);
        if (err.type === 'peer-unavailable') {
            this.updateStatus("Комната не найдена. Проверьте код.");
            this._coopWindow.activate();
        }
    });
};

// --- ЗАГРУЗКА ИГРЫ (ГОСТЬ) ---
Scene_Coop.prototype.commandGuestLoad = function() {
    this._coopWindow.deactivate();
    window.CoopNetwork.isHost = false;

    const code = prompt("Введите код комнаты (4 цифры):");
    if (!code || code.length !== 4) {
        this.updateStatus("Неверный код. Попробуйте снова.");
        this._coopWindow.activate();
        return;
    }

    this.updateStatus("Подключение к комнате " + code + "...");
    window.CoopNetwork.peer = new Peer();

    window.CoopNetwork.peer.on('open', () => {
        window.CoopNetwork.connection = window.CoopNetwork.peer.connect("RPGMZ_" + code);
        this.setupConnection(true); // true = загрузить сохранение
    });

    window.CoopNetwork.peer.on('error', (err) => {
        console.error(err);
        if (err.type === 'peer-unavailable') {
            this.updateStatus("Комната не найдена. Проверьте код.");
            this._coopWindow.activate();
        }
    });
};

// --- НАСТРОЙКА СОЕДИНЕНИЯ ---
Scene_Coop.prototype.setupConnection = function(isLoad) {
    window.CoopNetwork.connection.on('open', () => {
        window.CoopNetwork.myActorId = window.CoopNetwork.isHost ? 1 : 2;
        this.updateStatus("Успешное подключение!");
        
        setTimeout(() => {
            if (isLoad) {
                // Открываем стандартное окно загрузки RPG Maker
                SceneManager.push(Scene_Load);
            } else {
                // Начинаем новую игру
                DataManager.setupNewGame();
                if (!window.CoopNetwork.isHost) {
                    $gameParty._actors = [2, 1]; // Гость играет за Мишель
                    $gamePlayer.refresh();
                }
                SceneManager.goto(Scene_Map);
            }
        }, 1000);
    });

    window.CoopNetwork.connection.on('data', (data) => {
        window.CoopNetwork.isReceivingData = true; 
        
        if (data.type === 'position') {
            window.CoopNetwork.partnerData = data.payload;
        } 
        else if (data.type === 'self_switch') {
            const p = data.payload;
            const key = [p.mapId, p.eventId, p.switchName];
            $gameSelfSwitches.setValue(key, p.value);
            if ($gameMap.mapId() === p.mapId) {
                $gameMap.refresh(); 
            }
        }
        
        window.CoopNetwork.isReceivingData = false; 
    });

    window.CoopNetwork.connection.on('close', () => {
        console.log("Игрок отключился");
        window.CoopNetwork.connection = null;
    });
};

function Window_Coop() {
    this.initialize(...arguments);
}
Window_Coop.prototype = Object.create(Window_Command.prototype);
Window_Coop.prototype.constructor = Window_Coop;

Window_Coop.prototype.initialize = function(rect) {
    Window_Command.prototype.initialize.call(this, rect);
};

Window_Coop.prototype.makeCommandList = function() {
    this.addCommand("Новая игра (Хост)", "host");
    this.addCommand("Загрузить игру (Хост)", "host_load");
    this.addCommand("Новая игра (Гость)", "guest");
    this.addCommand("Загрузить игру (Гость)", "guest_load");
    this.addCommand("Назад", "cancel");
};


// =========================================================================
// 3. СИНХРОНИЗАЦИЯ ИГРОКОВ НА КАРТЕ (Призрак)
// =========================================================================

const _Game_Player_update = Game_Player.prototype.update;
Game_Player.prototype.update = function(sceneActive) {
    _Game_Player_update.call(this, sceneActive);
    
    if (window.CoopNetwork.connection && window.CoopNetwork.connection.open) {
        // Отправляем данные ТОЛЬКО когда двигаемся или жмем кнопки
        if (this.isMoving() || Input.dir4 > 0) {
            const myData = {
                type: 'position',
                payload: {
                    x: this.x,
                    y: this.y,
                    mapId: $gameMap.mapId(),
                    direction: this.direction()
                }
            };
            window.CoopNetwork.connection.send(myData);
        }
    }
};

const _Spriteset_Map_createLowerLayer = Spriteset_Map.prototype.createLowerLayer;
Spriteset_Map.prototype.createLowerLayer = function() {
    _Spriteset_Map_createLowerLayer.call(this);
    this.createCoopGhost();
};

Spriteset_Map.prototype.createCoopGhost = function() {
    this._coopGhostChar = new Game_Character();
    
    // Настраиваем внешность призрака в зависимости от того, кто наш партнер
    // Хост видит Мишель (2), Гость видит Рида (1)
    const partnerActorId = window.CoopNetwork.isHost ? 2 : 1;
    const actor = $gameActors.actor(partnerActorId);
    if (actor) {
        this._coopGhostChar.setImage(actor.characterName(), actor.characterIndex());
    } else {
        this._coopGhostChar.setImage("Actor1", 0); // Запасной вариант
    }
    this._coopGhostChar.setDirection(2);
    
    this._coopGhost = new Sprite_Character(this._coopGhostChar);
    this._tilemap.addChild(this._coopGhost);
};

const _Spriteset_Map_update = Spriteset_Map.prototype.update;
Spriteset_Map.prototype.update = function() {
    _Spriteset_Map_update.call(this);
    if (this._coopGhostChar) {
        const data = window.CoopNetwork.partnerData;
        if (data.mapId === $gameMap.mapId()) {
            this._coopGhost.opacity = 255;
            
            // ВАЖНО: Обновляем логику персонажа, чтобы он мог двигаться
            this._coopGhostChar.update();
            
            // Вычисляем дистанцию между призраком и его реальной позицией
            const dist = Math.abs(this._coopGhostChar.x - data.x) + Math.abs(this._coopGhostChar.y - data.y);
            
            if (dist > 1) {
                // Если игрок телепортировался или мы сильно отстали, прыгаем к нему
                this._coopGhostChar.locate(data.x, data.y);
                this._coopGhostChar.setDirection(data.direction);
            } else if (dist > 0 && !this._coopGhostChar.isMoving()) {
                // Если расстояние 1 клетка и мы не двигаемся — делаем шаг к цели
                const dir = this._coopGhostChar.findDirectionTo(data.x, data.y);
                if (dir > 0) {
                    this._coopGhostChar.moveStraight(dir);
                }
            } else if (dist === 0 && !this._coopGhostChar.isMoving()) {
                // Если стоим на месте, синхронизируем направление взгляда
                this._coopGhostChar.setDirection(data.direction);
            }
        } else {
            this._coopGhost.opacity = 0; // Скрываем, если на разных картах
        }
    }
};

// =========================================================================
// 4. СИНХРОНИЗАЦИЯ ЛОКАЛЬНЫХ ПЕРЕКЛЮЧАТЕЛЕЙ (Self-Switches)
// =========================================================================

const _Game_SelfSwitches_setValue = Game_SelfSwitches.prototype.setValue;
Game_SelfSwitches.prototype.setValue = function(key, value) {
    // Сначала применяем у себя
    _Game_SelfSwitches_setValue.call(this, key, value); 

    // Отправляем по сети ТОЛЬКО если соединение активно и МЫ не просто получили эти данные
    if (window.CoopNetwork.connection && window.CoopNetwork.connection.open && !window.CoopNetwork.isReceivingData) {
        const data = {
            type: 'self_switch',
            payload: {
                mapId: key[0],
                eventId: key[1],
                switchName: key[2], // Обычно 'A', 'B', 'C' или 'D'
                value: value
            }
        };
        window.CoopNetwork.connection.send(data);
    }
};
