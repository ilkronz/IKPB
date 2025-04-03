function formatTime(seconds) {
    if (seconds === undefined || seconds === null) return 'N/A';
    if (seconds < 60) return `${seconds} sec`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes} min ${remainingSeconds} sec`;
}


document.addEventListener('DOMContentLoaded', async () => {
    const archiveContent = document.getElementById('archive-content');
    archiveContent.innerHTML = '<p>Loading archive...</p>'; // Clear initial message

    try {
        const { archive } = await chrome.storage.local.get('archive');
        console.log("Archive Page: Loaded archive data", archive);


        if (!archive || Object.keys(archive).length === 0) {
            archiveContent.innerHTML = '<p>No archived data found.</p>';
            return;
        }

        archiveContent.innerHTML = ''; // Clear loading message

        // Sort dates descending (most recent first)
        const sortedDates = Object.keys(archive).sort((a, b) => new Date(b) - new Date(a));

        if (sortedDates.length === 0) {
             archiveContent.innerHTML = '<p>No archived data found.</p>';
             return;
        }


        sortedDates.forEach(date => {
            const dayData = archive[date];
            const dayDiv = document.createElement('div');
            dayDiv.classList.add('day-stats');

            const dateHeader = document.createElement('h2');
            dateHeader.textContent = date;
            dayDiv.appendChild(dateHeader);

            const youtubeP = document.createElement('p');
            youtubeP.textContent = `YouTube Time: ${formatTime(dayData.youtubeTime)}`;
            dayDiv.appendChild(youtubeP);

            const xP = document.createElement('p');
            xP.textContent = `X/Twitter Time: ${formatTime(dayData.xTime)}`;
            dayDiv.appendChild(xP);

            if (dayData.blockedAttempts && Object.keys(dayData.blockedAttempts).length > 0) {
                 const attemptsHeader = document.createElement('h3');
                 attemptsHeader.textContent = 'Blocked Site Attempts:';
                 dayDiv.appendChild(attemptsHeader);

                 const attemptsList = document.createElement('ul');
                 for (const site in dayData.blockedAttempts) {
                     const li = document.createElement('li');
                     li.textContent = `${site}: ${dayData.blockedAttempts[site]}`;
                     attemptsList.appendChild(li);
                 }
                 dayDiv.appendChild(attemptsList);
             } else {
                  const noAttemptsP = document.createElement('p');
                  noAttemptsP.textContent = 'No blocked site attempts recorded.';
                  dayDiv.appendChild(noAttemptsP);
             }


            archiveContent.appendChild(dayDiv);
        });

    } catch (error) {
        console.error("Archive Page: Error loading archive data:", error);
        archiveContent.innerHTML = '<p>Error loading archive data. Check the console.</p>';
    }
});