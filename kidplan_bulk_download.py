#!/usr/bin/env python3
import argparse
import hashlib
import html
import os
import re
import sys
import time
from html.parser import HTMLParser
from http.cookiejar import MozillaCookieJar
from urllib.parse import parse_qs, urlencode, urljoin, urlparse, urlunparse

import requests


USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36"
IMAGE_EXTS = (".jpg", ".jpeg", ".png", ".gif", ".webp")
LOGIN_URL = "https://app.kidplan.com/LogOn"
KINDERGARTEN_IDS_URL = "https://app.kidplan.com/Account/GetKinderGartenIds"
ALBUMS_JSON_PATH = "/bilder/GetAlbumsAsJson"


def strip_fragment(url):
    parts = urlparse(url)
    return urlunparse(
        (parts.scheme, parts.netloc, parts.path, parts.params, parts.query, "")
    )


def upgrade_image_url(url):
    if not url:
        return url
    url = html.unescape(url)
    parts = urlparse(url)
    if parts.netloc.endswith("img.kidplan.com") and parts.path.startswith(
        "/albumpicture/"
    ):
        qs = parse_qs(parts.query, keep_blank_values=True)
        if "size" in qs:
            qs.pop("size", None)
            new_query = urlencode(qs, doseq=True)
            return urlunparse(
                (parts.scheme, parts.netloc, parts.path, parts.params, new_query, "")
            )
    return url


def looks_like_image(url):
    lower = url.lower()
    if any(ext in lower for ext in IMAGE_EXTS):
        return True
    return False


def is_album_image_url(url):
    if not url:
        return False
    parts = urlparse(url)
    return parts.netloc.endswith("img.kidplan.com") and parts.path.startswith(
        "/albumpicture/"
    )


def extract_image_id(url):
    if not url:
        return None
    parts = urlparse(url)
    if not parts.netloc.endswith("img.kidplan.com"):
        return None
    if not parts.path.startswith("/albumpicture/"):
        return None
    qs = parse_qs(parts.query, keep_blank_values=True)
    image_id = qs.get("id", [None])[0]
    return image_id


def normalize_url(url, base):
    if not url:
        return None
    url = html.unescape(url.strip())
    if url.startswith("//"):
        url = "https:" + url
    url = urljoin(base, url)
    return strip_fragment(url)


class LinkAndImageParser(HTMLParser):
    def __init__(self, base_url):
        super().__init__()
        self.base_url = base_url
        self.album_links = set()
        self.image_urls = set()

    def handle_starttag(self, tag, attrs):
        attrs = {k.lower(): v for k, v in attrs if v is not None}
        if tag == "a":
            href = normalize_url(attrs.get("href"), self.base_url)
            if href and "/bilder/albumet/" in href:
                self.album_links.add(href)
            if href and looks_like_image(href) and is_album_image_url(href):
                self.image_urls.add(href)

        if tag in ("img", "source"):
            for key in (
                "src",
                "data-src",
                "data-original",
                "data-full",
                "data-large",
                "data-url",
                "srcset",
            ):
                val = attrs.get(key)
                if not val:
                    continue
                if key == "srcset":
                    for part in val.split(","):
                        candidate = part.strip().split(" ")[0]
                        candidate = normalize_url(candidate, self.base_url)
                        if (
                            candidate
                            and looks_like_image(candidate)
                            and is_album_image_url(candidate)
                        ):
                            self.image_urls.add(candidate)
                else:
                    candidate = normalize_url(val, self.base_url)
                    if (
                        candidate
                        and looks_like_image(candidate)
                        and is_album_image_url(candidate)
                    ):
                        self.image_urls.add(candidate)


def extract_album_links(html_text, base_url):
    parser = LinkAndImageParser(base_url)
    parser.feed(html_text)
    return sorted(parser.album_links)


