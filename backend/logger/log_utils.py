import logging


def setup_logger(name="Multi-Agent-logger"):
    """
    Sets up a standard Python logger with a StreamHandler (console output).
    """
    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG)

    ch = logging.StreamHandler()
    ch.setLevel(logging.DEBUG)

    # Improved formatter with module name and line number
    formatter = logging.Formatter(
        "[%(asctime)s] [%(levelname)s] [%(name)s] [%(module)s:%(lineno)d] --- %(message)s"
    )
    ch.setFormatter(formatter)

    # This check prevents duplicate log messages if setup_logger is called multiple times.
    if not logger.handlers:
        logger.addHandler(ch)

    return logger