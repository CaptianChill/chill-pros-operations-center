#!/usr/bin/env python3
"""Unit tests for the BB Command Center structural contract helpers."""

from __future__ import annotations

import unittest

from scripts.check_bb_command_center_visual_contract import (
    CommandCenterHTMLParser,
    validate_local_references,
)


class CommandCenterHTMLParserTests(unittest.TestCase):
    def parse(self, html: str) -> CommandCenterHTMLParser:
        parser = CommandCenterHTMLParser()
        parser.feed(html)
        parser.close()
        return parser

    def test_collects_unique_ids_and_references(self) -> None:
        parser = self.parse(
            '<main id="dashboard"><a href="#projects">Projects</a>'
            '<section id="projects"><img src="assets/logo.svg" alt=""></section></main>'
        )

        self.assertEqual(parser.ids, {"dashboard", "projects"})
        self.assertEqual(parser.duplicate_ids, set())
        self.assertEqual(
            parser.references,
            [("href", "#projects"), ("src", "assets/logo.svg")],
        )

    def test_records_duplicate_ids(self) -> None:
        parser = self.parse('<section id="quick"></section><aside id="quick"></aside>')

        self.assertEqual(parser.ids, {"quick"})
        self.assertEqual(parser.duplicate_ids, {"quick"})

    def test_ignores_missing_and_empty_reference_attributes(self) -> None:
        parser = self.parse('<a href>Missing</a><img src="" alt=""><div id="status"></div>')

        self.assertEqual(parser.references, [])
        self.assertEqual(parser.ids, {"status"})

    def test_preserves_reference_order_for_deterministic_failures(self) -> None:
        parser = self.parse(
            '<link href="first.css"><script src="second.js"></script>'
            '<a href="#third">Third</a>'
        )

        self.assertEqual(
            parser.references,
            [("href", "first.css"), ("src", "second.js"), ("href", "#third")],
        )


class LocalReferenceValidationTests(unittest.TestCase):
    def test_rejects_active_content_schemes_case_insensitively(self) -> None:
        for reference in (
            "javascript:alert(1)",
            "JaVaScRiPt:void(0)",
            "vbscript:msgbox(1)",
            "VbScRiPt:execute()",
        ):
            with self.subTest(reference=reference), self.assertRaises(SystemExit):
                validate_local_references(f'<a href="{reference}">Unsafe</a>')

    def test_rejects_control_characters_in_references(self) -> None:
        for reference in ("java\nscript:alert(1)", "assets/logo.svg\x7f"):
            with self.subTest(reference=reference), self.assertRaises(SystemExit):
                validate_local_references(f'<a href="{reference}">Unsafe</a>')

    def test_allows_mail_and_phone_links(self) -> None:
        validate_local_references(
            '<a href="mailto:owner@example.com">Email</a>'
            '<a href="tel:+12105550100">Call</a>'
        )


if __name__ == "__main__":
    unittest.main()
