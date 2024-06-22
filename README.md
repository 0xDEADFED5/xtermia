## xterm.js webclient for Evennia
This replaces the webclient of an [Evennia](https://github.com/evennia/evennia/tree/main) game with the [xterm.js](https://github.com/xtermjs/xterm.js) terminal emulator.

### Features
- No more input box, type directly into the terminal like it's 1984
- Really fast, does terminal stuff
- Up/down arrow to scroll through command history
- Start typing to see completion suggestions, Right-arrow or Tab to accept the current suggestion
- At login Evennia will send available commands, these will be used for completion suggestions as well as history
- Tells Evennia the terminal width/height at startup and on resize
- Evennia can tell webclient to enter "interactive mode", which makes arrow keys move the cursor around
- Uses "CACHE BUSTERRRR" from https://github.com/InspectorCaracal/evelite-client/tree/main
- All files are local, no internet required
- Uses [Fira Code](https://github.com/tonsky/FiraCode) font because it has great box drawing characters
- See commands/examples.py for examples using the OOB commands

### Installation
Back up your existing game folder.
Copy this entire folder structure to your Evennia "mygame" game folder.

Add these lines to your mygame/server/conf/settings.py:
```
WEBSOCKET_PROTOCOL_CLASS = "server.portal.webclient.WebSocketClient"
TEMPLATES[0]["OPTIONS"]["context_processors"].append("web.custom_context.extra_context")
```

Add this to your mygame/typeclasses/characters.py `Character` class if you want command completion hints:

```
def at_post_puppet(self, **kwargs):
	cmdset = self.cmdset
	cmd_list = []
	if cmdset.cmdset_stack:
		cmds = cmdset.cmdset_stack[0].get_all_cmd_keys_and_aliases()
		for c in cmds:
			cmd_list.append(c)
			if c.startswith('@'):
				cmd_list.append(c[1:])
	sessions = self.sessions.get()
	sessions[0].msg(player_commands=cmd_list)
	super().at_post_puppet(**kwargs)
```

### File sources
- addon-fit.js = npm install --save @xterm/addon-fit
- addon-unicode11.js = npm install --save @xterm/addon-unicode11
- addon-webgl.js = npm install --save @xterm/addon-webgl
- FiraCode-VariableFont_wght.ttf = https://github.com/tonsky/FiraCode/releases/download/6.2/Fira_Code_v6.2.zip
- webclient.py = https://github.com/evennia/evennia/blob/main/evennia/server/portal/webclient.py
- xterm.css = npm install @xterm/xterm
- xterm.js = ""