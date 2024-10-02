"""
Characters

Characters are (by default) Objects setup to be puppeted by Accounts.
They are what you "see" in game. The Character class in this module
is setup to be the "default" character type created by the default
creation commands.

"""

from evennia import AttributeProperty
from evennia.objects.objects import DefaultCharacter, DefaultObject
from typing import Callable
from .objects import ObjectParent
from commands.examples import TEMPLATE


class Character(ObjectParent, DefaultCharacter, DefaultObject):
    def at_init(self):
        self._callbacks = {}
        return super().at_init()
    def add_callback(self, key: str, func: Callable[[list, dict], None], *user):
        """
        basic non-persistent callbacks
        add callback function to the list which matches (key), here's the callback function signature:
            callback(*user, **system) -> None
            *user = user arguments sent from add_callback
            **system will be whatever data is being sent by the event
        Args:
            key (str): name the callback, later on this is the name you'll use to fire the callbacks
            func (Callable): the callback function
            *user: arguments to pass to the callback
        defined callbacks:
            key = 'term_size', fired when the webclient terminal is resized.
                system['data'] in callback = tuple (terminal width, terminal height)
            key = 'interact', fired when the webclient is in interactive mode and a key is pressed.
                system['data'] in callback = raw key data
            key = 'map_size', fired after 'get_map_size' is sent, or when webclient is resized while
                map is enabled
        """
        callback_list = self._callbacks.get(key, None)
        if callback_list is None:
            self._callbacks[key] = [(func, *user)]
        else:
            callback_list.append((func, *user))

    def remove_callback(self, key: str):
        del self._callbacks[key]

    def fire_callbacks(self, key: str, **system):
        """
        fire the callbacks that match (key)
        **system will be sent to each callback
        Args:
            key (str): the callbacks to fire, this is the key you used in add_callback
            **system: data to send to the callback
        """
        callbacks = self._callbacks.get(key, None)
        if callbacks is not None:
            for func, *user in callbacks:
                func(*user, **system)

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
                if c.startswith("@"):
                    cmd_list.append(c[1:])
        self.msg(player_commands=cmd_list)
        self.msg(prompt=">")
        map_enabled = self.db.map_enabled
        if map_enabled is True:
            self.msg(map_enable="")
            self.msg(map={'map':TEMPLATE.format(label="Example!", instructions=''), 'pos':(0,0)})
        super().at_post_puppet(**kwargs)
