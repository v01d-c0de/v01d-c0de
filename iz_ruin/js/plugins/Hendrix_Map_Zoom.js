/*:
 * @target MZ
 * @plugindesc Zoom your map. This plugin is compatible with all Sang Hendrix plugins.
 * @author Sang Hendrix
 * @url https://sanghendrix.itch.io
 *
 * @help
 * Version 1.0.3
 * For support or bug report, please contact via Discord
 * Discord: https://discord.gg/YKPscqHV8b
 * Patreon: https://www.patreon.com/SangHendrix
 * ----------------------------------------------------------------------------
 * This RPG Maker MZ plugin lets you zoom in on your map or game screen while
 * keeping everything sharp. It is fully compatible with all Sang Hendrix plugins.
 * (Not yet but will be!)
 * ----------------------------------------------------------------------------
 * ■ HOW TO USE
 * ----------------------------------------------------------------------------
 * Enable the plugin > Setup the parameter in parameter list, done!
 * Use the plugin command "Zoom Control" to zoom dynamically during gameplay.
 * ----------------------------------------------------------------------------
 * ■ TERMS OF USE
 * ----------------------------------------------------------------------------
 * https://www.rpgmakeractioncombat.com/p/sang-hendrixs-rpg-maker-plugin-terms-of.html
 * ----------------------------------------------------------------------------
 * ■ CREDIT
 * ----------------------------------------------------------------------------
 * Built based on MultiTweaks by ScSWinter (MIT License)
 *
 * @param mapZoomValue
 * @text Map Zoom Value
 * @type number
 * @decimals 1
 * @min 0.1
 * @default 2.0
 * @desc The zoom scale applied to the map.
 *
 * @param pixelateGame
 * @text Pixelate Game
 * @type boolean
 * @default false
 * @desc Render the game with nearest-neighbor filtering for sharp pixel art.
 *
 * @command zoomControl
 * @text Zoom Control
 * @desc Zoom the map to a target value, instantly or over X frames.
 *
 * @arg zoomValue
 * @text Zoom Value
 * @type number
 * @decimals 2
 * @min 0.1
 * @default 1.0
 * @desc Target zoom scale. 1.0 = normal, 2.0 = double, etc.
 *
 * @arg transition
 * @text Transition
 * @type number
 * @min 0
 * @default 0
 * @desc Number of frames to reach the target zoom. 0 = instant.
 */

var Imported = Imported || {};
Imported.Hendrix_Map_Zoom = true;

