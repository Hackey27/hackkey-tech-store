"""Trace the alpha channel of the supplied brand PNG into deterministic SVG paths."""

from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path('/Users/mac/Library/CloudStorage/OneDrive-Personal/Me/Tech support/My logo 1.png')


def turn_order(incoming, candidates):
    directions = [(1, 0), (0, 1), (-1, 0), (0, -1)]
    index = directions.index(incoming)
    preferred = [directions[(index + 1) % 4], incoming, directions[(index - 1) % 4], directions[(index + 2) % 4]]
    return min(candidates, key=lambda point: preferred.index((point[0], point[1])))


def trace_loops(mask):
    height = len(mask)
    width = len(mask[0])
    edges = set()
    for y in range(height):
        for x in range(width):
            if not mask[y][x]:
                continue
            if y == 0 or not mask[y - 1][x]:
                edges.add(((x, y), (x + 1, y)))
            if x == width - 1 or not mask[y][x + 1]:
                edges.add(((x + 1, y), (x + 1, y + 1)))
            if y == height - 1 or not mask[y + 1][x]:
                edges.add(((x + 1, y + 1), (x, y + 1)))
            if x == 0 or not mask[y][x - 1]:
                edges.add(((x, y + 1), (x, y)))

    loops = []
    while edges:
        start_edge = min(edges)
        edges.remove(start_edge)
        start, current = start_edge
        previous = start
        points = [start, current]
        while current != start:
            outgoing = [edge for edge in edges if edge[0] == current]
            if not outgoing:
                raise RuntimeError(f'Open contour at {current}')
            incoming = (current[0] - previous[0], current[1] - previous[1])
            vectors = [(edge[1][0] - current[0], edge[1][1] - current[1]) for edge in outgoing]
            chosen_vector = turn_order(incoming, vectors)
            chosen = next(edge for edge in outgoing if (edge[1][0] - current[0], edge[1][1] - current[1]) == chosen_vector)
            edges.remove(chosen)
            previous, current = current, chosen[1]
            points.append(current)

        # Pixel outlines contain long runs of redundant collinear points.
        compact = []
        for point in points[:-1]:
            compact.append(point)
            while len(compact) >= 3:
                a, b, c = compact[-3:]
                if (b[0] - a[0]) * (c[1] - b[1]) == (b[1] - a[1]) * (c[0] - b[0]):
                    compact.pop(-2)
                else:
                    break
        loops.append(compact)
    return loops


def path_data(loops):
    return ' '.join('M' + 'L'.join(f'{x} {y}' for x, y in loop) + 'Z' for loop in loops)


image = Image.open(SOURCE).convert('RGBA')
alpha = image.getchannel('A')
mask = [[alpha.getpixel((x, y)) >= 128 for x in range(image.width)] for y in range(image.height)]
loops = trace_loops(mask)
glyph_loops = [loop for loop in loops if sum(x for x, _ in loop) / len(loop) < 165]
wordmark_loops = [loop for loop in loops if loop not in glyph_loops]
glyph = path_data(glyph_loops)
wordmark = path_data(wordmark_loops)

(ROOT / 'src/components/brandLogoPaths.ts').write_text(
    '// Generated from the supplied Hack-Key Tech PNG by scripts/trace-brand-logo.py.\n'
    f"export const BRAND_GLYPH_PATH = '{glyph}';\n"
    f"export const BRAND_WORDMARK_PATH = '{wordmark}';\n",
    encoding='utf-8',
)

(ROOT / 'public/logo.svg').write_text(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 428 108" role="img" aria-label="Hack-Key Tech Support">'
    f'<path fill="#05ef28" fill-rule="evenodd" d="{glyph} {wordmark}"/></svg>\n',
    encoding='utf-8',
)
(ROOT / 'public/logo-mark.svg').write_text(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 153 108" role="img" aria-label="Hack-Key Tech">'
    f'<path fill="#05ef28" fill-rule="evenodd" d="{glyph}"/></svg>\n',
    encoding='utf-8',
)

print(f'Traced {len(glyph_loops)} glyph contours and {len(wordmark_loops)} wordmark contours.')
