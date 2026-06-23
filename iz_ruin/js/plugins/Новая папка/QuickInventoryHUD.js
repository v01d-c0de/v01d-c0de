//=============================================================================
// QuickInventoryHUD.js
//=============================================================================

/*:
 * @target MZ
 * @plugindesc Быстрый инвентарь на экране карты (Q) с возможностью использования.
 * @author AI Assistant
 *
 * @param Window Width
 * @text Ширина окна
 * @desc Ширина выпадающего окна инвентаря.
 * @type number
 * @default 360
 *
 * @param Window Opacity
 * @text Прозрачность фона окна
 * @desc Прозрачность фона окна (0-255).
 * @type number
 * @default 200
 *
 * @help
 * Плагин добавляет быстрый инвентарь на экран карты.
 * Открытие/Закрытие: Клавиша Q (PageUp)
 * Использовать предмет: Клавиша OK (Enter / Пробел)
 * Закрыть без использования: Клавиша Cancel (Esc / X)
 */

(() => {
    const pluginName = "QuickInventoryHUD";
    const parameters = PluginManager.parameters(pluginName);
    
    const windowWidth = Number(parameters["Window Width"] || 360);
    const windowOpacity = Number(parameters["Window Opacity"] || 200);

    // --- Окно Инвентаря ---
    class Window_QuickInventory extends Window_Selectable {
        constructor(rect) {
            super(rect);
            this.openness = 0;
            this.setHandler("ok", this.onOk.bind(this));
            this.setHandler("cancel", this.onCancel.bind(this));
        }

        makeItemList() {
            this._data = $gameParty.allItems().filter(item => item && $gameParty.numItems(item) > 0);
        }

        maxItems() {
            return this._data ? this._data.length : 0;
        }

        item() {
            return this._data && this.index() >= 0 ? this._data[this.index()] : null;
        }

        isCurrentItemEnabled() {
            return this.item() && $gameParty.canUse(this.item());
        }

        drawItem(index) {
            const item = this._data[index];
            if (!item) return;
            const rect = this.itemLineRect(index);
            const numberWidth = this.numberWidth();
            this.changePaintOpacity($gameParty.canUse(item)); // Затемняем неиспользуемые предметы
            this.resetTextColor();
            this.drawItemName(item, rect.x, rect.y, rect.width - numberWidth);
            this.drawText($gameParty.numItems(item), rect.x + rect.width - numberWidth, rect.y, numberWidth, "right");
            this.changePaintOpacity(1);
        }

        numberWidth() {
            return this.textWidth("000");
        }

        refresh() {
            this.makeItemList();
            this.createContents();
            this.drawAllItems();
        }

        // Использование предмета
        onOk() {
            const item = this.item();
            if (item && $gameParty.canUse(item)) {
                // Определяем цель применения (одиночная или группа)
                const actor = $gameParty.leader();
                const action = new Game_Action(actor);
                action.setItemObject(item);
                
                let targets = [];
                if (action.isForAll()) {
                    targets = $gameParty.aliveMembers();
                } else {
                    targets = [actor]; // На карте применяем на лидера партии
                }

                // Применяем эффекты
                targets.forEach(target => {
                    action.apply(target);
                });

                // Играем звук и вычитаем предмет
                SoundManager.playUseItem();
                $gameParty.consumeItem(item);

                // Обновляем окно
                this.refresh();
                this.activate(); // Оставляем окно активным для повторного использования
            } else {
                SoundManager.playBuzzer(); // Звук ошибки, если предмет нельзя использовать
                this.activate();
            }
        }

        onCancel() {
            SceneManager._scene.closeQuickInv();
        }

        updateOpen() {
            if (this._opening) {
                this.openness += 20;
                if (this.isOpen()) this._opening = false;
            }
        }

        updateClose() {
            if (this._closing) {
                this.openness -= 20;
                if (this.isClosed()) this._closing = false;
            }
        }

        open() {
            if (this.isOpen()) return;
            this._opening = true;
            this._closing = false;
            this.refresh();
            this.show();
        }

        close() {
            if (this.isClosed()) return;
            this._closing = true;
            this._opening = false;
        }
    }

    // --- Интеграция в Scene_Map ---
    const _Scene_Map_createDisplayObjects = Scene_Map.prototype.createDisplayObjects;
    Scene_Map.prototype.createDisplayObjects = function() {
        _Scene_Map_createDisplayObjects.call(this);
        this.createQuickInvWindow();
    };

    Scene_Map.prototype.createQuickInvWindow = function() {
        const rect = new Rectangle(Graphics.width - windowWidth, 0, windowWidth, Graphics.height);
        this._quickInvWindow = new Window_QuickInventory(rect);
        this._quickInvWindow.opacity = windowOpacity;
        this.addChild(this._quickInvWindow);
    };

    Scene_Map.prototype.openQuickInv = function() {
        this._quickInvWindow.open();
        this._quickInvWindow.activate();
        this._quickInvWindow.select(0);
    };

    Scene_Map.prototype.closeQuickInv = function() {
        this._quickInvWindow.close();
        this._quickInvWindow.deactivate();
        this._quickInvWindow.deselect();
    };

    const _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function() {
        _Scene_Map_update.call(this);
        
        // Активация по клавише Q (PageUp)
        if (Input.isTriggered("pageup")) {
            if (this._quickInvWindow.isOpen() || this._quickInvWindow.isOpening()) {
                this.closeQuickInv();
            } else {
                this.openQuickInv();
            }
        }
    };

    // --- Блокировка движения игрока при открытом инвентаре ---
    const _Game_Player_canMove = Game_Player.prototype.canMove;
    Game_Player.prototype.canMove = function() {
        const scene = SceneManager._scene;
        if (scene && scene._quickInvWindow && scene._quickInvWindow.active) {
            return false; // Запрещаем ходить
        }
        return _Game_Player_canMove.call(this);
    };

})();