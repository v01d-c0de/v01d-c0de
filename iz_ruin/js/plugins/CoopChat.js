// =========================================================================
// CoopChat.js - Чат и Никнеймы (MINIMAL)
// =========================================================================

/*:
@target MZ
@plugindesc v1.1 Минимальный чат для кооператива. Только суть.
@author Твой Ник
*/

window.CoopChat = {
    nickname: "",
    partnerNickname: "",
    isOpen: false,
    isInputFocused: false,
    htmlCreated: false,
    unreadCount: 0
};

// =========================================================================
// СОЗДАНИЕ HTML (ТОЛЬКО В КООПЕ)
// =========================================================================
window.CoopChat.createHtmlInterface = function() {
    if (this.htmlCreated) return;
    
    // НЕ создаём если нет соединения!
    if (!window.CoopNetwork || !window.CoopNetwork.connection) return;
    
    this.htmlCreated = true;
    
    const chat = document.createElement('div');
    chat.id = 'coop-chat';
    chat.innerHTML = `
        <style>
            #coop-chat {
                position: fixed;
                bottom: 10px;
                right: 10px;
                width: 320px;
                height: 350px;
                background: #111;
                color: #ccc;
                font-family: monospace;
                font-size: 13px;
                z-index: 2000;
                display: none;
                flex-direction: column;
            }
            #coop-chat.open { display: flex; }
            
            #coop-chat-header {
                background: #222;
                padding: 5px 8px;
                cursor: pointer;
                display: flex;
                justify-content: space-between;
                user-select: none;
            }
            
            #coop-chat-title { color: #888; }
            #coop-chat-close { 
                background: none; 
                border: none; 
                color: #666; 
                cursor: pointer;
                font-size: 14px;
            }
            
            #coop-chat-messages {
                flex: 1;
                overflow-y: auto;
                padding: 8px;
                background: #0a0a0a;
            }
            
            .chat-msg {
                margin-bottom: 4px;
                word-wrap: break-word;
                line-height: 1.3;
            }
            .chat-msg.self { color: #fff; text-align: right; }
            .chat-msg.partner { color: #4af; }
            .chat-msg.system { color: #fa0; font-style: italic; font-size: 11px; }
            .chat-msg .nick { font-weight: bold; }
            .chat-msg .time { color: #555; font-size: 10px; }
            
            #coop-chat-input-row {
                padding: 8px;
                background: #1a1a1a;
                display: flex;
            }
            
            #coop-chat-input {
                flex: 1;
                background: #000;
                border: 1px solid #333;
                color: #fff;
                padding: 5px;
                font-family: monospace;
                font-size: 13px;
                outline: none;
            }
            
            #coop-chat-send {
                margin-left: 5px;
                background: #222;
                border: 1px solid #444;
                color: #aaa;
                cursor: pointer;
                padding: 5px 12px;
            }
            #coop-chat-send:hover { background: #333; }
            
            #coop-chat-toggle {
                position: fixed;
                bottom: 10px;
                right: 10px;
                width: 40px;
                height: 40px;
                background: #111;
                border: 1px solid #333;
                color: #666;
                font-size: 18px;
                cursor: pointer;
                z-index: 1999;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            #coop-chat-toggle:hover { background: #222; }
            #coop-chat-toggle.hidden { display: none; }
            
            #nickname-modal {
                position: fixed;
                top: 0; left: 0;
                width: 100%; height: 100%;
                background: rgba(0,0,0,0.9);
                z-index: 3000;
                display: none;
                align-items: center;
                justify-content: center;
            }
            #nickname-modal.show { display: flex; }
            
            #nickname-box {
                background: #111;
                padding: 30px;
                text-align: center;
            }
            #nickname-box input {
                background: #000;
                border: 1px solid #333;
                color: #fff;
                padding: 10px;
                font-size: 16px;
                width: 200px;
                display: block;
                margin: 15px auto;
            }
            #nickname-box button {
                background: #222;
                border: 1px solid #444;
                color: #ccc;
                padding: 8px 24px;
                cursor: pointer;
                margin-top: 10px;
            }
        </style>
        
        <div id="coop-chat-header">
            <span id="coop-chat-title">CHAT</span>
            <button id="coop-chat-close">[X]</button>
        </div>
        <div id="coop-chat-messages"></div>
        <div id="coop-chat-input-row">
            <input type="text" id="coop-chat-input" placeholder="..." maxlength="150">
            <button id="coop-chat-send">&gt;</button>
        </div>
    `;
    
    document.body.appendChild(chat);
    
    // Toggle button
    const toggle = document.createElement('div');
    toggle.id = 'coop-chat-toggle';
    toggle.textContent = '[';
    document.body.appendChild(toggle);
    
    // Nickname modal
    const modal = document.createElement('div');
    modal.id = 'nickname-modal';
    modal.innerHTML = `
        <div id="nickname-box">
            <div>NICKNAME</div>
            <input type="text" id="nickname-input" maxlength="16">
            <button id="nickname-ok">OK</button>
        </div>
    `;
    document.body.appendChild(modal);
    
    this.bindEvents();
};

