#!/usr/bin/env python3
"""Unit tests for the BB Command Center document-base contract."""

from __future__ import annotations

import unittest

from check_bb_command_center_document_base import BaseElementParser


class BaseElementParserTests(unittest.TestCase):
    def parse(self, markup: str) -> list[dict[str, str | None]]:
        parser = BaseElementParser()
        parser.feed(markup)
        parser.close()
        return parser.base_elements

    def test_allows_document_without_base_element(self) -> None:
        self.assertEqual(self.parse('<html><head><title>BB</title></head></html>'), [])

    def test_rejects_base_element_with_href(self) -> None:
        self.assertEqual(
            self.parse('<head><base href="https://example.invalid/"></head>'),
            [{"href": "https://example.invalid/"}],
        )

    def test_rejects_attribute_free_base_element(self) -> None:
        self.assertEqual(self.parse('<head><base></head>'), [{}])

    def test_rejects_self_closing_base_element(self) -> None:
        self.assertEqual(self.parse('<head><base target="_blank" /></head>'), [{"target": "_blank"}])

    def test_tag_matching_is_case_insensitive(self) -> None:
        self.assertEqual(self.parse('<head><BASE href="/"></head>'), [{"href": "/"}])

    def test_records_every_base_element(self) -> None:
        self.assertEqual(
            self.parse('<base href="/one/"><base href="/two/">'),
            [{"href": "/one/"}, {"href": "/two/"}],
        )


if __name__ == "__main__":
    unittest.main()
