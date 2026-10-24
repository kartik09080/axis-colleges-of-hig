# Axis Drive

A Google Drive / Google Photos style cloud storage app, built with Python (Flask + SQLite) and plain HTML, CSS and JavaScript.
The same code runs on your computer and in the cloud.

## Features

- **Accounts:** sign up and log in. Passwords are stored as salted hashes. Login is limited to 5 wrong tries per email every 15 minutes.
- **Upload:** many files at once, drag and drop anywhere on the page, with a progress bar for each file.
- **My Drive:** create, rename, move and delete folders and files. Breadcrumbs show where you are.
- **Photos:** a timeline of your photos and videos grouped by date. Dates come from the photo's EXIF "date taken", otherwise the upload date. Thumbnails are generated automatically.
- **Preview:** images, videos, audio and PDFs open in the browser. Other files can be downloaded.
- **Starred, Search, Download:** star files, search by name across all folders, and download any file.
- **Share links:** create a link at `/s/<token>` that anyone can open without logging in. Revoke it any time.
- **Trash:** delete moves items to the trash. You can restore them, delete them forever, or empty the trash.
- **Storage:** a usage bar with a quota per user (default 15 GB).

## Run it on your computer

You need Python 3.9 or newer. (Python is the only thing to install. The launcher installs everything else.)

| System | What to do |
|---|---|
| Windows | Double-click **`start-drive.bat`** |
| Mac | Double-click **`start-drive.command`** (if macOS blocks it, right-click, then Open) |
| Linux | Run `./start-drive.sh` |

The first run takes about a minute. The browser then opens **http://localhost:8000**. Keep the window open while you use the app. Close it to stop.

- Your files are kept in the `data_store/` folder next to the launcher. Back up that folder to keep your data.
- To use a different port, set `PORT` first, for example `PORT=9000 ./start-drive.sh`.

Other computers on the same Wi-Fi can open the app at `http://<your-computer-ip>:8000`.

## Run it on the cloud

### Option A: Render (simplest)

Render needs a **paid** plan (`starter`) for a persistent disk. Without a disk, uploads are lost on restart.

1. Push this repository to GitHub.
2. In Render, choose **New > Web Service**, then pick the repository.
3. Set **Root Directory** to `kushagra_proj` and **Runtime** to **Docker**.
4. Add a **Disk**: mount path `/data`, size 10 GB or more.
5. Add these environment variables (the `render.yaml` file in this folder lists them):
   - `DRIVE_DATA_DIR` = `/data`
   - `DRIVE_SECRET_KEY` = any long random text (for example, click *Generate*)
   - `DRIVE_COOKIE_SECURE` = `1`
   - `DRIVE_QUOTA_GB` = `15` (optional, storage per user)
   - `DRIVE_MAX_UPLOAD_MB` = `2048` (optional, largest single upload)
6. Deploy. Open the URL Render gives you and sign up.

### Option B: any Docker host

```bash
cd kushagra_proj
docker build -t axis-drive .
docker run -p 8000:8000 -v axis-drive-data:/data \
  -e DRIVE_SECRET_KEY="$(python3 -c 'import secrets;print(secrets.token_hex(32))')" \
  axis-drive
```

Open http://localhost:8000. On a real HTTPS domain, also set `-e DRIVE_COOKIE_SECURE=1`.

## Use it on Android (phone app)

Axis Drive is a web app that can be installed like a phone app. It needs the cloud server
(Render or similar) to be online, because your files live on the server.

**Install as an app (no APK needed):**
1. Open the Axis Drive website in **Chrome** on your Android phone (it must be an `https://` address).
2. Tap the **⋮** menu, then **Install app** (or **Add to Home screen**).
3. The Axis Drive icon appears on your home screen and opens full-screen.

**Make a real APK file (optional):**
1. Put the site online (see *Run it on the cloud*) and copy its `https://` address.
2. Go to https://www.pwabuilder.com, paste the address, and click **Start**.
3. Choose **Android** and then **Generate package**. Download the zip and install the `.apk` on your phone
   (allow installing from unknown sources the first time).

## Settings (environment variables)

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `8000` | Port the server listens on |
| `DRIVE_HOST` | `0.0.0.0` | Address to listen on (local runs) |
| `DRIVE_DATA_DIR` | `./data_store` | Where the database, files and thumbnails are stored |
| `DRIVE_SECRET_KEY` | created once and saved in the data folder | Signs login cookies. Set it yourself in the cloud. |
| `DRIVE_QUOTA_GB` | `15` | Storage limit per user |
| `DRIVE_MAX_UPLOAD_MB` | `2048` | Largest allowed single upload |
| `DRIVE_COOKIE_SECURE` | off | Set to `1` when the site uses HTTPS (cookie becomes `Secure; SameSite=None`, so login also works when the app is shown inside another site) |

## Run the tests

```bash
python -m venv .venv
. .venv/bin/activate        # on Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m unittest discover -s tests -v
```

## Project layout

```
app.py            Flask server: accounts, folders, files, trash, sharing, API
db.py             SQLite database setup and helpers
media.py          File types, thumbnails (Pillow) and photo dates (EXIF)
static/           The web app: index.html, app.js, style.css, share.html, share.js
tests/            Automated tests for the API
start-drive.bat   Windows launcher        start-drive.sh / .command   Linux / Mac launchers
Dockerfile        Container image for the cloud
render.yaml       Render settings (see Option A)
data_store/       Created at runtime. Holds your files. Not stored in Git.
```

## Notes and limits

- Files are saved under random names on the disk. Their real names are only in the database.
- Only safe file types (images, videos, audio, PDF) open in the browser. Everything else is always downloaded, so an uploaded HTML file cannot run scripts on the site.
- Thumbnails are made for JPEG, PNG, GIF, WebP and BMP. HEIC photos from iPhones show a generic icon, but the original file still opens and downloads.
- Drag-and-drop uploads files. Dragging whole folders is not supported yet; select the files inside them instead.
- Share links give access to one file. Folder sharing is not included yet.
- Run only **one** server process. The login-attempt limit is kept in memory, so several processes would each count separately. The Docker image already runs one process.
- This is a demo-grade app. Before you store important or private data, add HTTPS, regular backups of the data folder, and a review of the security settings.
- GitHub Pages only serves static files, so it cannot run this app. Use the launcher or a cloud host.
- The phone app is a web app (PWA). It needs internet to reach your server. Files are not cached on the phone.