// =========================================================================
// СОБЫТИЯ
// =========================================================================
window.CoopChat.bindEvents = function() {
    var self = this;
    var chat = document.getElementById('coop-chat');
    var toggle = document.getElementById('coop-chat-toggle');
    var input = document.getElementById('coop-chat-input');
    var sendBtn = document.getElementById('coop-chat-send');
    var closeBtn = document.getElementById('coop-chat-close');
    var header = document.getElementById('coop-chat-header');
    var nickInput = document.getElementById('nickname-input');
    var nickOk = document.getElementById('nickname-ok');
    
    if (!chat) return;
    
    // Toggle
    toggle.onclick = function() { self.toggle(true); };
    closeBtn.onclick = function() { self.toggle(false); };
    header.onclick = function() { self.toggle(false); }; // minimize on header click
    
    // Send
    sendBtn.onclick = function() { self.send(); };
    input.onkeydown = function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            self.send();
        }
        if (e.key === 'Escape') {
            self.toggle(false);
        }
    };
    
    // Focus tracking
    input.onfocus = function() { self.isInputFocused = true; };
    input.onblur = function() { self.isInputFocused = false; };
    
    // Nickname
    nickOk.onclick = function() { self.confirmNick(); };
    nickInput.onkeydown = function(e) {
        if (e.key === 'Enter') self.confirmNick();
    };
};

// =========================================================================
// TOGGLE
// =========================================================================
window.CoopChat.toggle = function(open) {
    var chat = document.getElementById('coop-chat');
    var toggle = document.getElementById('coop-chat-toggle');
    if (!chat) return;
    
    if (open || !chat.classList.contains('open')) {
        chat.classList.add('open');
        toggle.classList.add('hidden');
        this.isOpen = true;
        this.unreadCount = 0;
        setTimeout(function() {
            document.getElementById('coop-chat-input').focus();
        }, 50);
    } else {
        chat.classList.remove('open');
        toggle.classList.remove('hidden');
        this.isOpen = false;
        this.isInputFocused = false;
    }
};

// =========================================================================
// НИКНЕЙМ
// =========================================================================
window.CoopChat.askNick = function() {
    var modal = document.getElementById('nickname-modal');
    var input = document.getElementById('nickname-input');
    if (!modal) return;
    
    input.value = 'Player' + Math.floor(1000 + Math.random() * 9000);
    modal.classList.add('show');
    input.focus();
    input.select();
};

window.CoopChat.confirmNick = function() {
    var modal = document.getElementById('nickname-modal');
    var input = document.getElementById('nickname-input');
    this.nickname = input.value.trim() || 'Unknown';
    modal.classList.remove('show');
    
    console.log('[Coop] Nick:', this.nickname);
    
    // Send to partner
    if (window.CoopNetwork && window.CoopNetwork.connection && window.CoopNetwork.connection.open) {
        window.CoopNetwork.connection.send({
            type: 'nickname_update',
            payload: { nickname: this.nickname }
        });
    }
    
    this.addSystem('Joined as ' + this.nickname);
};

