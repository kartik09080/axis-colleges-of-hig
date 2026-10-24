"""
media.py - Helpers for files: what kind of file it is, thumbnails and photo dates.

Pillow (the PIL library) is used to make small preview pictures (thumbnails)
and to read the date a photo was taken from its EXIF data.
"""
import os
import re

from PIL import Image, ImageOps

THUMB_SIZE = 480  # thumbnails fit inside a 480 x 480 square

# Types that the browser can show directly (images, videos, audio, PDF).
# Anything else (HTML, SVG, scripts...) is always downloaded, never opened
# in the browser, so an uploaded file can not run code on our site.
INLINE_SAFE = {
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp',
    'video/mp4', 'video/webm', 'video/quicktime',
    'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/webm',
    'application/pdf',
}


def detect_kind(mime):
    """Group a MIME type into a simple kind used by the app and its icons."""
    if mime.startswith('image/') and mime != 'image/svg+xml':
        return 'image'
    if mime.startswith('video/'):
        return 'video'
    if mime.startswith('audio/'):
        return 'audio'
    if mime == 'application/pdf':
        return 'pdf'
    if mime.startswith('text/'):
        return 'text'
    return 'other'


def is_inline_safe(mime):
    return mime in INLINE_SAFE


def read_taken_at(path):
    """Return the date a photo was taken (EXIF), like '2024-05-01T10:20:30', or None."""
    try:
        with Image.open(path) as im:
            exif = im.getexif()
            # DateTimeOriginal lives in the Exif sub-block (0x8769); DateTime is in the main block
            sub = exif.get_ifd(0x8769)
            raw = sub.get(36867) or sub.get(36868) or exif.get(306)
        if not raw:
            return None
        raw = str(raw).strip()                        # looks like '2024:05:01 10:20:30'
        if not re.match(r'^\d{4}:\d{2}:\d{2}', raw):
            return None
        date_part, _, time_part = raw.partition(' ')
        result = date_part.replace(':', '-')
        if re.match(r'^\d{2}:\d{2}:\d{2}$', time_part):
            result += 'T' + time_part
        return result
    except Exception:
        return None


def make_thumbnail(src, dst):
    """Create a small JPEG preview of an image. Returns True if it worked."""
    try:
        with Image.open(src) as im:
            im = ImageOps.exif_transpose(im)        # respect phone rotation
            im = im.convert('RGB')
            im.thumbnail((THUMB_SIZE, THUMB_SIZE))
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            im.save(dst, 'JPEG', quality=82, optimize=True)
        return True
    except Exception:
        return False
