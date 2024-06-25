from .examples import CmdInteract, CmdClearscreen, CmdPauseAudio, CmdTestAudio, CmdUpdateCompletions
import evennia


class ExampleCmdSet(evennia.CmdSet):
    def at_cmdset_creation(self):
        self.add(CmdInteract)
        self.add(CmdPauseAudio)
        self.add(CmdTestAudio)
        self.add(CmdUpdateCompletions)
        self.add(CmdClearscreen)
