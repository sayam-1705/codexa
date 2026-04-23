# Python fixture with deliberate errors for testing

# This line is intentionally very long to trigger E501 line-too-long error: this_is_a_very_long_line_that_definitely_exceeds_the_default_88_character_limit_for_ruff_checking

unused_variable = 42

import os
import sys

from os import path
from sys import argv  # F401 unused import

def test():
    x = 1
    return x

if __name__ == '__main__':
    test()
