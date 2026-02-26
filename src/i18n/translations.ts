export type Language = "en" | "no";

export interface Translations {
  // Login page
  loginTitle: string;
  loginSubtitle: string;
  email: string;
  emailPlaceholder: string;
  password: string;
  passwordPlaceholder: string;
  rememberMe: string;
  logIn: string;
  loggingIn: string;
  multipleKindergartens: string;
  continue: string;
  back: string;
  
  // Albums page
  albums: string;
  albumsTitle: string;
  albumsSubtitle: string;
  albumsFound: string;
  selected: string;
  selectAll: string;
  deselectAll: string;
  download: string;
  settings: string;
  albumsSelected: string;
  images: string;
  refresh: string;
  loading: string;
  fetchingAlbums: string;
  noAlbumsFound: string;
  
  // Download page
  downloading: string;
  downloadComplete: string;
  readyToDownload: string;
  downloaded: string;
  skipped: string;
  failed: string;
  backToAlbums: string;
  cancel: string;
  retryFailed: string;
  downloadAgain: string;
  startDownload: string;
  clickStartDownload: string;
  downloadFinished: string;
  totalAlbums: string;
  totalImages: string;
  album: string;
  albumProgress: string; // "Album X/Y"
  albumsSelectedCount: string; // "X albums selected"
  
  // Settings page
  settingsTitle: string;
  done: string;
  outputDirectory: string;
  outputDirHelp: string;
  browse: string;
  delayBetweenRequests: string;
  delayHelp: string;
  maxImagesPerAlbum: string;
  maxImagesHelp: string;
  language: string;
  languageHelp: string;
  checkForUpdates: string;
  checkingForUpdates: string;
  
  // Languages
  english: string;
  norwegian: string;
}

export const translations: Record<Language, Translations> = {
  en: {
    // Login page
    loginTitle: "Kidplan Downloader",
    loginSubtitle: "Log in to download album photos",
    email: "Email",
    emailPlaceholder: "you@example.com",
    password: "Password",
    passwordPlaceholder: "Your password",
    rememberMe: "Remember my credentials",
    logIn: "Log In",
    loggingIn: "Logging in...",
    multipleKindergartens: "Multiple kindergartens found. Select one:",
    continue: "Continue",
    back: "Back",
    
    // Albums page
    albums: "Albums",
    albumsTitle: "Photo Albums",
    albumsSubtitle: "Select albums to download",
    albumsFound: "albums found",
    selected: "selected",
    selectAll: "Select all",
    deselectAll: "Deselect all",
    download: "Download",
    settings: "Settings",
    albumsSelected: "albums selected",
    images: "images",
    refresh: "Refresh",
    loading: "Loading...",
    fetchingAlbums: "Fetching albums...",
    noAlbumsFound: "No albums found",
    
    // Download page
    downloading: "Downloading...",
    downloadComplete: "Download Complete",
    readyToDownload: "Ready to Download",
    downloaded: "downloaded",
    skipped: "skipped",
    failed: "failed",
    backToAlbums: "Back to Albums",
    cancel: "Cancel",
    retryFailed: "Retry Failed",
    downloadAgain: "Download Again",
    startDownload: "Start Download",
    clickStartDownload: "Click \"Start Download\" to begin",
    downloadFinished: "Download finished",
    totalAlbums: "Albums",
    totalImages: "Downloaded",
    album: "Album",
    albumProgress: "Album",
    albumsSelectedCount: "albums selected",
    
    // Settings page
    settingsTitle: "Settings",
    done: "Done",
    outputDirectory: "Output directory",
    outputDirHelp: "Default: ~/Downloads/kidplan-albums/",
    browse: "Browse...",
    delayBetweenRequests: "Delay between requests (ms)",
    delayHelp: "Adds a delay between image downloads to avoid overloading the server. Default: 200ms.",
    maxImagesPerAlbum: "Max images per album",
    maxImagesHelp: "Set to 0 for no limit.",
    language: "Language",
    languageHelp: "Choose your preferred language",
    checkForUpdates: "Check for Updates",
    checkingForUpdates: "Checking for updates...",
    
    // Languages
    english: "English",
    norwegian: "Norwegian",
  },
  no: {
    // Login page
    loginTitle: "Kidplan Nedlaster",
    loginSubtitle: "Logg inn for å laste ned albumbilder",
    email: "E-post",
    emailPlaceholder: "deg@eksempel.no",
    password: "Passord",
    passwordPlaceholder: "Ditt passord",
    rememberMe: "Husk legitimasjon",
    logIn: "Logg inn",
    loggingIn: "Logger inn...",
    multipleKindergartens: "Flere barnehager funnet. Velg en:",
    continue: "Fortsett",
    back: "Tilbake",
    
    // Albums page
    albums: "Album",
    albumsTitle: "Fotoalbum",
    albumsSubtitle: "Velg album å laste ned",
    albumsFound: "album funnet",
    selected: "valgt",
    selectAll: "Velg alle",
    deselectAll: "Fjern alle",
    download: "Last ned",
    settings: "Innstillinger",
    albumsSelected: "album valgt",
    images: "bilder",
    refresh: "Oppdater",
    loading: "Laster...",
    fetchingAlbums: "Henter album...",
    noAlbumsFound: "Ingen album funnet",
    
    // Download page
    downloading: "Laster ned...",
    downloadComplete: "Nedlasting fullført",
    readyToDownload: "Klar til nedlasting",
    downloaded: "lastet ned",
    skipped: "hoppet over",
    failed: "feilet",
    backToAlbums: "Tilbake til album",
    cancel: "Avbryt",
    retryFailed: "Prøv feilede på nytt",
    downloadAgain: "Last ned på nytt",
    startDownload: "Start nedlasting",
    clickStartDownload: "Klikk \"Start nedlasting\" for å begynne",
    downloadFinished: "Nedlasting fullført",
    totalAlbums: "Album",
    totalImages: "Lastet ned",
    album: "Album",
    albumProgress: "Album",
    albumsSelectedCount: "album valgt",
    
    // Settings page
    settingsTitle: "Innstillinger",
    done: "Ferdig",
    outputDirectory: "Utdatamappe",
    outputDirHelp: "Standard: ~/Downloads/kidplan-albums/",
    browse: "Bla gjennom...",
    delayBetweenRequests: "Forsinkelse mellom forespørsler (ms)",
    delayHelp: "Legger til en forsinkelse mellom bildene for å unngå å overbelaste serveren. Standard: 200ms.",
    maxImagesPerAlbum: "Maks bilder per album",
    maxImagesHelp: "Sett til 0 for ingen grense.",
    language: "Språk",
    languageHelp: "Velg ditt foretrukne språk",
    checkForUpdates: "Se etter oppdateringer",
    checkingForUpdates: "Søker etter oppdateringer...",
    
    // Languages
    english: "Engelsk",
    norwegian: "Norsk",
  },
};