// =========================================================================
// ОТПРАВКА / ПОЛУЧЕНИЕ
// =========================================================================
window.CoopChat.send = function() {
    var input = document.getElementById('coop-chat-input');
    var text = input.value.trim();
    if (!text) return;
    
    if (!window.CoopNetwork || !window.CoopNetwork.connection || !window.CoopNetwork.connection.open) {
        this.addSystem('No connection');
        return;
    }
    
    // Show locally
    this.addMsg(text, true);
    
    // Send to partner
    window.CoopNetwork.connection.send({
        type: 'chat_message',
        payload: { text: text, sender: this.nickname, time: Date.now() }
    });
    
    input.value = '';
    input.focus();
};

window.CoopChat.receive = function(text, from) {
    this.addMsg(text, false, from);
    
    if (!this.isOpen) {
        this.unreadCount++;
        var t = document.getElementById('coop-chat-toggle');
        if (t) t.textContent = '(' + this.unreadCount + ')';
    }
};

// =========================================================================
// ОТображение
// =========================================================================
window.CoopChat.addMsg = function(text, isSelf, sender) {
    var div = document.createElement('div');
    div.className = 'chat-msg ' + (isSelf ? 'self' : 'partner');
    
    var time = new Date().toLocaleTimeString('en-US', {hour:'2-digit',minute:'2-digit'});
    var nick = isSelf ? this.nickname : (sender || this.partnerNickname || '?');
    
    div.innerHTML = '<span class="nick">' + this.esc(nick) + '</span>: ' + 
                    this.esc(text) + ' <span class="time">' + time + '</span>';
    
    var container = document.getElementById('coop-chat-messages');
    container.appendChild(div);
    container.scrollTop = 999999;
};

window.CoopChat.addSystem = function(text) {
    var div = document.createElement('div');
    div.className = 'chat-msg system';
    div.textContent = '> ' + text;
    
    var container = document.getElementById('coop-chat-messages');
    container.appendChild(div);
    container.scrollTop = 999999;
};

window.CoopChat.esc = function(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
};

// =========================================================================
// ИНТЕГРАЦИЯ С COOPNETWORK
// =========================================================================

// Перехват setupConnection - создаём чат и спрашиваем ник
var _origSetupConn = Scene_Coop.prototype.setupConnection;
Scene_Coop.prototype.setupConnection = function(isLoad) {
    _origSetupConn.call(this, isLoad);
    
    // Создаём HTML
    window.CoopChat.createHtmlInterface();
    
    // Спрашиваем ник
    setTimeout(function() {
        window.CoopChat.askNick();
    }, 500);
    
    // Слушаем сообщения от партнёра
    if (window.CoopNetwork.connection) {
        window.CoopNetwork.connection.on('data', function(data) {
            if (data.type === 'chat_message') {
                window.CoopChat.receive(data.payload.text, data.payload.sender);
            }
            else if (data.type === 'nickname_update') {
                window.CoopChat.partnerNickname = data.payload.nickname;
                window.CoopChat.addSystem(data.payload.nickname + ' connected');
            }
        });
    }
};

// =========================================================================
// INPUT - ИСПРАВЛЕННЫЙ ПЕРЕХВАТ (без блокировки Backspace!)
// =========================================================================
var _origInputUpdate = Input.update;
Input.update = function() {
    _origInputUpdate.call(this);
    
    // Если фокус в поле ввода чата - НЕ перехватываем клавиши!
    if (window.CoopChat.isInputFocused) return;
    
    // Enter открывает чат только на карте и когда есть соединение
    if (Input.isTriggered('ok') && SceneManager._scene instanceof Scene_Map) {
        if (!$gameMessage.isBusy() && !$gameMap.isEventRunning()) {
            if (window.CoopNetwork && window.CoopNetwork.connection && window.CoopNetwork.connection.open) {
                window.CoopChat.toggle();
            }
        }
    }
    
    // Escape закрывает чат
    if (Input.isTriggered('cancel') && window.CoopChat.isOpen) {
        window.CoopChat.toggle(false);
    }
};

console.log('[CoopChat] v1.1 loaded (minimal)');