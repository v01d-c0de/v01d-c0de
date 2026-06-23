// =========================================================================
// CoopPeer.js - Кооператив через PeerJS
// =========================================================================

/*:
@target MZ
@plugindesc v6.0 Кооператив. Стабильная синхронизация свитчей, переменных, карт.
@author Твой Ник
*/

window.CoopNetwork = {
    peer: null,
    connection: null,
    isHost: false,
    partnerData: { x: 0, y: 0, mapId: 0, direction: 2 },
    roomCode: null,
    myActorId: 0,
    isReceivingData: false,
    guestState: null,
    pendingSync: null // Данные, ждущие применения на карте
};

// =========================================================================
// 1. КНОПКА В ГЛАВНОМ МЕНЮ
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
// 2. СЦЕНА КООПЕРАТИВА
// =========================================================================
function Scene_Coop() { this.initialize(...arguments); }
Scene_Coop.prototype = Object.create(Scene_MenuBase.prototype);
Scene_Coop.prototype.constructor = Scene_Coop;

Scene_Coop.prototype.initialize = function() { Scene_MenuBase.prototype.initialize.call(this); };
Scene_Coop.prototype.create = function() {
    Scene_MenuBase.prototype.create.call(this);
    this.createBackground();
    this.createCoopWindow();
    this.createStatusWindow();
};

