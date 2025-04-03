// --- Configuration ---
const BLOCKED_HOSTNAMES = ["www.instagram.com", "instagram.com", "www.facebook.com", "facebook.com", "www.linkedin.com", "linkedin.com", "www.tiktok.com", "tiktok.com", "www.linkedin.com", "linkedin.com", "www.reddit.com", "reddit.com"];
const LIMITED_HOSTNAMES = {
    "x.com": { dailyLimit: 1800, storageKey: "xTime" }, // 1800 seconds = 30 minutes
    "www.x.com": { dailyLimit: 1800, storageKey: "xTime" },
    "twitter.com": { dailyLimit: 1800, storageKey: "xTime" }, // Add twitter.com just in case
    "www.twitter.com": { dailyLimit: 1800, storageKey: "xTime" },
    "www.youtube.com": { dailyLimit: 1800, storageKey: "youtubeTime" },
    "youtube.com": { dailyLimit: 1800, storageKey: "youtubeTime" }
};
const TIME_TRACK_ALARM = "timeTrackAlarm";
const DAILY_RESET_ALARM = "dailyResetAlarm";
const CHECK_INTERVAL_MINUTES = 1; // Check active tab every minute

// --- Helper Functions ---
function getTodayDateString() {
    return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

function getBlockedPageUrl() {
    return chrome.runtime.getURL("blocked_page.html");
}

async function getStorageData(keys) {
    return new Promise((resolve) => {
        chrome.storage.local.get(keys, (result) => {
            resolve(result);
        });
    });
}

async function setStorageData(data) {
    return new Promise((resolve) => {
        chrome.storage.local.set(data, () => {
            resolve();
        });
    });
}

async function initializeStorage() {
    const today = getTodayDateString();
    const defaultStats = {
        [today]: { xTime: 0, youtubeTime: 0, blockedAttempts: {} }
    };
    const { stats, quote, archive } = await getStorageData(['stats', 'quote', 'archive']);

    const dataToSet = {};
    if (!stats) {
        dataToSet.stats = defaultStats;
    } else if (!stats[today]) {
        // Carry over stats object, but add today's entry
        stats[today] = { xTime: 0, youtubeTime: 0, blockedAttempts: {} };
         dataToSet.stats = stats;
    }

    if (!quote) {
        dataToSet.quote = "Get to work";
    }
     if (!archive) {
        dataToSet.archive = {};
    }


    if (Object.keys(dataToSet).length > 0) {
        await setStorageData(dataToSet);
        console.log("Focus Guard: Initialized/Updated storage for today.", dataToSet);
    }
     // Clear any potential lingering warning flags
     await setStorageData({ [`${LIMITED_HOSTNAMES['x.com'].storageKey}_warned`]: false, [`${LIMITED_HOSTNAMES['www.youtube.com'].storageKey}_warned`]: false });

}

async function incrementBlockedAttempt(hostname) {
    const today = getTodayDateString();
    const { stats } = await getStorageData('stats');
    if (stats && stats[today]) {
        stats[today].blockedAttempts[hostname] = (stats[today].blockedAttempts[hostname] || 0) + 1;
        await setStorageData({ stats });
        console.log(`Focus Guard: Blocked attempt recorded for ${hostname}`);
    }
}

async function checkAndTrackTime() {
    // console.log("Focus Guard: Running time check alarm");
    try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (activeTab && activeTab.url) {
            const url = new URL(activeTab.url);
            const hostname = url.hostname;

            if (LIMITED_HOSTNAMES[hostname]) {
                const siteConfig = LIMITED_HOSTNAMES[hostname];
                const today = getTodayDateString();
                const { stats } = await getStorageData(['stats']);

                if (stats && stats[today]) {
                    let currentUsage = stats[today][siteConfig.storageKey] || 0;
                    currentUsage += (CHECK_INTERVAL_MINUTES * 60); // Add seconds

                    stats[today][siteConfig.storageKey] = currentUsage;
                    await setStorageData({ stats });
                    console.log(`Focus Guard: Updated time for ${hostname}. Total: ${currentUsage}s`);

                    // Check limits *after* updating time
                    await checkTimeLimitsAndWarn(activeTab.id, hostname, currentUsage, siteConfig);
                }
            }
        }
    } catch (error) {
        console.error("Focus Guard: Error in checkAndTrackTime:", error);
        // If query fails (e.g., no window focused), just skip this check
    }
}

