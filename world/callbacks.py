_interact_callbacks = []

def add_interact_callback(caller, func):
    _interact_callbacks.append((caller, func))

def remove_interact_callback(caller, func):
    _interact_callbacks.remove((caller, func))

def fire_interact_callbacks(msg: str):
    for c in _interact_callbacks:
        c[1](c[0], msg)