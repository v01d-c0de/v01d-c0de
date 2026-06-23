// =========================================================================
// CoopHandHolding.js - Механика "Держание за ручки"
// =========================================================================

/*:
@target MZ
@plugindesc v1.0 Синхронизация держания за руки, меню взаимодействия, ниточка.
@author Твой Ник
*/

window.CoopNetwork.isLeading = false; // Я ведущий
window.CoopNetwork.isFollowing = false; // Я ведомый

// Перехватываем данные из сети
window.CoopNetwork.onData = function(data) {
    if (data.type === 'hold_request') {
        // ИСПРАВЛЕНО ТУТ (заодно добавим проверку, что мы на карте):
        if (SceneManager._scene instanceof Scene_Map) {
            SceneManager._scene.showHandPrompt();
        }
    } 
    else if (data.type === 'hold_accept') {
        window.CoopNetwork.isLeading = true;
        $gameMessage.add("Ваш партнер согласился! Вы ведете.");
    } 
    else if (data.type === 'hold_reject') {
        $gameMessage.add("Ваш партнер отказался.");
    } 
    else if (data.type === 'release_hands') {
        window.CoopNetwork.isFollowing = false;
        window.CoopNetwork.isLeading = false;
        $gameMessage.add("Ваш партнер отпустил руку.");
    }
};

// =========================================================================
// 1. БЛОКИРОВКА УПРАВЛЕНИЯ И АВТО-СЛЕДОВАНИЕ (ДЛЯ ВЕДОМОГО)
// =========================================================================

const _Game_Player_moveByInput_hh = Game_Player.prototype.moveByInput;
Game_Player.prototype.moveByInput = function() {
    if (window.CoopNetwork.isFollowing) return;
    _Game_Player_moveByInput_hh.call(this);
};

const _Game_Player_update_hh = Game_Player.prototype.update;
Game_Player.prototype.update = function(sceneActive) {
    _Game_Player_update_hh.call(this, sceneActive);

    if (window.CoopNetwork.isFollowing && !this.isMoving() && !$gameMap.isEventRunning()) {
        const target = window.CoopNetwork.partnerData;
        if (target.mapId === $gameMap.mapId()) {
            const dist = Math.abs(this.x - target.x) + Math.abs(this.y - target.y);
            
            if (dist > 2) {
                this.locate(target.x, target.y);
            } else if (dist === 1) {
                const dir = this.findDirectionTo(target.x, target.y);
                this.moveStraight(dir);
            } else if (dist === 0) {
                const dir = this.findDirectionTo(target.x, target.y);
                if (dir > 0) this.setDirection(dir);
            }
        }
    }
};

const _Scene_Map_update_hh = Scene_Map.prototype.update;
Scene_Map.prototype.update = function() {
    _Scene_Map_update_hh.call(this);
    
    if (Input.isTriggered('cancel') && (window.CoopNetwork.isLeading || window.CoopNetwork.isFollowing)) {
        if (!$gameMap.isEventRunning() && !this.isBusy()) {
            window.CoopNetwork.isLeading = false;
            window.CoopNetwork.isFollowing = false;
            window.CoopNetwork.connection.send({ type: 'release_hands' });
            $gameMessage.add("Вы отпустили руку.");
        }
    }
};

// =========================================================================
// 2. ВЗАИМОДЕЙСТВИЕ (Нажать Энтер рядом с игроком)
// =========================================================================

const _Scene_Map_processMapTouch_hh = Scene_Map.prototype.processMapTouch;
Scene_Map.prototype.processMapTouch = function() {
    _Scene_Map_processMapTouch_hh.call(this);
};

const _Game_Player_triggerAction_hh = Game_Player.prototype.triggerAction;
Game_Player.prototype.triggerAction = function() {
    if (Input.isTriggered('ok') && !window.CoopNetwork.isLeading && !window.CoopNetwork.isFollowing) {
        const dx = $gameMap.roundXWithDirection(this.x, this.direction());
        const dy = $gameMap.roundYWithDirection(this.y, this.direction());
        const p = window.CoopNetwork.partnerData;
        
        if (p.mapId === $gameMap.mapId() && p.x === dx && p.y === dy) {
            SceneManager._scene.showInteractionMenu();
            return true;
        }
    }
    return _Game_Player_triggerAction_hh.call(this);
};

// =========================================================================
// 3. ИНТЕРФЕЙС (Окна выбора)
// =========================================================================

