import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { URL } from 'node:url';

const appJson = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8'));
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

describe('app.json android permissions', () => {
  test('DETECT_SCREEN_CAPTURE stays while expo-screen-capture is installed', () => {
    // On Android 14+ expo-screen-capture registers a screen capture callback at startup.
    // Without this permission the call throws and the app crashes before the first screen.
    if (!packageJson.dependencies['expo-screen-capture']) {
      return;
    }
    const blocked: string[] = appJson.expo.android.blockedPermissions ?? [];
    assert.ok(!blocked.includes('android.permission.DETECT_SCREEN_CAPTURE'));
  });
});