def fetch_albums_json(session, base_url, page_size=50, delay=0.0, verbose=False):
    albums = []
    seen_ids = set()
    skip = 0
    url = urljoin(base_url, ALBUMS_JSON_PATH)
    while True:
        params = {
            "take": page_size,
            "skip": skip,
            "noCache": int(time.time() * 1000),
        }
        if verbose:
            print(f"  fetch albums json: {url}?take={page_size}&skip={skip}")
        resp = session.get(url, params=params)
        if resp.status_code != 200:
            raise RuntimeError(f"Album JSON fetch failed {resp.status_code}")
        data = resp.json()
        if not isinstance(data, list) or not data:
            break
        new_items = 0
        for item in data:
            album_id = item.get("AlbumId")
            if album_id in seen_ids:
                continue
            seen_ids.add(album_id)
            albums.append(item)
            new_items += 1
        if new_items == 0:
            break
        if len(data) < page_size:
            break
        skip += len(data)
        if delay:
            time.sleep(delay)
    return albums


def extract_image_urls(html_text, base_url):
    parser = LinkAndImageParser(base_url)
    parser.feed(html_text)
    urls = {upgrade_image_url(url) for url in parser.image_urls}
    for match in re.findall(r"https?://[^\"'\s>]+", html_text):
        if looks_like_image(match) and is_album_image_url(match):
            urls.add(upgrade_image_url(strip_fragment(html.unescape(match))))
    return sorted(urls)


def extract_title(html_text):
    for tag in ("h1", "h2", "h3", "h4"):
        m = re.search(
            rf"<{tag}[^>]*>(.*?)</{tag}>", html_text, re.IGNORECASE | re.DOTALL
        )
        if m:
            raw = re.sub(r"<[^>]+>", " ", m.group(1))
            return " ".join(html.unescape(raw).split()).strip()
    return None


def is_login_page(html_text):
    lowered = html_text.lower()
    if "log in kidplan" in lowered:
        return True
    if 'id="loginform"' in lowered or "id='loginform'" in lowered:
        return True
    return False


def slugify(value):
    value = value.strip()
    cleaned = []
    for ch in value:
        if "a" <= ch.lower() <= "z" or "0" <= ch <= "9":
            cleaned.append(ch)
        elif ch in (" ", "-", "_"):
            cleaned.append("-")
        else:
            cleaned.append("-")
    slug = "".join(cleaned)
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug or "album"


def load_cookies(cookie_path):
    if not cookie_path:
        return None
    jar = MozillaCookieJar()
    jar.load(cookie_path, ignore_discard=True, ignore_expires=True)
    return jar


def build_session(cookie_path):
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})
    cookie_jar = load_cookies(cookie_path)
    if cookie_jar is not None:
        session.cookies.update(cookie_jar)
    return session


def request_text(session, url):
    resp = session.get(url)
    if resp.status_code != 200:
        raise RuntimeError(f"Request failed {resp.status_code} for {url}")
    return resp.text


def fetch_kindergarten_ids(session, username, password):
    resp = session.get(
        KINDERGARTEN_IDS_URL, params={"username": username, "password": password}
    )
    if resp.status_code != 200:
        raise RuntimeError(f"Kindergarten lookup failed {resp.status_code}")
    return resp.json()


def login_with_env(
    session, username, password, kid_id=None, kid_name=None, return_url=None
):
    ids = fetch_kindergarten_ids(session, username, password)
    if not ids:
        raise RuntimeError(
            "Login failed: no kindergarten IDs returned. Check credentials."
        )

    selected = None
    if kid_id is not None:
        for item in ids:
            if str(item.get("Id")) == str(kid_id):
                selected = item
                break
        if not selected:
            raise RuntimeError("Provided kid id not found for this account.")
    elif kid_name:
        for item in ids:
            if str(item.get("Name", "")).strip().lower() == kid_name.strip().lower():
                selected = item
                break
        if not selected:
            raise RuntimeError("Provided kid name not found for this account.")
    elif len(ids) == 1:
        selected = ids[0]
    else:
        names = ", ".join(f"{item.get('Name')} (id={item.get('Id')})" for item in ids)
        raise RuntimeError(
            "Multiple kindergartens found. Provide --kid or --kid-name. Options: "
            + names
        )

    kid = selected.get("Id")
    params = {"kid": kid}
    if return_url:
        params["returnurl"] = return_url

    data = {
        "UserName": username,
        "Password": password,
        "RememberMe": "true",
    }
    resp = session.post(LOGIN_URL, params=params, data=data, allow_redirects=True)
    if resp.status_code != 200:
        raise RuntimeError(f"Login failed {resp.status_code}")
    return True


