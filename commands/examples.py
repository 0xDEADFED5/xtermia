from commands.command import Command
from world.callbacks import add_interact_callback, remove_interact_callback


TEMPLATE = """
Use arrow keys to move, ESC to exit, or SPACE to mark cell
        
 ┌─────────┐
3│         │
2│         │
1│         │
0│         │
 └─────────┘
  012345678

{label}
"""
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

    def i_callback(self, caller, msg):
        cursor_x = caller.ndb.cursor_x
        cursor_y = caller.ndb.cursor_y
        marked = caller.ndb.marked
        match msg:
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
                remove_interact_callback(caller, self.i_callback)  # remove callback
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
        # place label 1 line up from where interactive_start was sent:
        caller.msg(pos_text=(0,1,label))
        caller.ndb.cursor_x = cursor_x
        caller.ndb.cursor_y = cursor_y
        caller.ndb.marked = marked

    def func(self):
            caller = self.caller
            label = LABEL.format(x=0,y=0)
            template = TEMPLATE.format(label=label)
            caller.msg(raw_text=template)  # raw_text sends the string as-is, default text will append '\r\n'
            add_interact_callback(caller, self.i_callback)  # this callback gets called for every keypress after interactive_start
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
    help_category = 'General'

    def func(self):
        caller = self.caller
        caller.msg(text=('\033[2J', {'type': 'clearscreen'}))
