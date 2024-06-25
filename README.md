## xterm.js webclient for Evennia
This replaces the webclient of an [Evennia](https://github.com/evennia/evennia/tree/main) game with the [xterm.js](https://github.com/xtermjs/xterm.js) terminal emulator.
This is a demo that you can copy over a freshly initialized Evennia game.

![screenshot](./term.png)

### Features
- No more input box, type directly into the terminal like it's 1984
- Really fast, does terminal stuff
- Up/down arrow to scroll through command history
- Start typing to see completion suggestions, Right-arrow or Tab to accept the current suggestion
- Ctrl+C to copy, Ctrl+V to paste in addition to the right-click copy/paste
- Clickable web links
- Completion suggestions based on Evennia commands available at login
- Tells Evennia the terminal width/height at startup and on resize
- Sound/music (see "commands/examples.py")
- Interactive terminal mode (see "commands/examples.py") for an example, or type 'interact' inside Evennia
- Uses "CACHE BUSTERRRR" from https://github.com/InspectorCaracal/evelite-client/tree/main
- All files are local, no internet required
- Uses [Fira Code](https://github.com/tonsky/FiraCode) font because it has great box drawing characters

### Installation for a fresh game
Copy this repo's entire folder structure to your Evennia "mygame" game folder.
NOTE: 
- `/server/conf/settings.py` ***WILL BE OVERWRITTEN***
- `/typeclasses/characters.py` ***WILL BE OVERWRITTEN***

### Installation for an existing game
Back up your existing game folder.
Copy this repo's entire folder structure to your Evennia "mygame" game folder,
but ***MAKE SURE NOT TO OVERWRITE*** the two files listed above.

Add these lines to your mygame/server/conf/settings.py:
```
WEBSOCKET_PROTOCOL_CLASS = "server.portal.webclient.WebSocketClient"
TEMPLATES[0]["OPTIONS"]["context_processors"].append("web.custom_context.extra_context")
```

Add this to your mygame/typeclasses/characters.py `Character` class:

```
def at_post_puppet(self, **kwargs):
	"""
	send command completion list to webclient at login and set a default prompt
	"""
	cmdset = self.cmdset
	cmd_list = []
	if cmdset.cmdset_stack:
		cmds = cmdset.cmdset_stack[0].get_all_cmd_keys_and_aliases()
		for c in cmds:
			cmd_list.append(c)
			if c.startswith('@'):
				cmd_list.append(c[1:])
	self.msg(player_commands=cmd_list)
	self.msg(prompt='>')
	super().at_post_puppet(**kwargs)
```

### File sources
- addon-fit.js = npm install @xterm/addon-fit
- addon-unicode11.js = npm install @xterm/addon-unicode11
- addon-webgl.js = npm install @xterm/addon-webgl
- FiraCode-VariableFont_wght.ttf = https://github.com/tonsky/FiraCode/releases/download/6.2/Fira_Code_v6.2.zip
- webclient.py = https://github.com/evennia/evennia/blob/main/evennia/server/portal/webclient.py
- xterm.css = npm install @xterm/xterm
- xterm.js = ""