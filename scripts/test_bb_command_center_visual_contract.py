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

    def test_collects_new_tab_link_security_metadata(self) -> None:
        parser = self.parse(
            '<a href="https://example.com" target="_blank" rel="noreferrer">External</a>'
        )

        self.assertEqual(
            parser.blank_target_links,
            [("https://example.com", "noreferrer")],
        )


class LocalReferenceValidationTests(unittest.TestCase):
    def test_rejects_active_content_schemes_case_insensitively(self) -> None:
        for reference in (
            "javascript:alert(1)",
            "JaVaScRiPt:void(0)",
            "vbscript:msgbox(1)",
            "VbScRiPt:execute()",
            "data:text/html,<script>alert(1)</script>",
            "DaTa:image/svg+xml,<svg onload=alert(1)></svg>",
        ):
            with self.subTest(reference=reference), self.assertRaises(SystemExit):
                validate_local_references(f'<a href="{reference}">Unsafe</a>')

    def test_rejects_control_characters_in_references(self) -> None:
        for reference in ("java\nscript:alert(1)", "assets/logo.svg\x7f"):
            with self.subTest(reference=reference), self.assertRaises(SystemExit):
                validate_local_references(f'<a href="{reference}">Unsafe</a>')

    def test_rejects_protocol_relative_external_references(self) -> None:
        for attribute, reference in (
            ("href", "//example.com/account"),
            ("src", "//cdn.example.com/app.js"),
        ):
            with self.subTest(attribute=attribute, reference=reference), self.assertRaises(SystemExit):
                validate_local_references(
                    f'<a {attribute}="{reference}">Protocol-relative</a>'
                )

    def test_allows_explicit_https_references(self) -> None:
        validate_local_references(
            '<a href="https://example.com/account">External</a>'
            '<img src="https://cdn.example.com/logo.svg" alt="">'
        )

    def test_allows_mail_and_phone_links(self) -> None:
        validate_local_references(
            '<a href="mailto:owner@example.com">Email</a>'
            '<a href="tel:+12105550100">Call</a>'
        )

    def test_rejects_unprotected_new_tab_links(self) -> None:
        for rel in ("", "external", "nofollow"):
            with self.subTest(rel=rel), self.assertRaises(SystemExit):
                validate_local_references(
                    f'<a href="https://example.com" target="_blank" rel="{rel}">External</a>'
                )

    def test_allows_new_tab_links_with_opener_protection(self) -> None:
        for rel in ("noopener", "noreferrer", "external NOOPENER"):
            with self.subTest(rel=rel):
                validate_local_references(
                    f'<a href="https://example.com" target="_blank" rel="{rel}">External</a>'
                )


if __name__ == "__main__":
    unittest.main()
