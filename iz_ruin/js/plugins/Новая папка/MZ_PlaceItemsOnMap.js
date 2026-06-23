//=============================================================================
// MZ_PlaceItemsOnMap.js
//=============================================================================

/*:
 * @target MZ
 * @plugindate 2023-10-27
 * @author AI Assistant
 * @url 
 *
 * @command cancelPlacement
 * @text Отменить размещение
 * @desc Принудительно отменяет режим установки предмета на карту.
 *
 * @help MZ_PlaceItemsOnMap.js
 *
 * Этот плагин позволяет вытаскивать предметы из инвентаря и размещать их на карте.
 * 
 * Использование:
 * В заметках (Notes) предмета добавьте тег:
 * <PlaceOnMap: GraphicName, ItemId>
 * 
 * GraphicName - имя файла картинки из папки img/characters/ (без .png).
 * ItemId - ID этого предмета в базе данных (нужно, чтобы поднять предмет обратно).
 * 
 * Пример:
 * <PlaceOnMap: Barrel, 5>
 * Это разместит на карту графику Barrel.png, а при клике на неё вернет предмет с ID 5.
 *
 */

(() => {
    'use strict';

    const PLUGIN_NAME = "MZ_PlaceItemsOnMap";

    // -------------------------------------------------------------------
    // ХРАНИЛИЩЕ ДАННЫХ
    // -------------------------------------------------------------------
    Game_System.prototype.initializePlacementVars = function() {
        if (this._placementMode === undefined) {
            this._placementMode = false;
            this._placementItemId = 0;
            this._placementGraphic = "";
        }
    };

    const _Game_System_initialize = Game_System.prototype.initialize;
    Game_System.prototype.initialize = function() {
        _Game_System_initialize.call(this);
        this.initializePlacementVars();
    };

    // -------------------------------------------------------------------
    // ПЕРЕХВАТ ИСПОЛЬЗОВАНИЯ ПРЕДМЕТА
    // -------------------------------------------------------------------
    const _Scene_ItemBase_useItem = Scene_ItemBase.prototype.useItem;
    Scene_ItemBase.prototype.useItem = function() {
        const item = this.item();
        if (item && item.note) {
            const match = item.note.match(/<PlaceOnMap:\s*(.+)\s*,\s*(\d+)\s*>/i);
            if (match) {
                // Входим в режим размещения вместо использования предмета
                $gameSystem._placementMode = true;
                $gameSystem._placementItemId = Number(match[2]);
                $gameSystem._placementGraphic = match[1].trim();
                this.popScene(); // Закрываем инвентарь
                return;
            }
        }
        _Scene_ItemBase_useItem.call(this);
    };

    // -------------------------------------------------------------------
    // ЛОГИКА НА КАРТЕ (РАЗМЕЩЕНИЕ)
    // -------------------------------------------------------------------
    const _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function() {
        _Scene_Map_update.call(this);
        $gameSystem.initializePlacementVars();
        
        if ($gameSystem._placementMode) {
            this.updatePlacementMode();
        }
    };

    Scene_Map.prototype.updatePlacementMode = function() {
        // Правая кнопка мыши или Esc - отмена
        if (TouchInput.isCancelled() || Input.isTriggered('cancel')) {
            $gameSystem._placementMode = false;
            return;
        }

        // Левая кнопка мыши - установка
        if (TouchInput.isTriggered()) {
            const x = $gameMap.canvasToMapX(TouchInput.x);
            const y = $gameMap.canvasToMapY(TouchInput.y);
            
            if (this.canPlaceItemHere(x, y)) {
                this.spawnItemOnMap(x, y);
                // Списываем предмет из инвентаря
                const item = $dataItems[$gameSystem._placementItemId];
                if (item) $gameParty.consumeItem(item);
                $gameSystem._placementMode = false;
            }
        }
    };

    Scene_Map.prototype.canPlaceItemHere = function(x, y) {
        // Проверяем, проходимо ли место (чтобы не ставить бочку в стену)
        return $gameMap.isPassable(x, y);
    };

    Scene_Map.prototype.spawnItemOnMap = function(x, y) {
        const mapId = $gameMap.mapId();
        const graphicName = $gameSystem._placementGraphic;
        const itemId = $gameSystem._placementItemId;

        // Создаем данные события динамически
        const eventId = $dataMap.events.length;
        const newData = {
            id: eventId,
            name: "PlacedItem_" + itemId,
            x: x,
            y: y,
            pages: [{
                conditions: { actorId: 1, actorValid: false, itemId: 1, itemValid: false, selfSwitchCh: "A", selfSwitchValid: false, switch1Id: 1, switch1Valid: false, switch2Id: 1, switch2Valid: false, variableId: 1, variableValid: false, variableValue: 0 },
                directionFix: true,
                image: { characterIndex: 0, characterName: graphicName, direction: 2, pattern: 1, tileId: -1 },
                list: [
                    { code: 355, indent: 0, parameters: ["window.PickupEvent.placeBack(" + itemId + ")"] },
                    { code: 0, indent: 0, parameters: [] }
                ],
                moveFrequency: 3,
                moveRoute: { list: [{code: 0, parameters: []}], repeat: true, skippable: false, wait: false },
                moveSpeed: 3,
                moveType: 0,
                priorityType: 1, // Над тайлами
                stepAnime: false,
                through: true, // Проходимо, чтобы не застревать
                trigger: 0,    // Нажатие кнопки действия
                walkAnime: true
            }]
        };
        
        $dataMap.events[eventId] = newData;
        $gameMap._events[eventId] = new Game_Event(mapId, eventId);
    };

    // -------------------------------------------------------------------
    // СКРИПТ ПОДБОРА ПРЕДМЕТА ОБРАТНО
    // -------------------------------------------------------------------
    window.PickupEvent = {};
    window.PickupEvent.placeBack = function(itemId) {
        $gameParty.gainItem($dataItems[itemId], 1);
        // Удаляем событие визуально
        const eventId = this._eventId;
        $gameMap.eraseEvent(eventId);
    };

    // -------------------------------------------------------------------
    // ОТРИСОВКА "ПРИЗРАЧНОГО" ПРЕДМЕТА (ПРЕВЬЮ)
    // -------------------------------------------------------------------
    const _Spriteset_Map_createCharacters = Spriteset_Map.prototype.createCharacters;
    Spriteset_Map.prototype.createCharacters = function() {
        _Spriteset_Map_createCharacters.call(this);
        this._placementSprite = new Sprite_Character(new Game_CharacterPlacementPreview());
        this._placementSprite.opacity = 150; // Полупрозрачный
        this._placementSprite.visible = false;
        this._tilemap.addChild(this._placementSprite);
    };

    const _Spriteset_Map_update = Spriteset_Map.prototype.update;
    Spriteset_Map.prototype.update = function() {
        _Spriteset_Map_update.call(this);
        if ($gameSystem._placementMode) {
            this._placementSprite.visible = true;
            const x = $gameMap.canvasToMapX(TouchInput.x);
            const y = $gameMap.canvasToMapY(TouchInput.y);
            this._placementSprite._character.setPosition(x, y);
            this._placementSprite._character.setDirection(2);
            this._placementSprite._character.setCharacterImage($gameSystem._placementGraphic, 0);
            this._placementSprite.update();
        } else if (this._placementSprite) {
            this._placementSprite.visible = false;
        }
    };

    // Фейковый персонаж для корректной отрисовки спрайта превью
    function Game_CharacterPlacementPreview() {
        this.initialize.apply(this, arguments);
    }

    Game_CharacterPlacementPreview.prototype = Object.create(Game_Character.prototype);
    Game_CharacterPlacementPreview.prototype.constructor = Game_CharacterPlacementPreview;

    Game_CharacterPlacementPreview.prototype.initialize = function() {
        Game_Character.prototype.initialize.call(this);
        this.setPosition(0, 0);
        this.setDirection(2);
    };

})();