Scene_Coop.prototype.createCoopWindow = function() {
    const rect = new Rectangle(0, 0, 320, 180);
    rect.x = (Graphics.width - rect.width) / 2;
    rect.y = (Graphics.height - rect.height) / 2;
    this._coopWindow = new Window_Coop(rect);
    this._coopWindow.setHandler("host", this.commandHost.bind(this));
    this._coopWindow.setHandler("host_load", this.commandHostLoad.bind(this));
    this._coopWindow.setHandler("guest", this.commandGuest.bind(this));
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

// --- ХОСТ (НОВАЯ) ---
Scene_Coop.prototype.commandHost = function() {
    this._coopWindow.deactivate();
    window.CoopNetwork.isHost = true;
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    window.CoopNetwork.roomCode = code;
    // ДОБАВИЛИ { secure: true }
    window.CoopNetwork.peer = new Peer("RPGMZ_" + code, { secure: true }); 
    
    this.updateStatus("Создание комнаты... Код: " + code);
    window.CoopNetwork.peer.on('open', (id) => this.updateStatus("Комната создана! Код: " + code + "\nЖдем подключения..."));
    window.CoopNetwork.peer.on('connection', (conn) => {
        window.CoopNetwork.connection = conn;
        this.setupConnection(false);
    });
    window.CoopNetwork.peer.on('error', (err) => {
        if (err.type === 'unavailable-id') { this.updateStatus("Ошибка: Код занят."); this._coopWindow.activate(); }
    });
};

// --- ХОСТ (ЗАГРУЗКА) ---
Scene_Coop.prototype.commandHostLoad = function() {
    this._coopWindow.deactivate();
    window.CoopNetwork.isHost = true;
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    window.CoopNetwork.roomCode = code;
    // ДОБАВИЛИ { secure: true }
    window.CoopNetwork.peer = new Peer("RPGMZ_" + code, { secure: true });
    
    this.updateStatus("Создание комнаты... Код: " + code);
    window.CoopNetwork.peer.on('open', (id) => this.updateStatus("Комната создана! Код: " + code + "\nЖдем подключения..."));
    window.CoopNetwork.peer.on('connection', (conn) => {
        window.CoopNetwork.connection = conn;
        this.setupConnection(true);
    });
    window.CoopNetwork.peer.on('error', (err) => {
        if (err.type === 'unavailable-id') { this.updateStatus("Ошибка: Код занят."); this._coopWindow.activate(); }
    });
};

// --- ГОСТЬ ---
Scene_Coop.prototype.commandGuest = function() {
    this._coopWindow.deactivate();
    window.CoopNetwork.isHost = false;
    const code = prompt("Введите код комнаты (4 цифры):");
    if (!code || code.length !== 4) {
        this.updateStatus("Неверный код.");
        this._coopWindow.activate();
        return;
    }
    this.updateStatus("Подключение к комнате " + code + "...");
    // ДОБАВИЛИ { secure: true }
    window.CoopNetwork.peer = new Peer({ secure: true });
    
    window.CoopNetwork.peer.on('open', () => {
        window.CoopNetwork.connection = window.CoopNetwork.peer.connect("RPGMZ_" + code);
        this.setupConnection(false);
    });
    window.CoopNetwork.peer.on('error', (err) => {
        if (err.type === 'peer-unavailable') { this.updateStatus("Комната не найдена."); this._coopWindow.activate(); }
    });
};

// --- НАСТРОЙКА СОЕДИНЕНИЯ ---
Scene_Coop.prototype.setupConnection = function(isLoad) {
    window.CoopNetwork.connection.on('open', () => {
        window.CoopNetwork.myActorId = window.CoopNetwork.isHost ? 1 : 2;
        this.updateStatus("Успешное подключение!");
        
        if (window.CoopNetwork.isHost) {
            if (isLoad) {
                SceneManager.push(Scene_Load); // Хост грузит сейв
            } else {
                DataManager.setupNewGame(); // Хост начинает новую
                $gameParty._actors = [1];
                $gamePlayer.refresh();
                SceneManager.goto(Scene_Map);
            }
        }
        // Гость НЕ делает ничего. Он ждет пакет full_sync_state, чтобы запуститься.
    });

    window.CoopNetwork.connection.on('data', (data) => {
        window.CoopNetwork.isReceivingData = true; 
        
        if (data.type === 'position') {
            window.CoopNetwork.partnerData = data.payload;
        } 
        else if (data.type === 'switch_update') {
            $gameSwitches.setValue(data.payload.id, data.payload.value);
        }
        else if (data.type === 'variable_update') {
            $gameVariables.setValue(data.payload.id, data.payload.value);
        }
        else if (data.type === 'full_sync_state') {
            const p = data.payload;
            if (SceneManager._scene instanceof Scene_Coop) {
                // ГОСТЬ В МЕНЮ: Запускаем ему игру и телепортируем на карту Хоста
                DataManager.setupNewGame();
                $gameParty._actors = [2];
                $gamePlayer.refresh();
                $gamePlayer.reserveTransfer(p.mapId, p.x, p.y, 0, 0);
                SceneManager.goto(Scene_Map);
                // Сохраняем стейт, чтобы применить его когда карта Гостя загрузится
                window.CoopNetwork.pendingSync = p;
                        } else {
                // ГОСТЬ В ИГРЕ: Хост перешел на другую карту. 
                $gameSwitches._data = p.switches;
                $gameVariables._data = p.variables;
                if ($gameMap.mapId() !== p.mapId) {
                    // Даем браузеру 300мс на подготовку к новой карте
                    setTimeout(() => {
                        $gamePlayer.reserveTransfer(p.mapId, p.x, p.y, 0, 0);
                        window.CoopNetwork.pendingSync = p;
                    }, 300);
                } else {
                    $gameMap.refresh();
                }
            }
        }
        else if (data.type === 'guest_state_update') {
            if (window.CoopNetwork.isHost) window.CoopNetwork.guestState = data.payload;
        }
        else if (data.type === 'restore_guest_state') {
            if (!window.CoopNetwork.isHost) {
                const p = data.payload;
                $gameParty._items = p.items;
                $gameParty._weapons = p.weapons;
                $gameParty._armors = p.armors;
                $gameParty._gold = p.gold;
            }
        }
        
        window.CoopNetwork.isReceivingData = false; 
    });

    window.CoopNetwork.connection.on('close', () => {
        console.log("Игрок отключился");
        window.CoopNetwork.connection = null;
    });
};

function Window_Coop() { this.initialize(...arguments); }
Window_Coop.prototype = Object.create(Window_Command.prototype);
Window_Coop.prototype.constructor = Window_Coop;
Window_Coop.prototype.initialize = function(rect) { Window_Command.prototype.initialize.call(this, rect); };
Window_Coop.prototype.makeCommandList = function() {
    this.addCommand("Новая игра (Хост)", "host");
    this.addCommand("Загрузить игру (Хост)", "host_load");
    this.addCommand("Войти в игру (Гость)", "guest");
    this.addCommand("Назад", "cancel");
};

// =========================================================================
// 3. СИНХРОНИЗАЦИЯ ПРИ ЗАГРУЗКЕ КАРТЫ (ФИКС ДЕСИНХРОНА)
// =========================================================================
const _Scene_Map_start = Scene_Map.prototype.start;
Scene_Map.prototype.start = function() {
    _Scene_Map_start.call(this);
    
    // Если мы Хост, и Гость подключен, отправляем ему актуальный стейт
    if (window.CoopNetwork.isHost && window.CoopNetwork.connection && window.CoopNetwork.connection.open) {
        window.CoopNetwork.connection.send({
            type: 'full_sync_state',
            payload: {
                switches: $gameSwitches._data,
                variables: $gameVariables._data,
                mapId: $gameMap.mapId(),
                x: $gamePlayer.x,
                y: $gamePlayer.y
            }
        });
    }
    
    // Если мы Гость, и у нас есть ожидающие данные от Хоста — применяем их
    if (!window.CoopNetwork.isHost && window.CoopNetwork.pendingSync) {
        $gameSwitches._data = window.CoopNetwork.pendingSync.switches;
        $gameVariables._data = window.CoopNetwork.pendingSync.variables;
        $gameMap.refresh();
        window.CoopNetwork.pendingSync = null; // Очищаем
    }
};

// =========================================================================
// 4. СИНХРОНИЗАЦИЯ ИГРОКОВ НА КАРТЕ
// =========================================================================
const _Game_Player_update = Game_Player.prototype.update;
Game_Player.prototype.update = function(sceneActive) {
    _Game_Player_update.call(this, sceneActive);
    if (window.CoopNetwork.connection && window.CoopNetwork.connection.open) {
        if (this.isMoving() || Input.dir4 > 0) {
            window.CoopNetwork.connection.send({
                type: 'position',
                payload: { x: this.x, y: this.y, mapId: $gameMap.mapId(), direction: this.direction() }
            });
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
    const partnerActorId = window.CoopNetwork.isHost ? 2 : 1;
    const actor = $gameActors.actor(partnerActorId);
    if (actor) this._coopGhostChar.setImage(actor.characterName(), actor.characterIndex());
    else this._coopGhostChar.setImage("Actor1", 0);
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
            this._coopGhostChar.update();
            const dist = Math.abs(this._coopGhostChar.x - data.x) + Math.abs(this._coopGhostChar.y - data.y);
            if (dist > 1) {
                this._coopGhostChar.locate(data.x, data.y);
                this._coopGhostChar.setDirection(data.direction);
            } else if (dist > 0 && !this._coopGhostChar.isMoving()) {
                const dir = this._coopGhostChar.findDirectionTo(data.x, data.y);
                if (dir > 0) this._coopGhostChar.moveStraight(dir);
            } else if (dist === 0 && !this._coopGhostChar.isMoving()) {
                this._coopGhostChar.setDirection(data.direction);
            }
        } else {
            this._coopGhost.opacity = 0;
        }
    }
};

// =========================================================================
// 5. ПЕРЕХВАТ СВИТЧЕЙ И ПЕРЕМЕННЫХ
// =========================================================================
const _Game_Switches_setValue = Game_Switches.prototype.setValue;
Game_Switches.prototype.setValue = function(switchId, value) {
    _Game_Switches_setValue.call(this, switchId, value);
    if (window.CoopNetwork.connection && window.CoopNetwork.connection.open && !window.CoopNetwork.isReceivingData) {
        window.CoopNetwork.connection.send({ type: 'switch_update', payload: { id: switchId, value: value } });
    }
};

const _Game_Variables_setValue = Game_Variables.prototype.setValue;
Game_Variables.prototype.setValue = function(variableId, value) {
    _Game_Variables_setValue.call(this, variableId, value);
    if (window.CoopNetwork.connection && window.CoopNetwork.connection.open && !window.CoopNetwork.isReceivingData) {
        window.CoopNetwork.connection.send({ type: 'variable_update', payload: { id: variableId, value: value } });
    }
};

// =========================================================================
// 6. ЗАПРЕТ СОХРАНЕНИЯ ГОСТЯ И СОХРАНЕНИЕ ЕГО ИНВЕНТАРЯ
// =========================================================================
const _Window_MenuCommand_addSaveCommand = Window_MenuCommand.prototype.addSaveCommand;
Window_MenuCommand.prototype.addSaveCommand = function() {
    const isGuest = window.CoopNetwork.connection && !window.CoopNetwork.isHost;
    if (!isGuest) _Window_MenuCommand_addSaveCommand.call(this);
};

const _Game_Party_gainItem = Game_Party.prototype.gainItem;
Game_Party.prototype.gainItem = function(item, amount, includeEquip) {
    _Game_Party_gainItem.call(this, item, amount, includeEquip);
    if (window.CoopNetwork.connection && window.CoopNetwork.connection.open && !window.CoopNetwork.isHost) {
        window.CoopNetwork.connection.send({
            type: 'guest_state_update',
            payload: {
                items: $gameParty._items, weapons: $gameParty._weapons, armors: $gameParty._armors,
                gold: $gameParty._gold, mapId: $gameMap.mapId(), x: $gamePlayer.x, y: $gamePlayer.y
            }
        });
    }
};

const _DataManager_makeSaveContents = DataManager.makeSaveContents;
DataManager.makeSaveContents = function() {
    const contents = _DataManager_makeSaveContents.call(this);
    if (window.CoopNetwork.isHost && window.CoopNetwork.guestState) {
        contents.coopGuestState = window.CoopNetwork.guestState;
    }
    return contents;
};

const _DataManager_extractSaveContents = DataManager.extractSaveContents;
DataManager.extractSaveContents = function(contents) {
    _DataManager_extractSaveContents.call(this, contents);
    if (window.CoopNetwork.connection) {
        $gameParty._actors = [window.CoopNetwork.isHost ? 1 : 2];
        $gamePlayer.refresh();
    }
    if (contents.coopGuestState) {
        window.CoopNetwork.guestState = contents.coopGuestState;
        if (window.CoopNetwork.connection && window.CoopNetwork.connection.open) {
            window.CoopNetwork.connection.send({ type: 'restore_guest_state', payload: window.CoopNetwork.guestState });
        }
    } else {
        window.CoopNetwork.guestState = null;
    }
};
