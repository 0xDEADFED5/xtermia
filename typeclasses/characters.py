"""
Characters

Characters are (by default) Objects setup to be puppeted by Accounts.
They are what you "see" in game. The Character class in this module
is setup to be the "default" character type created by the default
creation commands.

"""

from evennia.objects.objects import DefaultCharacter

from .objects import ObjectParent


class Character(ObjectParent, DefaultCharacter):
    """
    The Character defaults to reimplementing some of base Object's hook methods with the
    following functionality:

    at_basetype_setup - always assigns the DefaultCmdSet to this object type
                    (important!)sets locks so character cannot be picked up
                    and its commands only be called by itself, not anyone else.
                    (to change things, use at_object_creation() instead).
    at_post_move(source_location) - Launches the "look" command after every move.
    at_post_unpuppet(account) -  when Account disconnects from the Character, we
                    store the current location in the prelogout_location Attribute and
                    move it to a None-location so the "unpuppeted" character
                    object does not need to stay on grid. Echoes "Account has disconnected"
                    to the room.
    at_pre_puppet - Just before Account re-connects, retrieves the character's
                    prelogout_location Attribute and move it back on the grid.
    at_post_puppet - Echoes "AccountName has entered the game" to the room.

    """
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

