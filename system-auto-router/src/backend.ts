import { readExtensionSettings } from '@neon-pilot/extensions/backend/settings';

const SETTING_PREFIX = 'autoRouter.';

export async function readSettings() {
  const allSettings = await readExtensionSettings();
  const settings = Object.fromEntries(Object.entries(allSettings).filter(([key]) => key.startsWith(SETTING_PREFIX)));
  return { settings };
}
