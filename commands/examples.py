from commands.command import Command
from evennia.utils.ansi import ANSIString, ANSIParser
import colorsys

TEMPLATE = """
{instructions}
        
 ┌─────────┐
3│         │
2│         │
1│         │
0│         │
 └─────────┘
  012345678

{label}
"""
INST = 'Use arrow keys to move, ESC to exit, or SPACE to mark cell'
LABEL = "Status: cursor at ({x},{y})"
EXIT_LABEL = "Status: exiting ..."
BOX_WIDTH = 9
BOX_HEIGHT = 4

class CmdInteract(Command):
    """
    interactive terminal demo

    when you put the webclient into interactive mode each keypress will be sent over the websocket
    to a callback. nothing gets printed on the webclient until you respond back and tell
    it to.  

    available OOB commands not shown here:
        caller.msg(cursor_home='') = this will move the cursor back to where it was
        when interactive mode was started
    """
    key = "interact"
    help_category = "Examples"

    def i_callback(self, *user, **callback):
        data = callback['data']
        caller = user[0]
        cursor_x = caller.ndb.cursor_x
        cursor_y = caller.ndb.cursor_y
        marked = caller.ndb.marked
        match data:
            case '\u001b[A':  # up arrow
                if cursor_y < BOX_HEIGHT - 1:  # keep the cursor inside box
                    caller.msg(cursor_up='')  # move cursor up on the webclient
                    cursor_y += 1
                else:
                    return
            case '\u001b[B':  # down arrow
                if cursor_y > 0:
                    caller.msg(cursor_down='')  # move cursor down on the webclient
                    cursor_y -= 1
                else:
                    return
            case '\u001b[C':  # right arrow
                if cursor_x < BOX_WIDTH - 1:
                    caller.msg(cursor_right='')  # move cursor right on the webclient
                    cursor_x += 1
                else:
                    return
            case '\u001b[D':  # left arrow
                if cursor_x > 0:
                    caller.msg(cursor_left='')  # move cursor left on the webclient
                    cursor_x -= 1
                else:
                    return
            case '\u001b':  # escape
                # clear the original label line because our exit label is shorter
                # we could also just add spaces to the end of EXIT_LABEL
                # we could even move the cursor there and send delete keys
                # line number is relative to where interactive_start was sent
                # positive line numbers go up, negative go down, 0 clears the current line
                caller.msg(clear_line=1)  # go up a line and clear it
                caller.msg(pos_text=(0, 1, EXIT_LABEL))
                caller.msg(interactive_end='')  # tell the webclient to go back to normal
                caller.remove_callback('interact')  # remove callback
                coord_str = ''  # build up a simple string of our results
                for k, v in marked.items():
                    if v:
                        coord_str += str(k) + ' '
                if coord_str != '':
                    caller.msg(raw_text=f"The following coords were marked:\r\n{coord_str}\r\n")
                # any text with a type gets a prompt (if set):
                caller.msg(text=('Interactive demo exited.', {'type': 'interact'}))
                return
            case ' ':  # space is pressed
                if (cursor_x,cursor_y) in marked:  # have we already marked or unmarked this coordinate before?
                    val = marked[(cursor_x,cursor_y)]  # is current coordinate marked(True) or not
                    if (val):
                        caller.msg(insert_text=' ') # it's being unmarked, overwrite the 'X' with ' ' to remove it
                    else:
                        caller.msg(insert_text='X')
                    marked[(cursor_x,cursor_y)] = not val  # invert the value
                else:
                    marked[(cursor_x,cursor_y)] = True
                    caller.msg(insert_text='X')  # insert_text prints raw text on the webclient and then moves the cursor back
            case _:
                return
        label = LABEL.format(x=cursor_x,y=cursor_y)
        # pos_text and pos_cursor take a relative position from the START of the line when interactive_start was sent
        # the arguments are: [column,row,text]
        # negative column value moves cursor left, positive value moves it right
        # negative row value moves cursor down, positive value moves it up
        # it's x,y coordinates basically with (0,0) being beginning of row at interactive_start
        caller.msg(pos_text=(0,1,label)) # place label 1 line up from where interactive_start was sent
        caller.ndb.cursor_x = cursor_x
        caller.ndb.cursor_y = cursor_y
        caller.ndb.marked = marked

    def func(self):
            caller = self.caller
            label = LABEL.format(x=0,y=0)
            template = TEMPLATE.format(label=label, instructions=INST)
            caller.msg(raw_text=template)  # raw_text sends the string as-is, default text will append '\r\n'
            caller.add_callback('interact', self.i_callback, caller)  # this callback gets called for every keypress after interactive_start
            caller.msg(interactive_start='')  # put the webclient into interactive mode
            caller.msg(pos_text=(0,1,label))  # see the explanation of pos_text above
            # place initial cursor position right 2 places and up 5 places from the bottom left of template
            # see pos_text above for more detail on how relative positions work
            # this matches 0,0 inside the box in the TEMPLATE above
            caller.msg(pos_cursor=(2,5))
            caller.ndb.cursor_x = 0
            caller.ndb.cursor_y = 0
            caller.ndb.marked = {}

