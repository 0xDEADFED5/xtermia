## xterm.js webclient for Evennia
This replaces the webclient of an [Evennia](https://github.com/evennia/evennia/tree/main) game with the [xterm.js](https://github.com/xtermjs/xterm.js) terminal emulator.
This is based on a modified and updated [fluffos](https://github.com/fluffos/fluffos/tree/master/src/www) webclient.

### Features
- Really fast, does terminal stuff
- Up arrow for command history
- All files are local, no internet required
- Uses [Fira Code](https://github.com/tonsky/FiraCode) font because it has great box drawing characters

### Notes
- There's mobile-specific code that I haven't actually been able to test, the font size might need to be adjusted
- Not screenreader compatible, but the OG webclient is

### Installation
Copy this entire folder structure to your Evennia game folder.
NOTE: This will overwrite your current game's typeclasses/accounts.py!
This shouldn't be an issue for most people, but if you have a customized accounts.py of your own,
just comment out the call to `session.msg` from your `at_post_login` function instead.

Add this line to your mygame/server/conf/settings.py:

`WEBSOCKET_PROTOCOL_CLASS = "server.portal.webclient.WebSocketClient"`

### File sources
- addon-attach.js = npm install --save @xterm/addon-attach
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