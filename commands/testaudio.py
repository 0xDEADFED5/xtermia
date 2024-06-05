from commands.command import Command


class CmdTestAudio(Command):
    key = "@testaudio"
    help_category = "Testing"

    def func(self):
        caller = self.caller
        sessions = caller.sessions.get()
        if sessions and len(sessions) > 0:
            caller.msg('Playing "test.m4a" ...')
            sessions[0].msg(audio="/static/webclient/audio/test.m4a")


class CmdPauseAudio(Command):
    key = "@pauseaudio"
    help_category = "Testing"

    def func(self):
        caller = self.caller
        sessions = caller.sessions.get()
        if sessions and len(sessions) > 0:
            caller.msg('Pausing sound player ...')
            sessions[0].msg(audiopause="")
