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
        sessions[0].msg(audiopause="")