def load_env_file(path):
    env = {}
    if not path:
        return env
    if not os.path.exists(path):
        return env
    with open(path, "r", encoding="utf-8") as fh:
        for raw_line in fh:
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            env[key] = value
    return env


def ensure_dir(path):
    os.makedirs(path, exist_ok=True)


def guess_filename(url, fallback):
    parsed = urlparse(url)
    name = os.path.basename(parsed.path)
    if not name:
        return fallback
    if "." not in name:
        return name + fallback
    return name


def download_file(session, url, dest_path, timeout=60):
    resp = session.get(url, stream=True, timeout=timeout)
    if resp.status_code != 200:
        raise RuntimeError(f"Download failed {resp.status_code} for {url}")
    total = resp.headers.get("content-length")
    if total and os.path.exists(dest_path):
        if os.path.getsize(dest_path) == int(total):
            return "exists"
    with open(dest_path, "wb") as fh:
        for chunk in resp.iter_content(chunk_size=1024 * 256):
            if chunk:
                fh.write(chunk)
    return "downloaded"


def load_manifest(path):
    if not path or not os.path.exists(path):
        return set()
    entries = set()
    with open(path, "r", encoding="utf-8") as fh:
        for raw in fh:
            line = raw.strip()
            if line:
                entries.add(line)
    return entries


def append_manifest(path, entry):
    if not path:
        return
    with open(path, "a", encoding="utf-8") as fh:
        fh.write(entry + "\n")


def ensure_manifest(path):
    if not path:
        return
    if not os.path.exists(path):
        with open(path, "w", encoding="utf-8") as fh:
            fh.write("")


