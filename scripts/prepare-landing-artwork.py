"""Create responsive WebP landing assets from the generated workspace artwork."""

from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path('/Users/mac/.codex/generated_images/01a0ae59-abec-7331-9374-df14d92df6ab/exec-109a70e5-edd6-4d48-891a-fe0fc56fa234.png')


def cover(image: Image.Image, width: int, height: int, center_x: float = 0.5) -> Image.Image:
    source_ratio = image.width / image.height
    target_ratio = width / height
    if source_ratio > target_ratio:
        crop_width = round(image.height * target_ratio)
        left = round((image.width - crop_width) * center_x)
        left = max(0, min(left, image.width - crop_width))
        image = image.crop((left, 0, left + crop_width, image.height))
    else:
        crop_height = round(image.width / target_ratio)
        top = max(0, (image.height - crop_height) // 2)
        image = image.crop((0, top, image.width, top + crop_height))
    return image.resize((width, height), Image.Resampling.LANCZOS)


source = Image.open(SOURCE).convert('RGB')
cover(source, 1800, 900).save(ROOT / 'public/landing-workspace.webp', 'WEBP', quality=82, method=6)
# Keep the open wall and a hint of both screens in the narrow crop so text stays legible.
cover(source, 768, 1024, center_x=0.52).save(
    ROOT / 'public/landing-workspace-mobile.webp', 'WEBP', quality=80, method=6
)