async function checkTimeLimitsAndWarn(tabId, hostname, currentUsage, siteConfig) {
     const limit = siteConfig.dailyLimit;
     const warningTime = limit - 60; // 1 minute before limit
     const storageKey = siteConfig.storageKey;
     const warningFlagKey = `${storageKey}_warned`;

     const { [warningFlagKey]: alreadyWarned } = await getStorageData(warningFlagKey);

    // Check for immediate block if over limit
    if (currentUsage >= limit) {
        console.log(`Focus Guard: Time limit exceeded for ${hostname}. Redirecting.`);
        try {
            await chrome.tabs.update(tabId, { url: getBlockedPageUrl() });
            await setStorageData({ [warningFlagKey]: false }); // Reset warning flag after block
        } catch (error) {
             console.error(`Focus Guard: Failed to redirect tab ${tabId} for ${hostname}:`, error);
        }
        return; // Stop further checks if blocked
    }

    // Check for warning
     if (currentUsage >= warningTime && !alreadyWarned) {
        console.log(`Focus Guard: Sending 1-minute warning for ${hostname}`);
        chrome.notifications.create(`warning-${hostname}`, {
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'Time Limit Approaching!',
            message: `You have 1 minute left on ${hostname}.`,
            priority: 2
        });
         await setStorageData({ [warningFlagKey]: true });
     }
}

async function resetDailyStats() {
    console.log("Focus Guard: Running daily reset.");
    const today = getTodayDateString();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const { stats, archive } = await getStorageData(['stats', 'archive']);

    const currentArchive = archive || {};

    // Archive yesterday's stats if they exist
    if (stats && stats[yesterdayStr]) {
        currentArchive[yesterdayStr] = stats[yesterdayStr];
        console.log(`Focus Guard: Archived stats for ${yesterdayStr}`);
    }

    // Prepare today's stats (resetting)
    const todayStats = { xTime: 0, youtubeTime: 0, blockedAttempts: {} };

    // Keep stats for other days, add/overwrite today's reset stats
    const newStats = { ...stats, [today]: todayStats };


    await setStorageData({
        stats: newStats,
        archive: currentArchive,
        // Reset warning flags
        [`${LIMITED_HOSTNAMES['x.com'].storageKey}_warned`]: false,
        [`${LIMITED_HOSTNAMES['www.youtube.com'].storageKey}_warned`]: false
    });

    console.log(`Focus Guard: Daily stats reset for ${today}.`);
}


// --- Event Listeners ---

// Run on install/update
chrome.runtime.onInstalled.addListener(async (details) => {
    console.log("Focus Guard: onInstalled event fired. Reason:", details.reason);
    await initializeStorage();

    // Setup alarms
    await chrome.alarms.create(TIME_TRACK_ALARM, {
        //delayInMinutes: CHECK_INTERVAL_MINUTES, // Start after 1 min
        periodInMinutes: CHECK_INTERVAL_MINUTES // Repeat every 1 min
    });
    console.log("Focus Guard: Time tracking alarm created.");

    // Setup daily reset alarm (aim for slightly after midnight)
    const now = new Date();
    const midnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1, // Tomorrow
        0, 1, 0 // 1 minute past midnight
    );
    const msUntilMidnight = midnight.getTime() - now.getTime();

    await chrome.alarms.create(DAILY_RESET_ALARM, {
        delayInMinutes: Math.ceil(msUntilMidnight / (60 * 1000)), // Delay until next midnight
        periodInMinutes: 24 * 60 // Repeat daily
    });
     console.log(`Focus Guard: Daily reset alarm created. Will run in approx ${Math.ceil(msUntilMidnight / (60 * 1000))} minutes.`);

     // Immediately run reset logic in case storage needs setup/archiving missed updates
     await resetDailyStats();
});

