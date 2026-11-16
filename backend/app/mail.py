"""SMTP transport shared by transactional and confirmation messages."""

import smtplib
import ssl

from flask import current_app


def deliver(messages):
    config = current_app.config
    try:
        if config["SMTP_MODE"] == "ssl":
            connection = smtplib.SMTP_SSL(
                config["SMTP_HOST"],
                config["SMTP_PORT"],
                timeout=5,
                context=ssl.create_default_context(),
            )
        else:
            connection = smtplib.SMTP(config["SMTP_HOST"], config["SMTP_PORT"], timeout=5)
        with connection as smtp:
            if config["SMTP_MODE"] == "starttls":
                smtp.starttls(context=ssl.create_default_context())
            if config["SMTP_USER"]:
                smtp.login(config["SMTP_USER"], config["SMTP_PASSWORD"])
            for message in messages:
                smtp.send_message(message)
        return True
    except (OSError, smtplib.SMTPException):
        current_app.logger.warning("SMTP delivery did not complete.")
        return False