(() => {
    const parameters = PluginManager.parameters('Hendrix_Map_Zoom');
    const Hscale = parseFloat(parameters['mapZoomValue']) || 2.0;
    const pixelateGame = parameters['pixelateGame'] === 'true';

    let _currentZoom = Hscale;

    function getCurrentZoom() {
        return _currentZoom;
    }

    function extraScreenTile(zoom) {
        if (!$gameMap) return;
        const baseTileX = Graphics.width  / $gameMap.tileWidth();
        const baseTileY = Graphics.height / $gameMap.tileHeight();
        const zoomTileX = Math.round((Graphics.width  / ($gameMap.tileWidth()  * zoom)) * 16) / 16;
        const zoomTileY = Math.round((Graphics.height / ($gameMap.tileHeight() * zoom)) * 16) / 16;
        $gameMap._extraScreenTileX = (baseTileX - zoomTileX) / 2;
        $gameMap._extraScreenTileY = (baseTileY - zoomTileY) / 2;
        $gameMap._currentZoom = zoom;
    }

    Game_Map.prototype.scrollLeft = function(distance) {
        if (this.isLoopHorizontal()) {
            this._displayX += $dataMap.width - distance;
            this._displayX %= $dataMap.width;
            if (this._parallaxLoopX) this._parallaxX -= distance;
        } else if (this.width() + (this._extraScreenTileX || 0) * 2 >= this.screenTileX()) {
            const lastX = this._displayX;
            this._displayX = Math.max(this._displayX - distance, (this._extraScreenTileX || 0) * -1);
            this._parallaxX += this._displayX - lastX;
        }
    };

    Game_Map.prototype.scrollRight = function(distance) {
        if (this.isLoopHorizontal()) {
            this._displayX += distance;
            this._displayX %= $dataMap.width;
            if (this._parallaxLoopX) this._parallaxX += distance;
        } else if (this.width() + (this._extraScreenTileX || 0) * 2 >= this.screenTileX()) {
            const lastX = this._displayX;
            this._displayX = Math.min(
                this._displayX + distance,
                this.width() - this.screenTileX() + (this._extraScreenTileX || 0)
            );
            this._parallaxX += this._displayX - lastX;
        }
    };

    Game_Map.prototype.scrollUp = function(distance) {
        if (this.isLoopVertical()) {
            this._displayY += $dataMap.height - distance;
            this._displayY %= $dataMap.height;
            if (this._parallaxLoopY) this._parallaxY -= distance;
        } else if (this.height() + (this._extraScreenTileY || 0) * 2 >= this.screenTileY()) {
            const lastY = this._displayY;
            this._displayY = Math.max(this._displayY - distance, (this._extraScreenTileY || 0) * -1);
            this._parallaxY += this._displayY - lastY;
        }
    };

    Game_Map.prototype.scrollDown = function(distance) {
        if (this.isLoopVertical()) {
            this._displayY += distance;
            this._displayY %= $dataMap.height;
            if (this._parallaxLoopY) this._parallaxY += distance;
        } else if (this.height() + (this._extraScreenTileY || 0) * 2 >= this.screenTileY()) {
            const lastY = this._displayY;
            this._displayY = Math.min(
                this._displayY + distance,
                this.height() - this.screenTileY() + (this._extraScreenTileY || 0)
            );
            this._parallaxY += this._displayY - lastY;
        }
    };

    Game_Map.prototype.setDisplayPos = function(x, y) {
        const extX = this._extraScreenTileX || 0;
        const extY = this._extraScreenTileY || 0;
        if (this.isLoopHorizontal()) {
            this._displayX = x.mod(this.width());
            this._parallaxX = x;
        } else {
            const endX = this.width() - this.screenTileX() + extX * 2;
            this._displayX = endX < 0 ? endX / 2 - extX : x.clamp(extX * -1, endX - extX);
            this._parallaxX = this._displayX;
        }
        if (this.isLoopVertical()) {
            this._displayY = y.mod(this.height());
            this._parallaxY = y;
        } else {
            const endY = this.height() - this.screenTileY() + extY * 2;
            this._displayY = endY < 0 ? endY / 2 - extY : y.clamp(extY * -1, endY - extY);
            this._parallaxY = this._displayY;
        }
    };

    Game_Map.prototype.canvasToMapX = function(x) {
        const tileWidth = this.tileWidth() * (this._currentZoom || 1);
        const originX = (this._displayX + (this._extraScreenTileX || 0)) * tileWidth;
        return this.roundX(Math.floor((originX + x) / tileWidth));
    };

    Game_Map.prototype.canvasToMapY = function(y) {
        const tileHeight = this.tileHeight() * (this._currentZoom || 1);
        const originY = (this._displayY + (this._extraScreenTileY || 0)) * tileHeight;
        return this.roundY(Math.floor((originY + y) / tileHeight));
    };

    //==============================================================================
    // GAME_SCREEN
    //==============================================================================

    const _Game_Screen_updateZoom = Game_Screen.prototype.updateZoom;
    Game_Screen.prototype.updateZoom = function() {
        _Game_Screen_updateZoom.call(this);
        if (this._zoomDuration > 0) {
            extraScreenTile(this._zoomScale);
        }
    };

    const _Game_System_initialize = Game_System.prototype.initialize;
    Game_System.prototype.initialize = function() {
        _Game_System_initialize.call(this);
        this._hendrixZoom = Hscale;
    };

    Scene_Map.prototype.onMapLoaded = function() {
        _currentZoom = $gameSystem._hendrixZoomCurrent ?? Hscale;
        extraScreenTile(_currentZoom > 1.0 ? _currentZoom : 1);
        if (this._transfer) {
            $gamePlayer.performTransfer();
        }
        if (_currentZoom > 1.0) {
            $gameScreen.setZoom(Graphics.width / 2, Graphics.height / 2, _currentZoom);
        } else {
            $gameScreen.clearZoom();
        }
        this.createDisplayObjects();
    };

    //==============================================================================
    // PLUGIN COMMANDS
    //==============================================================================

    PluginManager.registerCommand('Hendrix_Map_Zoom', 'zoomControl', args => {
        const target = Math.max(0.1, parseFloat(args.zoomValue) || 1.0);
        const frames = Math.max(0, parseInt(args.transition) || 0);
        _currentZoom = target;
        $gameSystem._hendrixZoomCurrent = target;
        $gameSystem._hendrixZoom = target;
        extraScreenTile(target > 1.0 ? target : 1);
        if (frames > 0) {
            $gameScreen.startZoom(
                $gamePlayer.screenX(),
                $gamePlayer.screenY() - $gameMap.tileHeight() / 2,
                target,
                frames
            );
        } else {
            $gameScreen.setZoom(
                $gamePlayer.screenX(),
                $gamePlayer.screenY() - $gameMap.tileHeight() / 2,
                target
            );
        }
    });

    //==============================================================================

    const _Scene_Boot_start = Scene_Boot.prototype.start;
    Scene_Boot.prototype.start = function() {
        _Scene_Boot_start.call(this);
        pixelPerfectish();
    };

    function pixelPerfectish() {
        if (!pixelateGame) return;
        if (Graphics._canvas) {
            const canvas = Graphics._canvas;
            canvas.style.imageRendering = 'pixelated';
            canvas.style.imageRendering = '-moz-crisp-edges';
            const context = canvas.getContext('2d');
            if (context) context.imageSmoothingEnabled = false;
        }
        if (Graphics._app && Graphics._app.renderer && Graphics._app.renderer.gl) {
            const gl = Graphics._app.renderer.gl;
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        }
        PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;
    }

    //==============================================================================
    // COMPATIBILITY
    //==============================================================================

    const MAP_WORLD_OVERLAYS = new Set([
        "HitboxLayer",
    ]);

    const SPRITESET_MAP_OVERLAYS = new Set([
        "Sprite_Variable",
    ]);

    const _Spriteset_Map_addChild = Spriteset_Map.prototype.addChild;
    Spriteset_Map.prototype.addChild = function(child) {
        const name = child?.constructor?.name;
        if (this._baseSprite && SPRITESET_MAP_OVERLAYS.has(name)) {
            return this._baseSprite.addChild(child);
        }
        return _Spriteset_Map_addChild.call(this, child);
    };

    const _Scene_Map_addChild = Scene_Map.prototype.addChild;
    Scene_Map.prototype.addChild = function(child) {
        const name = child?.constructor?.name;
        if (this._spriteset?._baseSprite && MAP_WORLD_OVERLAYS.has(name)) {
            return this._spriteset._baseSprite.addChild(child);
        }
        return _Scene_Map_addChild.call(this, child);
    };

    window.HendrixTouchInput = {
        get x() { return Graphics.width  / 2 + (TouchInput._x - Graphics.width  / 2) / (_currentZoom || 1); },
        get y() { return Graphics.height / 2 + (TouchInput._y - Graphics.height / 2) / (_currentZoom || 1); },
        get wheelY() { return TouchInput.wheelY; },
        isTriggered() { return TouchInput.isTriggered(); },
        isPressed() { return TouchInput.isPressed(); },
        isCancelled() { return TouchInput.isCancelled(); },
    };

    window.HendrixGetZoom = function() { return _currentZoom; };
})();