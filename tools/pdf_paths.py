"""Đọc content stream PDF, trả về các path được tô bằng pattern hoặc màu (tọa độ đã đổi sang hệ top-left giống PyMuPDF)."""
import re, pymupdf
TOK = re.compile(rb'\((?:\\.|[^\\)])*\)|<[0-9A-Fa-f\s]*>|/[^\s/\[\]()<>{}]+|[-+]?(?:\d+\.?\d*|\.\d+)|[A-Za-z*\'"]+|\[|\]')
def fill_paths(pdf_path):
    doc = pymupdf.open(pdf_path); pg = doc[0]
    H = pg.mediabox.height
    s = b''.join(doc.xref_stream(x) for x in pg.get_contents())
    s = re.sub(rb'BT.*?ET', b' ', s, flags=re.S)  # bỏ khối chữ
    stack, fill, ctm_used = [], None, False
    tx, ty = 0.0, 0.0  # chỉ hỗ trợ phép tịnh tiến (đủ cho file này)
    nums, path, cur, out = [], [], [], []
    for t in TOK.findall(s):
        if re.fullmatch(rb'[-+]?(?:\d+\.?\d*|\.\d+)', t): nums.append(float(t)); continue
        if t.startswith(b'/'): nums.append(t.decode()); continue
        op = t.decode('latin1')
        if op == 'q': stack.append((fill, tx, ty))
        elif op == 'Q': fill, tx, ty = stack.pop() if stack else (None, 0.0, 0.0)
        elif op == 'cm': ctm_used = True; tx += nums[-2]; ty += nums[-1]
        elif op in ('scn', 'sc') and nums and isinstance(nums[-1], str): fill = nums[-1]
        elif op in ('rg',): fill = tuple(round(v, 2) for v in nums[-3:])
        elif op == 'g': fill = (round(nums[-1], 2),) * 3
        elif op == 'm':
            if cur: path.append(cur)
            cur = [(nums[-2] + tx, H - nums[-1] - ty)]
        elif op == 'l': cur.append((nums[-2] + tx, H - nums[-1] - ty))
        elif op == 'c': cur.append((nums[-2] + tx, H - nums[-1] - ty))
        elif op in ('v', 'y'): cur.append((nums[-2] + tx, H - nums[-1] - ty))
        elif op == 're':
            x, y, w, h = nums[-4:]
            x += tx; y += ty
            path.append([(x, H - y), (x + w, H - y), (x + w, H - y - h), (x, H - y - h)])
        elif op == 'h': pass
        elif op in ('f', 'F', 'f*', 'B', 'B*', 'b', 'b*', 'S', 's', 'n'):
            if cur: path.append(cur)
            if op not in ('S', 's', 'n') and path: out.append((fill, path))
            path, cur = [], []
        nums = [] if op not in ('m','l','c','v','y','re') else []
    return out, ctm_used
