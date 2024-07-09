from .examples import CmdInteract, CmdClearscreen, CmdPauseAudio, CmdTestAudio, CmdUpdateCompletions, CmdMapOff, CmdMapOn, CmdMapTest, CmdResizeCallbackTest
import evennia


class ExampleCmdSet(evennia.CmdSet):
    def at_cmdset_creation(self):
        self.add(CmdInteract)
        self.add(CmdPauseAudio)
        self.add(CmdTestAudio)
        self.add(CmdUpdateCompletions)
        self.add(CmdClearscreen)
        self.add(CmdMapOff)
        self.add(CmdMapOn)
        self.add(CmdMapTest)
        self.add(CmdResizeCallbackTest)
