from .examples import CmdInteract, CmdClearscreen
import evennia


class ExampleCmdSet(evennia.CmdSet):
    def at_cmdset_creation(self):
        self.add(CmdInteract)
        # self.add(CmdClearscreen)