Scene_Map.prototype.showInteractionMenu = function() {
    if (this._handMenuWindow) this._handMenuWindow.deactivate();
    
    this._handMenuWindow = new Window_Interaction(new Rectangle(0, 0, 250, 110));
    this._handMenuWindow.x = Graphics.width / 2 - 125;
    this._handMenuWindow.y = Graphics.height / 2 - 55;
    this._handMenuWindow.setHandler('hold', this.commandProposeHold.bind(this));
    this._handMenuWindow.setHandler('cancel', this.closeInteractionMenu.bind(this));
    this.addWindow(this._handMenuWindow);
};

Scene_Map.prototype.commandProposeHold = function() {
    this._handMenuWindow.close();
    window.CoopNetwork.connection.send({ type: 'hold_request' });
    $gameMessage.add("Вы предложили взять за руку. Ждем ответа...");
};

Scene_Map.prototype.closeInteractionMenu = function() {
    this._handMenuWindow.close();
};

Scene_Map.prototype.showHandPrompt = function() {
    if (this._promptWindow) this._promptWindow.deactivate();
    
    this._promptWindow = new Window_Prompt(new Rectangle(0, 0, 300, 110));
    this._promptWindow.x = Graphics.width / 2 - 150;
    this._promptWindow.y = Graphics.height / 2 - 55;
    this._promptWindow.setHandler('yes', this.commandAcceptHold.bind(this));
    this._promptWindow.setHandler('no', this.commandRejectHold.bind(this));
    this.addWindow(this._promptWindow);
};

Scene_Map.prototype.commandAcceptHold = function() {
    this._promptWindow.close();
    window.CoopNetwork.isFollowing = true;
    window.CoopNetwork.connection.send({ type: 'hold_accept' });
};

Scene_Map.prototype.commandRejectHold = function() {
    this._promptWindow.close();
    window.CoopNetwork.connection.send({ type: 'hold_reject' });
};

function Window_Interaction() { this.initialize(...arguments); }
Window_Interaction.prototype = Object.create(Window_Command.prototype);
Window_Interaction.prototype.constructor = Window_Interaction;
Window_Interaction.prototype.initialize = function(rect) { Window_Command.prototype.initialize.call(this, rect); };
Window_Interaction.prototype.makeCommandList = function() {
    this.addCommand("Взять за руку", "hold");
    this.addCommand("Отмена", "cancel");
};

function Window_Prompt() { this.initialize(...arguments); }
Window_Prompt.prototype = Object.create(Window_Command.prototype);
Window_Prompt.prototype.constructor = Window_Prompt;
Window_Prompt.prototype.initialize = function(rect) { Window_Command.prototype.initialize.call(this, rect); };
Window_Prompt.prototype.makeCommandList = function() {
    this.addCommand("Согласиться", "yes");
    this.addCommand("Отказать", "no");
};

// =========================================================================
// 4. РИСОВАНИЕ НИТОЧКИ МЕЖДУ ИГРОКАМИ
// =========================================================================

const _Spriteset_Map_createLowerLayer_hh = Spriteset_Map.prototype.createLowerLayer;
Spriteset_Map.prototype.createLowerLayer = function() {
    _Spriteset_Map_createLowerLayer_hh.call(this);
    this._handRibbon = new PIXI.Graphics();
    this.addChild(this._handRibbon);
};

const _Spriteset_Map_update_hh = Spriteset_Map.prototype.update;
Spriteset_Map.prototype.update = function() {
    _Spriteset_Map_update_hh.call(this);
    
    if (this._handRibbon && this._coopGhost) {
        this._handRibbon.clear();
        
        if ((window.CoopNetwork.isLeading || window.CoopNetwork.isFollowing) && this._coopGhost.opacity > 0) {
            let p1x = $gamePlayer.screenX();
            let p1y = $gamePlayer.screenY() - 24; 
            
            let p2x = this._coopGhostChar.screenX();
            let p2y = this._coopGhostChar.screenY() - 24;
            
            this._handRibbon.lineStyle(4, 0xff69b4, 1);
            this._handRibbon.moveTo(p1x, p1y);
            this._handRibbon.lineTo(p2x, p2y);
            
            this._handRibbon.lineStyle(0);
            this._handRibbon.beginFill(0xff0000, 1);
            this._handRibbon.drawCircle((p1x + p2x) / 2, (p1y + p2y) / 2, 5);
            this._handRibbon.endFill();
        }
    }
};
