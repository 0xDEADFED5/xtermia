from commands.command import Command


class CmdTestAudio(Command):
    key = "@testaudio"
    help_category = "Testing"

    def func(self):
        caller = self.caller
        sessions = caller.sessions.get()
        sessions[0].msg(audio="/static/webclient/audio/test.m4a")


class CmdPauseAudio(Command):
    key = "@pauseaudio"
    help_category = "Testing"

    def func(self):
        caller = self.caller
        sessions = caller.sessions.get()
        sessions[0].msg(audio_pause="")

        
class CmdInteractiveStart(Command):
    key = "@interactstart"
    help_category = "Testing"

    def func(self):
        caller = self.caller
        sessions = caller.sessions.get()
        sessions[0].msg(interactive_start="")

        
class CmdInteractiveEnd(Command):
    key = "@interactend"
    help_category = "Testing"

    def func(self):
        caller = self.caller
        sessions = caller.sessions.get()
        sessions[0].msg(interactive_end="")

        
class CmdUpdateCompletions(Command):
    key = "@updatecompletions"
    help_category = "Testing"

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
        sessions = self.sessions.get()
        sessions[0].msg(player_commands=cmd_list)

