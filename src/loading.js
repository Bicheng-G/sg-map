export function initLoadingAnimation() {
  const loaderContainer = document.getElementById('loader-container');
  const percentageElement = document.getElementById('loading-percentage');
  const body = document.body;

  if (!loaderContainer || !percentageElement) {
    console.error('Loader elements not found!');
    return;
  }

  body.classList.add('loading-active'); // Prevent scrolling

  let currentPercentage = 0;
  const targetPercentage = 100;
  const simulationDuration = 2000; // 2 seconds for simulation
  const intervalTime = simulationDuration / targetPercentage; // Time per percentage point

  const intervalId = setInterval(() => {
    currentPercentage++;
    if (currentPercentage <= targetPercentage) {
      percentageElement.textContent = `${currentPercentage}%`;
    }

    if (currentPercentage >= targetPercentage) {
      clearInterval(intervalId);
      // Wait slightly longer than interval to ensure 100% is displayed
      setTimeout(finishLoading, intervalTime + 50); 
    }
  }, intervalTime);

  function finishLoading() {
    // Start fade out
    loaderContainer.style.opacity = '0';

    // Wait for fade out transition to complete before removing
    loaderContainer.addEventListener('transitionend', () => {
      if (loaderContainer.parentNode) {
          loaderContainer.parentNode.removeChild(loaderContainer);
      }
      body.classList.remove('loading-active'); // Re-enable scrolling
    }, { once: true }); // Ensure the event listener runs only once
  }

  // As a fallback, ensure loading finishes even if simulation is interrupted
  // or takes longer than expected, attaching to window.onload
  // Note: This might hide the loader earlier or later than the simulation
  // depending on actual page load time. Adjust logic if needed.
  window.addEventListener('load', () => {
      // If the simulation hasn't finished yet, force it
      if (currentPercentage < targetPercentage) {
          clearInterval(intervalId);
          percentageElement.textContent = '100%'; 
          // Use a small delay before finishing to let 100% show
          setTimeout(finishLoading, 100); 
      }
  });
} 