(() => {
  function resetProductionPlaceholders() {
    const setText = (id, value) => {
      const node = document.getElementById(id);
      if (node) node.textContent = value;
    };

    setText('jobsCount', '0');
    setText('pmCount', '0');
    setText('dashboardQueueCount', '0');
    setText('queueCount', '0');
    setText('partsCount', '0');
    setText('revenueCount', '$0');

    const metricCards = document.querySelectorAll('.metric-card');
    metricCards.forEach((card) => {
      const label = card.querySelector('span')?.textContent?.trim();
      const small = card.querySelector('small');
      if (!small) return;
      if (label === 'Today\'s Jobs') small.textContent = 'No active jobs';
      if (label === 'PM Visits') small.textContent = 'No visits';
      if (label === 'Office Queue') small.textContent = 'No records';
      if (label === 'Parts Orders') small.textContent = 'No orders';
      if (label === 'Est. Revenue') small.textContent = 'No revenue recorded';
    });

    document.querySelectorAll('.side-link').forEach((button) => {
      if (button.dataset.view === 'parts') {
        const badge = button.querySelector('b');
        if (badge) badge.textContent = '0';
      }
    });

    const weatherCard = document.querySelector('.weather-card');
    if (weatherCard) {
      weatherCard.innerHTML = `
        <div class="section-title"><h3>WEATHER</h3></div>
        <div class="production-empty"><div><strong>Not connected</strong>Live weather can be enabled later.</div></div>`;
    }

    document.getElementById('addSampleJob')?.remove();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(resetProductionPlaceholders, 50), { once: true });
  } else {
    setTimeout(resetProductionPlaceholders, 50);
  }
})();