class CmdUpdateCompletions(Command):
    """
    update the list of command completion hints on the webclient
    """
    key = 'updatecompletions'
    help_category = 'Examples'

    def func(self):
        caller = self.caller
        cmdset = caller.cmdset
        cmd_list = []
        if cmdset.cmdset_stack:
            cmds = cmdset.cmdset_stack[0].get_all_cmd_keys_and_aliases()
            for c in cmds:
                cmd_list.append(c)
                if c.startswith('@'):
                    cmd_list.append(c[1:])
        caller.msg(player_commands=cmd_list)
        caller.msg(text=(f"Completion hints updated: {str(cmd_list)}", {'type': 'completions'}))

class CmdTestAudio(Command):
    """
    play an audio sample on the webclient
    """
    key = 'testaudio'
    help_category = 'Examples'

    def func(self):
        caller = self.caller
        caller.msg(audio='/static/webclient/audio/test.m4a')
        caller.msg(text=('Playing audio ...', {'type': 'audio'}))


class CmdPauseAudio(Command):
    """
    pause audio playing on the webclient
    """
    key = 'pauseaudio'
    help_category = 'Examples'

    def func(self):
        caller = self.caller
        caller.msg(audio_pause='')
        caller.msg(text=('Pausing audio ...', {'type': 'audio'}))

class CmdClearscreen(Command):
    """
    clears the screen
    """
    key = 'cls'
    help_category = 'Examples'

    def func(self):
        caller = self.caller
        caller.msg(text=('\x1b[2J', {'type': 'clearscreen'}))

    
class CmdMapOn(Command):
    """
    enables the map in webclient
    for now the map takes up right half of terminal and isn't adjustable
    when map is enabled, the webclient reports a new terminal width to Evennia (current width/2)
    """
    key = 'mapon'
    help_category = 'Examples'

    def func(self):
        caller = self.caller
        caller.db.map_enabled = True
        caller.msg(map_enable='')
        caller.msg(text=('Map pane enabled on webclient.', {'type': 'map_enable'}))
        

class CmdMapOff(Command):
    """
    disables the map in webclient
    """
    key = 'mapoff'
    help_category = 'Examples'

    def func(self):
        caller = self.caller
        caller.db.map_enabled = False
        caller.msg(map_disable='')
        caller.msg(text=('Map pane disabled on webclient.', {'type': 'map_disable'}))


