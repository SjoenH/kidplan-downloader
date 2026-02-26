# Kidplan Downloader

*[English version below](#english)*

En desktop-applikasjon for nedlasting av fotoalbum fra [Kidplan](https://www.kidplan.no/) barnehageservice.

Bygget med [Tauri](https://tauri.app/), React og TypeScript.

## Funksjoner

- 🔐 **Sikker lagring av legitimasjon** - Husk påloggingsdetaljer med kryptert lokal lagring
- 📚 **Batch nedlasting av album** - Velg og last ned flere album samtidig
- 🌍 **Tospråklig støtte** - Full støtte for engelsk og norsk (bokmål)
- 🎯 **Automatisk deteksjon** - Oppdager automatisk systemspråket ditt
- ⚙️ **Tilpassbare innstillinger** - Konfigurer nedlastingsplassering, forsinkelser og grenser
- 🔄 **Automatiske oppdateringer** - Innebygd oppdateringssystem holder appen oppdatert
- 📊 **Fremdriftssporing** - Sanntids nedlastingsfremdrift med detaljert logging
- 🔁 **Feilhåndtering** - Automatisk retry med manuelle retry-alternativer for feilede nedlastinger

## Installasjon

### Last ned

Last ned siste versjon for din plattform fra [Releases](https://github.com/SjoenH/kidplan-downloader/releases)-siden:

- **macOS**: `.dmg`-fil (Apple Silicon eller Intel)
- **Windows**: `.msi` eller `.exe` installasjonsfil
- **Linux**: `.AppImage` eller `.deb` pakke

### Første gangs oppsett

1. Start applikasjonen
2. Skriv inn Kidplan-legitimasjonen din
3. Hvis du har flere barnehager, velg den du vil bruke
4. Velg album å laste ned
5. Konfigurer nedlastingsinnstillinger (valgfritt)
6. Start nedlasting!

## Bruk

### Pålogging
Skriv inn Kidplan e-post og passord. Aktiver "Husk legitimasjon" for å lagre påloggingsdetaljer sikkert for fremtidige økter.

### Velge album
- Bla gjennom tilgjengelige fotoalbum fra barnehagen din
- Bruk "Velg alle" / "Fjern alle" for å velge flere samtidig
- Albumnavn og bildeantall vises
- Klikk "Last ned" når du er klar

### Innstillinger
- **Språk**: Velg engelsk eller norsk
- **Utdatamappe**: Hvor bildene skal lagres (standard: `~/Downloads/kidplan-albums/`)
- **Forsinkelse mellom forespørsler**: Unngå å overbelaste serveren (standard: 200ms)
- **Maks bilder per album**: Begrens nedlastinger per album (0 = ubegrenset)
- **Se etter oppdateringer**: Sjekk manuelt for app-oppdateringer

### Nedlastingsfremdrift
- Se sanntidsfremdrift for hvert album
- Vis nedlastede, hoppet over og feilede bildeantall
- Gjennomgå detaljerte logger for feilsøking
- Prøv på nytt feilede nedlastinger ved behov

## Utvikling

### Forutsetninger

- [Node.js](https://nodejs.org/) (LTS-versjon)
- [Rust](https://www.rust-lang.org/tools/install)
- Plattformspesifikke avhengigheter:
  - **macOS**: Xcode Command Line Tools
  - **Linux**: `libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, `librsvg2-dev`, `patchelf`
  - **Windows**: [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)

### Oppsett

```bash
# Klon repository
git clone https://github.com/SjoenH/kidplan-downloader.git
cd kidplan-downloader

# Installer avhengigheter
npm install

# Kjør i utviklingsmodus
npm run tauri dev

# Bygg for produksjon
npm run tauri build
```

### Prosjektstruktur

```
.
├── src/                    # Frontend (React + TypeScript)
│   ├── components/
│   ├── context/           # React Context for state management
│   ├── i18n/              # Internasjonalisering
│   ├── pages/             # Login, Albums, Download, Settings
│   ├── types/             # TypeScript type definitions
│   └── utils/             # Verktøy (updater, etc.)
├── src-tauri/             # Backend (Rust)
│   ├── src/
│   │   ├── downloader.rs  # Albumnedlastingslogikk
│   │   ├── lib.rs         # Delte typer og tilstand
│   │   └── main.rs        # Tauri app entry point
│   └── tauri.conf.json    # Tauri-konfigurasjon
└── .github/workflows/     # CI/CD for releases
```

## Bygge utgivelser

Utgivelser bygges og signeres automatisk med GitHub Actions når en ny tag pushes:

```bash
# Opprett og push en ny versjonstagg
git tag v1.0.0
git push origin v1.0.0
```

Arbeidsflyten vil:
1. Bygge for macOS (Apple Silicon + Intel), Windows og Linux
2. Signere binærfilene med konfigurert signeringsnøkkel
3. Opprette updater-artefakter
4. Laste opp til GitHub Releases

## Personvern og sikkerhet

- **Legitimasjon**: Lagres lokalt ved bruk av Tauri sin sikre lagringsplugin
- **Ingen telemetri**: Ingen brukersporing eller analyse
- **Lokal prosessering**: Alle nedlastinger skjer direkte til maskinen din
- **Åpen kildekode**: Fullt kontrollerbar kode

## Lisens

MIT-lisens - se [LICENSE](LICENSE)-filen for detaljer

## Ansvarsfraskrivelse

Dette er et uoffisielt verktøy laget for personlig bruk. Det er ikke tilknyttet, godkjent av, eller forbundet med Kidplan AS eller noen barnehageservice. Bruk etter eget skjønn og i samsvar med barnehagens tjenestevilkår.

## Support

Hvis du opplever problemer eller har funksjonsforespørsler, vennligst [åpne en issue](https://github.com/SjoenH/kidplan-downloader/issues) på GitHub.

---

## English

A desktop application for downloading photo albums from the [Kidplan](https://www.kidplan.no/) kindergarten service.

Built with [Tauri](https://tauri.app/), React, and TypeScript.

### Features

- 🔐 **Secure credential storage** - Remember login credentials with encrypted local storage
- 📚 **Batch album downloads** - Select and download multiple albums at once
- 🌍 **Bilingual support** - Full English and Norwegian (Bokmål) translations
- 🎯 **Auto-detection** - Automatically detects your system language
- ⚙️ **Customizable settings** - Configure download location, delays, and limits
- 🔄 **Automatic updates** - Built-in update system keeps the app current
- 📊 **Progress tracking** - Real-time download progress with detailed logging
- 🔁 **Error handling** - Automatic retry with manual retry options for failed downloads

### Installation

#### Download

Download the latest version for your platform from the [Releases](https://github.com/SjoenH/kidplan-downloader/releases) page:

- **macOS**: `.dmg` file (Apple Silicon or Intel)
- **Windows**: `.msi` or `.exe` installer
- **Linux**: `.AppImage` or `.deb` package

#### First-time Setup

1. Launch the application
2. Enter your Kidplan credentials
3. If you have multiple kindergartens, select the one you want
4. Select albums to download
5. Configure download settings (optional)
6. Start downloading!

### Usage

#### Login
Enter your Kidplan email and password. Enable "Remember me" to securely store credentials for future sessions.

#### Selecting Albums
- Browse available photo albums from your kindergarten
- Use "Select all" / "Deselect all" for bulk selection
- Album names and photo counts are displayed
- Click "Download" when ready

#### Settings
- **Language**: Choose English or Norwegian
- **Output directory**: Where to save downloaded photos (default: `~/Downloads/kidplan-albums/`)
- **Delay between requests**: Prevent server overload (default: 200ms)
- **Max images per album**: Limit downloads per album (0 = unlimited)
- **Check for Updates**: Manually check for app updates

#### Download Progress
- View real-time progress for each album
- See downloaded, skipped, and failed image counts
- Review detailed logs for debugging
- Retry failed downloads if needed

### Development

#### Prerequisites

- [Node.js](https://nodejs.org/) (LTS version)
- [Rust](https://www.rust-lang.org/tools/install)
- Platform-specific dependencies:
  - **macOS**: Xcode Command Line Tools
  - **Linux**: `libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, `librsvg2-dev`, `patchelf`
  - **Windows**: [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)

#### Setup

```bash
# Clone the repository
git clone https://github.com/SjoenH/kidplan-downloader.git
cd kidplan-downloader

# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

#### Project Structure

```
.
├── src/                    # Frontend (React + TypeScript)
│   ├── components/
│   ├── context/           # React Context for state management
│   ├── i18n/              # Internationalization
│   ├── pages/             # Login, Albums, Download, Settings
│   ├── types/             # TypeScript type definitions
│   └── utils/             # Utilities (updater, etc.)
├── src-tauri/             # Backend (Rust)
│   ├── src/
│   │   ├── downloader.rs  # Album download logic
│   │   ├── lib.rs         # Shared types and state
│   │   └── main.rs        # Tauri app entry point
│   └── tauri.conf.json    # Tauri configuration
└── .github/workflows/     # CI/CD for releases
```

### Building Releases

Releases are automatically built and signed using GitHub Actions when a new tag is pushed:

```bash
# Create and push a new version tag
git tag v1.0.0
git push origin v1.0.0
```

The workflow will:
1. Build for macOS (Apple Silicon + Intel), Windows, and Linux
2. Sign the binaries with the configured signing key
3. Create updater artifacts
4. Upload to GitHub Releases

### Privacy & Security

- **Credentials**: Stored locally using Tauri's secure storage plugin
- **No telemetry**: No usage tracking or analytics
- **Local processing**: All downloads happen directly to your machine
- **Open source**: Fully auditable code

### License

MIT License - see [LICENSE](LICENSE) file for details

### Disclaimer

This is an unofficial tool created for personal use. It is not affiliated with, endorsed by, or connected to Kidplan AS or any kindergarten service. Use at your own discretion and in accordance with your kindergarten's terms of service.

### Support

If you encounter issues or have feature requests, please [open an issue](https://github.com/SjoenH/kidplan-downloader/issues) on GitHub.
