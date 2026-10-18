// src/utils/appVersion.js
import Constants from 'expo-constants';

/** "1.0.2 (build 2)" from app.json, so Settings never shows a stale number. */
export function appVersionLabel() {
  const version = Constants.expoConfig?.version || '—';
  const build = Constants.expoConfig?.android?.versionCode;
  return build ? `${version} (build ${build})` : version;
}

export default appVersionLabel;