def main():
    parser = argparse.ArgumentParser(
        description="Bulk download Kidplan album images using cookies or env-based login."
    )
    parser.add_argument(
        "--cookie-file",
        help="Path to Netscape cookie file exported from Chrome",
    )
    parser.add_argument(
        "--album-url",
        default="https://app.kidplan.com/bilder/album",
        help="Album list URL",
    )
    parser.add_argument("--out-dir", default="kidplan-albums", help="Output directory")
    parser.add_argument(
        "--delay", type=float, default=0.2, help="Delay between requests (seconds)"
    )
    parser.add_argument(
        "--limit", type=int, default=0, help="Max images per album (0 = no limit)"
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="Print actions without downloading"
    )
    parser.add_argument(
        "--debug-html",
        action="store_true",
        help="Save fetched HTML when no albums are found",
    )
    parser.add_argument(
        "--no-dedupe",
        action="store_true",
        help="Disable global dedupe of image URLs across albums",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Print each request and download action",
    )
    parser.add_argument(
        "--fast-skip",
        action="store_true",
        help="Skip downloads if destination file exists without size check",
    )
    parser.add_argument(
        "--manifest",
        default="kidplan-manifest.txt",
        help="Path to manifest file for URL-level skip tracking",
    )
    parser.add_argument(
        "--username-env", help="Env var with username (email/member number)"
    )
    parser.add_argument("--password-env", help="Env var with password")
    parser.add_argument("--kid", help="Kindergarten id to use if multiple")
    parser.add_argument("--kid-name", help="Kindergarten name to use if multiple")
    parser.add_argument(
        "--env-file",
        default=".env",
        help="Path to .env file (used if username/password env vars are not set)",
    )
    parser.add_argument(
        "--username-key",
        default="KIDPLAN_USER",
        help="Key in .env or environment for username",
    )
    parser.add_argument(
        "--password-key",
        default="KIDPLAN_PASS",
        help="Key in .env or environment for password",
    )
    args = parser.parse_args()

    session = build_session(args.cookie_file)
    username = None
    password = None
    if args.username_env and args.password_env:
        username = os.environ.get(args.username_env)
        password = os.environ.get(args.password_env)
    if not username or not password:
        env_file_values = load_env_file(args.env_file) if args.env_file else {}
        username = os.environ.get(args.username_key) or env_file_values.get(
            args.username_key
        )
        password = os.environ.get(args.password_key) or env_file_values.get(
            args.password_key
        )

    if username and password:
        login_with_env(
            session,
            username,
            password,
            kid_id=args.kid,
            kid_name=args.kid_name,
            return_url=args.album_url,
        )
    ensure_dir(args.out_dir)

    print(f"Fetching album list: {args.album_url}")
    list_html = request_text(session, args.album_url)
    album_links = extract_album_links(list_html, args.album_url)
    album_items = []
    if not album_links:
        if args.debug_html:
            debug_path = os.path.join(args.out_dir, "album-list.html")
            with open(debug_path, "w", encoding="utf-8") as fh:
                fh.write(list_html)
            print(f"Saved HTML to {debug_path}")
        if is_login_page(list_html):
            print(
                "Album list looks like the login page. Check your credentials or kindergarten selection."
            )
        print("Album list HTML is dynamic; falling back to JSON endpoint.")
        albums = fetch_albums_json(
            session, args.album_url, delay=args.delay, verbose=args.verbose
        )
        for album in albums:
            url = normalize_url(album.get("AlbumUrl"), args.album_url)
            if not url:
                continue
            album_items.append({"url": url, "title": album.get("Title")})
    else:
        album_items = [{"url": url, "title": None} for url in album_links]

    if not album_items:
        print(
            "No albums found. If you have multiple kindergartens, pass --kid or --kid-name."
        )
        return 1

    print(f"Found {len(album_items)} albums")
    seen_urls = set()
    manifest_path = args.manifest
    ensure_manifest(manifest_path)
    manifest_entries = load_manifest(manifest_path)
    if manifest_entries and args.verbose:
        print(f"Loaded {len(manifest_entries)} manifest entries")
    for idx, album_item in enumerate(album_items, 1):
        album_url = album_item["url"]
        print(f"[{idx}/{len(album_items)}] {album_url}")
        time.sleep(args.delay)
        if args.verbose:
            print(f"  fetch album page: {album_url}")
        album_html = request_text(session, album_url)
        title = extract_title(album_html) or album_item.get("title") or f"album-{idx}"
        album_dir = os.path.join(args.out_dir, slugify(title))
        ensure_dir(album_dir)

        image_urls = extract_image_urls(album_html, album_url)
        if args.verbose:
            print(f"  extracted {len(image_urls)} image urls")
        if args.limit and len(image_urls) > args.limit:
            image_urls = image_urls[: args.limit]
        print(f"  {title}: {len(image_urls)} images")

        for i, image_url in enumerate(image_urls, 1):
            image_url = upgrade_image_url(image_url)
            image_id = extract_image_id(image_url)
            if not args.no_dedupe:
                if image_url in seen_urls:
                    print(f"  skipped duplicate url: {image_url}")
                    continue
                seen_urls.add(image_url)
            if manifest_entries and image_id and image_id in manifest_entries:
                if args.verbose:
                    print(f"  skipped manifest url: {image_url}")
                continue
            time.sleep(args.delay)
            digest = hashlib.sha1(image_url.encode("utf-8")).hexdigest()[:10]
            fallback = f"image-{i:04d}-{digest}.jpg"
            filename = guess_filename(image_url, fallback)
            dest_path = os.path.join(album_dir, filename)
            if args.fast_skip or (manifest_path and os.path.exists(dest_path)):
                if args.verbose:
                    print(f"  fast-skip exists: {filename}")
                if manifest_path and image_id and image_id not in manifest_entries:
                    append_manifest(manifest_path, image_id)
                    manifest_entries.add(image_id)
                continue
            if args.dry_run:
                print(f"  DRY RUN {image_url} -> {dest_path}")
                continue
            try:
                if args.verbose:
                    print(f"  download {i}/{len(image_urls)}: {image_url}")
                status = download_file(session, image_url, dest_path)
                print(f"  {status}: {filename}")
                if status == "downloaded" and manifest_path and image_id:
                    append_manifest(manifest_path, image_id)
                    manifest_entries.add(image_id)
            except Exception as exc:
                print(f"  failed: {image_url} ({exc})")

    print("Done")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
