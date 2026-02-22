# Kidplan Album Downloader

Downloads all images from Kidplan albums using your login credentials in a local `.env` file.

## Requirements

- Python 3.9+
- `requests`

## Setup

Create a `.env` file next to the script:

```
KIDPLAN_USER=you@example.com
KIDPLAN_PASS=your_password_here
```

Install dependencies (use a virtualenv if needed):

```
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install requests
```

## Run

```
python3 kidplan_bulk_download.py --verbose
```

Optional flags:

- `--dry-run` to preview without downloading
- `--limit 50` to cap images per album
- `--kid 12345` or `--kid-name "Name"` if you have multiple kindergartens
- `--manifest kidplan-manifest.txt` to track downloaded image ids (default)

## Notes

- The script stores downloaded image ids in `kidplan-manifest.txt` to avoid re-downloading.
- The output directory defaults to `kidplan-albums`.
