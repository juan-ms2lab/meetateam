importScripts('config.js');
const SESSION_MS = 120 * 60e3;
let homeUrl = HOME;

function init() {
  chrome.storage.local.remove('deadline');
  const defaults = {
    idleBlank: typeof IDLE_BLANK !== 'undefined' ? IDLE_BLANK : 180,
    screenBlank: typeof SCREEN_BLANK !== 'undefined' ? SCREEN_BLANK : 3600,
    roomName: typeof ROOM_NAME !== 'undefined' ? ROOM_NAME : '',
    pin: typeof CONFIG_PIN !== 'undefined' ? CONFIG_PIN : '0000',
    enableMeet: typeof ENABLE_MEET !== 'undefined' ? ENABLE_MEET : true,
    enableTeams: typeof ENABLE_TEAMS !== 'undefined' ? ENABLE_TEAMS : true,
    enableZoom: typeof ENABLE_ZOOM !== 'undefined' ? ENABLE_ZOOM : true,
    homeUrl: HOME,
  };
  // Only set keys not already stored (preserve user config from config screen)
  chrome.storage.local.get(Object.keys(defaults), stored => {
    const toSet = {};
    for (const [k, v] of Object.entries(defaults)) {
      if (stored[k] === undefined) toSet[k] = v;
    }
    if (Object.keys(toSet).length) chrome.storage.local.set(toSet);
    // Redirect to stored URL if different from launch URL
    if (stored.homeUrl && stored.homeUrl !== HOME) {
      homeUrl = stored.homeUrl;
      chrome.tabs.query({}, tabs => {
        if (tabs.length) chrome.tabs.update(tabs[0].id, { url: homeUrl });
      });
    }
  });
}

chrome.runtime.onStartup.addListener(init);
chrome.runtime.onInstalled.addListener(init);

// Track homeUrl changes from config screen
chrome.storage.onChanged.addListener(c => {
  if (c.homeUrl) homeUrl = c.homeUrl.newValue || HOME;
});

function setDeadline() {
  const deadline = Date.now() + SESSION_MS;
  chrome.storage.local.set({ deadline });
  chrome.alarms.create('signout', { when: deadline });
}

chrome.webNavigation.onCommitted.addListener(async ({ frameId, url }) => {
  if (frameId !== 0 || !/^https?:/.test(url) || new URL(url).origin === new URL(homeUrl).origin) return;
  const { deadline } = await chrome.storage.local.get('deadline');
  if (!deadline) setDeadline();
});

chrome.alarms.onAlarm.addListener(a => a.name === 'signout' && signOut());
chrome.runtime.onMessage.addListener(m => { if (m === 'signout') signOut(); if (m === 'extend') setDeadline(); });

async function signOut() {
  const origin = new URL(homeUrl).origin;
  await chrome.alarms.clear('signout');
  await chrome.storage.local.remove('deadline');
  await chrome.browsingData.remove({ excludeOrigins: [origin] }, {
    cookies: true, localStorage: true, indexedDB: true, cacheStorage: true,
    serviceWorkers: true, cache: true, fileSystems: true,
  });
  const old = await chrome.tabs.query({});
  await chrome.tabs.create({ url: homeUrl });
  await chrome.tabs.remove(old.map(t => t.id));
}
