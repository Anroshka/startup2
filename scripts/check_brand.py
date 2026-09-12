"""Validate deliverable integrity and local README links. Run from any directory."""
from pathlib import Path
import re, json, xml.etree.ElementTree as ET
from PIL import Image
from pypdf import PdfReader
ROOT=Path(__file__).resolve().parents[1]
checks=[]
for p in (ROOT/'assets/source').glob('*.svg'):
    tree=ET.parse(p)
    assert tree.getroot().tag.endswith('svg'),p
    text=p.read_text()
    assert not re.search(r'<(?:script|image|text)\b|(?:href|url)\s*[=(]',text),p
    checks.append(p)
for p in (ROOT/'assets').glob('*.png'):
    with Image.open(p) as im: im.verify()
    checks.append(p)
for file in ['README.md','brand/README.md']:
    p=ROOT/file;text=p.read_text()
    urls=re.findall(r'\]\(([^)]+)\)|src="([^"]+)"',text)
    for pair in urls:
        link=next(x for x in pair if x)
        if link.startswith(('http','#')):continue
        assert (p.parent/link.split('#')[0]).exists(),(file,link)
r=PdfReader(ROOT/'brand/JobPilot_Brandbook.pdf',strict=True)
assert len(r.pages)==14
for i,page in enumerate(r.pages):
    txt=page.extract_text()
    assert 'JobPilot' in txt and len(txt)>150,(i,txt)
    assert '\ufffd' not in txt
json.loads((ROOT/'brand/tokens.json').read_text())
print(f'OK: {len(checks)} images, 14 PDF pages, JSON tokens, local Markdown links.')
