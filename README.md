## xterm.js webclient for Evennia
This replaces the webclient of an [Evennia](https://github.com/evennia/evennia/tree/main) game with the [xterm.js](https://github.com/xtermjs/xterm.js) terminal emulator.
This is based on a modified and updated [fluffos](https://github.com/fluffos/fluffos/tree/master/src/www) webclient.
There are 2 example commands "testaudio" and "pauseaudio" which show how to play sounds/music in the webclient.

### Features
- Really fast, does terminal stuff
- Up arrow for command history
- Tells Evennia the terminal width/height at startup and on resize
- All files are local, no internet required
- Uses [Fira Code](https://github.com/tonsky/FiraCode) font because it has great box drawing characters
- See commands/testaudio.py for an example on how to play/pause sound in the webclient

### Notes
- There's mobile-specific code that I haven't actually been able to test, the font size might need to be adjusted

### Installation
Back up your existing game folder.
Copy this entire folder structure to your Evennia "mygame" game folder.

Add this line to your mygame/server/conf/settings.py:

`WEBSOCKET_PROTOCOL_CLASS = "server.portal.webclient.WebSocketClient"`

### File sources
- addon-fit.js = npm install --save @xterm/addon-fit
- addon-unicode11.js = npm install --save @xterm/addon-unicode11
- addon-webgl.js = npm install --save @xterm/addon-webgl
- base.html = adapted from: https://github.com/evennia/evennia/blob/main/evennia/web/templates/webclient/base.html
- FiraCode-VariableFont_wght.ttf = https://github.com/tonsky/FiraCode/releases/download/6.2/Fira_Code_v6.2.zip
- fontobserver.js = https://github.com/fluffos/fluffos/tree/master/src/www/fontobserver.js
- jquery-3.7.1.min.js = https://code.jquery.com/jquery-3.7.1.min.js
- normalize.css = https://github.com/fluffos/fluffos/tree/master/src/www/normalize.css
- webclient.js = based on https://github.com/fluffos/fluffos/tree/master/src/www/example.js
- webclient.py = https://github.com/evennia/evennia/blob/main/evennia/server/portal/webclient.py
- xterm.css = npm install @xterm/xterm
- xterm.js = ""