// Listener for alarms
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === TIME_TRACK_ALARM) {
        checkAndTrackTime();
    } else if (alarm.name === DAILY_RESET_ALARM) {
        resetDailyStats();
    }
});

// Listener for tab updates (URL changes, page loads)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    // Ensure the URL is valid and the page is loading/complete
    if (tab.url && (changeInfo.status === 'loading' || changeInfo.status === 'complete')) {
        try {
            const url = new URL(tab.url);
            const hostname = url.hostname;
            // console.log(`Focus Guard: Tab updated: ${tabId}, Status: ${changeInfo.status}, Host: ${hostname}`); // Debug log

             // --- Block Check ---
             if (BLOCKED_HOSTNAMES.includes(hostname)) {
                console.log(`Focus Guard: Detected blocked site navigation: ${hostname}. Redirecting.`);
                await incrementBlockedAttempt(hostname);
                // Use update instead of creating new tab for smoother redirect
                await chrome.tabs.update(tabId, { url: getBlockedPageUrl() });
                return; // Stop processing if blocked
            }

             // --- Time Limit Check (on navigation) ---
             if (LIMITED_HOSTNAMES[hostname]) {
                 const siteConfig = LIMITED_HOSTNAMES[hostname];
                 const today = getTodayDateString();
                 const { stats } = await getStorageData(['stats']);
                 const currentUsage = (stats && stats[today] && stats[today][siteConfig.storageKey]) ? stats[today][siteConfig.storageKey] : 0;

                 // Check if already over limit when navigating *to* the site
                 if (currentUsage >= siteConfig.dailyLimit) {
                     console.log(`Focus Guard: Navigated to ${hostname}, but time limit already exceeded. Redirecting.`);
                      await chrome.tabs.update(tabId, { url: getBlockedPageUrl() });
                 }
                 // Note: The alarm handles ongoing time tracking and warnings/blocking while *on* the site.
                 // This check primarily handles landing on the site when already over limit.
             }

        } catch (error) {
            // Ignore errors for URLs like "chrome://newtab/" or invalid URLs
            if (!tab.url.startsWith('chrome://') && !tab.url.startsWith('about:')) {
                console.error("Focus Guard: Error processing tab update:", error, tab.url);
            }
        }
    }
});

// Optional: Start extension immediately on browser startup
// chrome.runtime.onStartup.addListener(async () => {
//     console.log("Focus Guard: Browser startup detected.");
//     await initializeStorage(); // Ensure storage is ready
//     // Alarms should persist based on manifest, but double-check if needed
//      console.log("Focus Guard: Re-checking alarms on startup...");
//      const timeAlarm = await chrome.alarms.get(TIME_TRACK_ALARM);
//      if (!timeAlarm) {
//          console.log("Focus Guard: Recreating time tracking alarm.");
//          await chrome.alarms.create(TIME_TRACK_ALARM, { periodInMinutes: CHECK_INTERVAL_MINUTES });
//      }
//      const resetAlarm = await chrome.alarms.get(DAILY_RESET_ALARM);
//     if (!resetAlarm) {
//          console.log("Focus Guard: Recreating daily reset alarm (needs recalculation).");
//           // Recalculate delay for reset alarm
//           const now = new Date();
//           const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 1, 0);
//           const msUntilMidnight = midnight.getTime() - now.getTime();
//           await chrome.alarms.create(DAILY_RESET_ALARM, {
//               delayInMinutes: Math.max(1, Math.ceil(msUntilMidnight / (60 * 1000))), // Ensure delay is at least 1 min
//               periodInMinutes: 24 * 60
//           });
//      }
// });

console.log("Focus Guard: Background script loaded.");
// Initial check on load (might be needed if service worker restarts)
initializeStorage();