"""Read-only pricing/SEO regression checks; synthetic feeds, no network."""
import html
import importlib.util
import json
import re
import tempfile
import unittest
from pathlib import Path
from io import BytesIO
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("prerender", ROOT / "scripts/prerender.py")
prerender = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prerender)


class PrerenderTests(unittest.TestCase):
    def test_published_feed_wins_over_older_implicit_local_cache(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / 'data').mkdir()
            (root / 'data/deals.json').write_text('[{"id":"old"}]', encoding='utf-8')
            with patch.object(prerender, 'REPO_ROOT', root), patch.object(prerender.urllib.request, 'urlopen', return_value=BytesIO(b'[{"id":"fresh"}]')):
                result = prerender.load_render_data('deals.json', 'https://example.test/', required=True)
            self.assertEqual(result, [{'id': 'fresh'}])

    def test_all_count_fields_and_both_intro_fields_follow_one_catalog(self):
        content = ('<span data-plan-count>99</span><span data-plan-count>99</span>'
                   '<span data-min-price>$1</span><span class="value" data-min-intro>$1/mo</span>')
        result = prerender.update_speed_summary(content, [
            {"promoPrice": 49.99, "regularPrice": 80},
            {"promoPrice": None, "regularPrice": 60},
        ])
        self.assertEqual(result.count('data-plan-count>2</span>'), 2)
        self.assertIn('data-min-price>$49.99</span>', result)
        self.assertIn('data-min-intro>$49.99/mo</span>', result)

    def test_empty_catalog_clears_stale_prices_without_inventing_free_offer(self):
        result = prerender.update_speed_summary('<span data-plan-count>3</span><span data-min-price>$50</span>', [])
        self.assertIn('data-plan-count>0</span>', result)
        self.assertIn('data-min-price>Unavailable</span>', result)
        self.assertNotIn('$0', result)

    def test_explicit_local_snapshot_never_fetches_remote_optional_data(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            (folder / 'deals.json').write_text('[{"id":"synthetic"}]', encoding='utf-8')
            with patch.object(prerender.urllib.request, 'urlopen') as remote:
                self.assertEqual(prerender.load_render_data('deals.json', 'https://example.test/', folder, True), [{'id': 'synthetic'}])
                self.assertEqual(prerender.load_render_data('bundles.json', 'https://example.test/', folder), [])
                remote.assert_not_called()

    def test_missing_empty_or_malformed_required_snapshot_stops_build(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            with self.assertRaises(RuntimeError):
                prerender.load_render_data('deals.json', 'https://example.test/', folder, True)
            for value in ('[]', '{}'):
                (folder / 'deals.json').write_text(value, encoding='utf-8')
                with self.assertRaises(RuntimeError):
                    prerender.load_render_data('deals.json', 'https://example.test/', folder, True)

    def test_updated_price_faqs_match_visible_copy_and_structured_data(self):
        checked = 0
        for filename in ('nbn-50', 'nbn-100', 'nbn-1000'):
            content = (ROOT / 'deals' / filename / 'index.html').read_text(encoding='utf-8')
            for raw in re.findall(r'<script type="application/ld\+json">(.*?)</script>', content, flags=re.S):
                for entity in json.loads(raw).get('@graph', []):
                    if entity.get('@type') != 'FAQPage':
                        continue
                    for question in entity['mainEntity']:
                        if not re.search(r'(?:competitive|fair) price', question['name'], re.I):
                            continue
                        answer = question['acceptedAnswer']['text']
                        details = next(block for block in re.findall(r'<details\b[^>]*>.*?</details>', content, flags=re.S)
                                       if question['name'] in html.unescape(re.sub('<[^>]*>', '', block)))
                        visible = re.search(r'<div class="deals-faq-answer">\s*<p>(.*?)</p>', details, flags=re.S)[1]
                        self.assertEqual(html.unescape(re.sub('<[^>]*>', '', visible)).strip(), answer)
                        self.assertNotRegex(answer, r'\$\d')
                        checked += 1
        self.assertEqual(checked, 3)

    def test_all_existing_splice_markers_remain_paired(self):
        for path in [ROOT / 'deals/index.html', *list((ROOT / 'deals').glob('nbn-*/index.html'))]:
            content = path.read_text(encoding='utf-8')
            starts = re.findall(r'<!-- PRERENDER:([A-Z]+):START -->', content)
            ends = re.findall(r'<!-- PRERENDER:([A-Z]+):END -->', content)
            self.assertEqual(sorted(starts), sorted(ends), path)
            self.assertEqual(len(starts), len(set(starts)), path)


if __name__ == '__main__':
    unittest.main()
