import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export async function checkForUpdates(): Promise<boolean> {
  try {
    const update = await check();
    
    if (update?.available) {
      console.log(`Update available: ${update.version}`);
      console.log(`Current version: ${update.currentVersion}`);
      console.log(`Release date: ${update.date}`);
      console.log(`Release body: ${update.body}`);
      
      // The dialog option in tauri.conf.json will show a built-in dialog
      // If user accepts, download and install
      await update.downloadAndInstall();
      
      // Relaunch the app to apply the update
      await relaunch();
      
      return true;
    }
    
    console.log('No updates available');
    return false;
  } catch (error) {
    console.error('Failed to check for updates:', error);
    return false;
  }
}
