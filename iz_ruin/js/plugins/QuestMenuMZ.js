/*:
 * @target MZ
 * @plugindesc Журнал заданий + фикс инвентаря (описание сверху)
 * @author AI Assistant
 *
 * @param Command Name
 * @text Название команды
 * @desc Название кнопки заданий в меню.
 * @default Задания
 *
 * @param Quest Desc Lines
 * @text Строки описания (Задания)
 * @desc Высота окна описания в меню заданий.
 * @type number
 * @default 3
 *
 * @param Inv Desc Lines
 * @text Строки описания (Инвентарь)
 * @desc Высота окна описания в стандартном инвентаре.
 * @type number
 * @default 3
 *
 * @help
 * 1. Добавляет меню "Задания" (предметы с тегом <quest>).
 * 2. Скрывает предметы <quest> из обычного инвентаря.
 * 3. Перемещает описание в стандартном инвентаре НАВЕРХ.
 */

(() => {
    const pluginName = "QuestMenuAndInvFixMZ";
    const parameters = PluginManager.parameters(pluginName);
    const commandName = parameters["Command Name"] || "Задания";
    const questDescLines = Number(parameters["Quest Desc Lines"] || 3);
    const invDescLines = Number(parameters["Inv Desc Lines"] || 3);

    // ============================================================
    // 1. СКРЫВАЕМ ПРЕДМЕТЫ С <quest> ИЗ СТАНДАРТНОГО ИНВЕНТАРЯ
    // ============================================================
    const _Window_ItemList_includes = Window_ItemList.prototype.includes;
    Window_ItemList.prototype.includes = function(item) {
        if (item && item.note && item.note.includes('<quest>')) {
            return false;
        }
        return _Window_ItemList_includes.call(this, item);
    };

    // ============================================================
    // 2. ФИКС СТАНДАРТНОГО ИНВЕНТАРЯ (ОПИСАНИЕ СВЕРХУ)
    // ============================================================
    
    // Заставляем окно описания рисоваться сверху (от нулевой координаты)
    Scene_Item.prototype.helpWindowRect = function() {
        const wx = 0;
        const wy = 0;
        const ww = Graphics.boxWidth;
        const wh = this.calcWindowHeight(invDescLines, false);
        return new Rectangle(wx, wy, ww, wh);
    };

    // Вкладки категорий (Предметы/Оружие/Броня) рисуем ПОД описанием
    Scene_Item.prototype.categoryWindowRect = function() {
        const wx = 0;
        const wy = this._helpWindow.y + this._helpWindow.height;
        const ww = Graphics.boxWidth;
        const wh = this.calcWindowHeight(1, true);
        return new Rectangle(wx, wy, ww, wh);
    };

    // Список предметов рисуем ПОД вкладками категорий
    Scene_Item.prototype.itemWindowRect = function() {
        const wx = 0;
        const wy = this._categoryWindow.y + this._categoryWindow.height;
        const ww = Graphics.boxWidth;
        const wh = Graphics.boxHeight - wy;
        return new Rectangle(wx, wy, ww, wh);
    };

    // ============================================================
    // 3. ОКНО СПИСКА ЗАДАНИЙ
    // ============================================================
    class Window_QuestItemList extends Window_ItemList {
        includes(item) {
            return item && DataManager.isItem(item) && item.note.includes('<quest>');
        }

        isEnabled(item) {
            return true;
        }
    }

    // ============================================================
    // 4. СЦЕНА МЕНЮ ЗАДАНИЙ
    // ============================================================
    class Scene_Quest extends Scene_ItemBase {
        create() {
            Scene_ItemBase.prototype.create.call(this);
            this.createHelpWindow();
            this.createItemWindow();
        }

        helpWindowRect() {
            const wx = 0;
            const wy = 0;
            const ww = Graphics.boxWidth;
            const wh = this.calcWindowHeight(questDescLines, false);
            return new Rectangle(wx, wy, ww, wh);
        }

        createItemWindow() {
            const rect = this.itemWindowRect();
            this._itemWindow = new Window_QuestItemList(rect);
            this._itemWindow.setHelpWindow(this._helpWindow);
            this._itemWindow.setHandler("ok", this.onItemOk.bind(this));
            this._itemWindow.setHandler("cancel", this.popScene.bind(this));
            this.addWindow(this._itemWindow);
            
            this._itemWindow.refresh();
            this._itemWindow.activate();
            this._itemWindow.select(0);
        }

        itemWindowRect() {
            const wx = 0;
            const wy = this._helpWindow.y + this._helpWindow.height;
            const ww = Graphics.boxWidth;
            const wh = Graphics.boxHeight - wy;
            return new Rectangle(wx, wy, ww, wh);
        }

        onItemOk() {
            SoundManager.playBuzzer();
            this._itemWindow.activate();
        }
    }

    // ============================================================
    // 5. ИНТЕГРАЦИЯ В ГЛАВНОЕ МЕНЮ
    // ============================================================
    const _Window_MenuCommand_addMainCommands = Window_MenuCommand.prototype.addMainCommands;
    Window_MenuCommand.prototype.addMainCommands = function() {
        _Window_MenuCommand_addMainCommands.call(this);
        this.addCommand(commandName, "quests", true);
    };

    const _Scene_Menu_createCommandWindow = Scene_Menu.prototype.createCommandWindow;
    Scene_Menu.prototype.createCommandWindow = function() {
        _Scene_Menu_createCommandWindow.call(this);
        this._commandWindow.setHandler("quests", this.commandQuests.bind(this));
    };

    Scene_Menu.prototype.commandQuests = function() {
        SceneManager.push(Scene_Quest);
    };

})();