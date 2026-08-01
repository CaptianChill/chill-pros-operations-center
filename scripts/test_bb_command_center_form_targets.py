#!/usr/bin/env python3
"""Regression tests for BB Command Center form-target validation."""

from __future__ import annotations

import unittest

from scripts.check_bb_command_center_form_targets import FormTargetParser, validate_form_targets


class FormTargetParserTests(unittest.TestCase):
    def test_collects_form_and_submitter_targets_in_source_order(self) -> None:
        parser = FormTargetParser()
        parser.feed(
            '<form action="owner-command-center.html">'
            '<button formaction="owner-command-center.html?view=quick">Open</button>'
            '<input type="submit" formaction="https://example.com/submit">'
            '</form>'
        )
        parser.close()

        self.assertEqual(
            parser.targets,
            [
                ("action", "owner-command-center.html"),
                ("formaction", "owner-command-center.html?view=quick"),
                ("formaction", "https://example.com/submit"),
            ],
        )

    def test_ignores_empty_targets(self) -> None:
        parser = FormTargetParser()
        parser.feed('<form action=""><button formaction>Submit</button></form>')
        parser.close()

        self.assertEqual(parser.targets, [])


class FormTargetValidationTests(unittest.TestCase):
    def test_allows_existing_local_and_explicit_https_targets(self) -> None:
        validate_form_targets(
            '<form action="owner-command-center.html"></form>'
            '<button formaction="https://example.com/submit">Submit</button>'
        )

    def test_rejects_active_content_and_non_web_schemes(self) -> None:
        for target in (
            "javascript:alert(1)",
            "data:text/html,<script>alert(1)</script>",
            "vbscript:msgbox(1)",
            "file:///etc/passwd",
            "mailto:owner@example.com",
        ):
            with self.subTest(target=target), self.assertRaises(SystemExit):
                validate_form_targets(f'<form action="{target}"></form>')

    def test_rejects_protocol_relative_and_control_character_targets(self) -> None:
        for target in ("//example.com/submit", "java\nscript:alert(1)"):
            with self.subTest(target=target), self.assertRaises(SystemExit):
                validate_form_targets(f'<button formaction="{target}">Submit</button>')

    def test_rejects_repository_escape_and_missing_local_targets(self) -> None:
        for target in ("../outside.html", "missing-submit-handler.html"):
            with self.subTest(target=target), self.assertRaises(SystemExit):
                validate_form_targets(f'<form action="{target}"></form>')


if __name__ == "__main__":
    unittest.main()