class CmdMapTest(Command):
    """ generate test patterns for map pane and text pane.
        map is cached in webclient and is redrawn every time text is sent from Evennia.
        whenever the map changes send a 'map' command to the webclient with the new map.
        the map will redrawn in the webclient when it's updated.
        how maps currently work:
            maps are centered horizontally and vertically within the right half of the terminal
            webclient will now autoscroll maps that are too large to display
            this requires webclient to know player relative position so it knows which map
            section to draw, see examples below
    """
    key = 'maptest'
    help_category = 'Examples'
    
    @staticmethod
    def colorize(hue: float, bright: float, input: str, ansi=False):
        """ wrap input string with ANSI color or Evennia color tag from HSV hue
        Args:
            hue (float): HSV hue where green = 120.0
            bright (float): 1.0 = 100% brightness
            input (str): string to colorize
            ansi (bool): if True return raw 24-bit ANSI string, otherwise return ANSIString"""
        if hue != 0.0:
            hue /= 360.0
        sat = 1.0
        r, g, b = tuple(round(i * 255) for i in colorsys.hsv_to_rgb(hue, sat, bright))
        if not ansi:
            return f"|#{r:02x}{g:02x}{b:02x}{input}"  # Evennia-style 24-bit color tag
        return f"\x1b[38;2;{r};{g};{b}m{input}"  # raw ANSI color
    
    @staticmethod
    def make_line(width: int, hue=0.0) -> str:
        line = ''
        a = 65
        for _ in range(width):
            char = CmdMapTest.colorize(hue, 1.0, chr(a))
            line = f"{line}|n{char}|n"
            a += 1
            if a == 91:
                a = 65
            hue += 1.0
            if hue > 360.0:
                    hue = 0.0
        return line
    
    @staticmethod
    def make_pattern(width: int, height: int, intro=True, hue=0.0, ansi=False) -> str:
        """ make a colorful little test pattern for map testing.
            color is used for testing 2 things:
            to make sure webclient centers ANSI colored maps properly,
            and to make sure text pane properly line wraps ANSI strings"""
        num = 0
        pattern = ''
        line = ''
        a = 64
        bright = 1.0
        if intro:
            height -= 1
        for _ in range(height):
            line = ''
            num = -1
            for _ in range(width - 1):
                num += 1
                if num == 10:
                    num = 0
                if bright < 0.2:
                    bright = 1.0
                    hue += 1.0
                if hue > 360.0:
                    hue = 0.0
                line = f"{line}{CmdMapTest.colorize(hue, bright, str(num), ansi)}"
                bright -= 0.05
            a += 1
            if a == 91:
                a = 65
            line = f"|n|u{chr(a)}|n{line}\r\n"
            pattern = f"{pattern}{line}"
        if intro:
            return f"({width}X{height + 1}) Lines end: {str(num)} last line start: |u{chr(a)}|n\r\n{pattern}"
        return pattern
    
    def callback(self, *user, **system):
        caller = user[0]  # *user is the list of arguments of sent below from add_callback
        caller.remove_callback('map_size')  # only fire once
        data = system['data']
        """ get max width of map for test pattern.
            because map pane is same size as text pane, we can base the max map size 
            on the current terminal size reported to Evennia """
        max_width = data[0]
        max_height = data[1]
        map_pattern = CmdMapTest.make_pattern(max_width, max_height, True, 0.0, False)
        # set map to test pattern above
        # NOTE: new signature for map command
        # webclient will now scroll the map if it's too big, but to know where to
        # scroll it, it needs to know player position.  however, if you're sure
        # that map doesn't need to be scrolled, you can always send (0,0) as 'pos'
        caller.msg(map={'map':map_pattern, 'pos':(0,0)})
        sessions = caller.sessions.get()
        flags = sessions[0].protocol_flags
        width = flags.get('SCREENWIDTH')[0]
        caller.msg(f"Sending color line of width: ({width}x4)...")
        width *= 4
        text_pattern = CmdMapTest.make_line(width, 240.0)
        caller.msg(text_pattern)

        
    def func(self):
        caller = self.caller
        caller.db.map_enabled = True  # persist map setting
        caller.msg('Enabling map on character and sending test patterns...')
        caller.add_callback('map_size', self.callback, caller) # this is called in response to the 'get_map_size' command below
        caller.msg(map_enable='')  # enable map, webclient will report new terminal size as half the current width
        caller.msg(get_map_size='') # get what the map size would be for current terminal size


class CmdResizeCallbackTest(Command):
    """
    test adding/removing 2 term_size callbacks by running this command and resizing webclient window 
    see server/conf/inputfuncs.py for other available callbacks
    """
    key = 'resizetest'
    help_category = 'Examples'
    callback_fired = False
    
    def callback1(self, *user, **system):
        """
        callback signature requires *arg, **kwargs
        *user = args provided at add_callback
        **system = data provided by inputfuncs.py when the callback is fired
        """
        caller = user[0]
        data = system['data']
        caller.msg(f"Terminal resize callback 1: {str(data)}")
        if self.callback_fired:  # remove callbacks after both have fired
            caller.remove_callback('term_size')  # for now all 'term_size' callbacks are removed at once
            caller.msg(text=('term_size callbacks removed.', {'type': 'resizetest'}))
        self.callback_fired = True
        
    def callback2(self, *user, **system):
        caller = user[0]
        data = system['data']
        caller.msg(f"Terminal resize callback 2: {str(data)}")
        if self.callback_fired:  # remove callbacks after both have fired, this one will probably finish last
            caller.remove_callback('term_size')
            caller.msg(text=('term_size callbacks removed.', {'type': 'resizetest'}))
        self.callback_fired = True
        
    def func(self):
        caller = self.caller
        caller.add_callback('term_size', self.callback1, caller)
        caller.add_callback('term_size', self.callback2, caller)
        caller.msg(text=('2 term_size callbacks added, resize the webclient window to test them!', {'type': 'resizetest'}))
        