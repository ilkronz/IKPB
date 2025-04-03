function getTodayDateString() {
    return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

function formatTime(seconds) {
    if (seconds < 60) return `${seconds} sec`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes} min ${remainingSeconds} sec`;
}

document.addEventListener('DOMContentLoaded', async () => {
    const quoteTextElement = document.getElementById('quote-text');
    const quoteInputElement = document.getElementById('quote-input');
    const youtubeTimeElement = document.getElementById('youtube-time');
    const xTimeElement = document.getElementById('x-time');
    const blockedAttemptsList = document.getElementById('blocked-attempts');
    const archiveButton = document.getElementById('archive-button');

    // --- Load Initial Data ---
    const today = getTodayDateString();
    try {
        const data = await chrome.storage.local.get(['quote', 'stats']);
        console.log("Blocked Page: Loaded data", data);

        // Display Quote
        const currentQuote = data.quote || "Get to work";
        quoteTextElement.textContent = currentQuote;
        quoteInputElement.value = currentQuote; // Keep input synced

        // Display Stats
        const todayStats = data.stats?.[today];
        if (todayStats) {
            youtubeTimeElement.textContent = `YouTube Time: ${formatTime(todayStats.youtubeTime || 0)}`;
            xTimeElement.textContent = `X/Twitter Time: ${formatTime(todayStats.xTime || 0)}`;

            blockedAttemptsList.innerHTML = ''; // Clear loading message
            const attempts = todayStats.blockedAttempts || {};
            if (Object.keys(attempts).length > 0) {
                for (const site in attempts) {
                    const li = document.createElement('li');
                    li.textContent = `${site}: ${attempts[site]}`;
                    blockedAttemptsList.appendChild(li);
                }
            } else {
                blockedAttemptsList.innerHTML = '<li>None yet!</li>';
            }
        } else {
            youtubeTimeElement.textContent = `YouTube Time: No data for today.`;
            xTimeElement.textContent = `X/Twitter Time: No data for today.`;
             blockedAttemptsList.innerHTML = '<li>No data for today.</li>';
             console.warn("Blocked Page: No stats found for today:", today);
        }

    } catch (error) {
        console.error("Blocked Page: Error loading initial data:", error);
        quoteTextElement.textContent = "Error loading data.";
         youtubeTimeElement.textContent = `YouTube Time: Error`;
         xTimeElement.textContent = `X/Twitter Time: Error`;
         blockedAttemptsList.innerHTML = '<li>Error</li>';
    }


    // --- Quote Editing ---
    quoteTextElement.addEventListener('click', () => {
        quoteTextElement.style.display = 'none';
        quoteInputElement.style.display = 'inline-block'; // Use inline-block like the <p>
        quoteInputElement.value = quoteTextElement.textContent; // Ensure value is current
        quoteInputElement.focus();
        quoteInputElement.select(); // Select text for easy editing
    });

    const saveQuote = async () => {
        const newQuote = quoteInputElement.value.trim();
         if (newQuote) {
            quoteTextElement.textContent = newQuote;
             try {
                await chrome.storage.local.set({ quote: newQuote });
                 console.log("Blocked Page: Quote saved:", newQuote);
             } catch (error) {
                 console.error("Blocked Page: Error saving quote:", error);
                 // Optionally revert text or show error to user
             }

        } else {
             // If user cleared the input, maybe revert to previous or a default
             // For now, just revert to what was displayed before editing started
             quoteInputElement.value = quoteTextElement.textContent;
         }

        quoteInputElement.style.display = 'none';
        quoteTextElement.style.display = 'inline-block';
    };

    quoteInputElement.addEventListener('blur', saveQuote); // Save when clicking away
    quoteInputElement.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            saveQuote();
        } else if (event.key === 'Escape') {
            // Revert changes and hide input
            quoteInputElement.value = quoteTextElement.textContent;
             quoteInputElement.style.display = 'none';
             quoteTextElement.style.display = 'inline-block';
        }
    });

    // --- Archive Button ---
    archiveButton.addEventListener('click', () => {
         // Construct the full URL to the archive page
        const archiveUrl = chrome.runtime.getURL("archive.html");
         // Open the archive page in a new tab
         chrome.tabs.create({ url: archiveUrl });
    });

});