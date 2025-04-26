import { DotLottie } from '@lottiefiles/dotlottie-web';

export async function initLoadingAnimation() {
  const lottieContainer = document.getElementById('lottie-container');
  // const percentageElement = document.getElementById('loading-percentage'); // REMOVED
  const body = document.body;

  if (!lottieContainer) {
    console.error('Lottie container element not found!');
    return;
  }

  body.classList.add('loading-active'); // Prevent scrolling

  let dotLottieInstance = null; // Variable to hold the instance

  // Dynamically import DotLottie
  try {
    const { DotLottie } = await import('@lottiefiles/dotlottie-web');

    // Initialize DotLottie *after* it's loaded
    dotLottieInstance = new DotLottie({
      autoplay: true,
      loop: true,
      canvas: document.querySelector('#dotlottie-canvas'),
      src: "https://lottie.host/55d90ab4-ae7a-48a8-bff4-766d7d8a6ce8/ICo05qojEc.lottie",
    });
  } catch (error) {
      console.error("Failed to load Lottie player:", error);
      // If Lottie fails, hide the container immediately so the app can load
      if (lottieContainer) {
         lottieContainer.classList.add('hidden');
         body.classList.remove('loading-active');
      }
      // We might not need to proceed further if Lottie failed
      // return; // Or handle differently
  }

  // REMOVED Percentage simulation logic
  /*
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
  */

  function finishLoading() {
    // Hide the Lottie container by adding the 'hidden' class
    lottieContainer.classList.add('hidden');

    // Optional: Clean up Lottie instance after transition
    lottieContainer.addEventListener('transitionend', () => {
      // Check if instance exists and has destroy method
      if (dotLottieInstance && typeof dotLottieInstance.destroy === 'function') {
           dotLottieInstance.destroy();
      }
      if (lottieContainer.parentNode) {
          // Optionally remove the container entirely, or just keep it hidden
          // lottieContainer.parentNode.removeChild(lottieContainer);
      }
      body.classList.remove('loading-active'); // Re-enable scrolling
    }, { once: true }); // Ensure the event listener runs only once
  }

  // Use window.onload to determine when main content is ready
  // This should cover download/render time better than the simulation
  window.addEventListener('load', () => {
    // Ensure finishLoading is called when the page (including scripts/data) is loaded
    // Make sure Lottie had a chance to load/initialize before finishing
    // If Lottie failed to load, finishLoading might have been called implicitly by hiding the container in catch block
    finishLoading();
  });

  // REMOVED Fallback logic tied to simulation
  /*
  window.addEventListener('load', () => {
      // If the simulation hasn't finished yet, force it
      if (currentPercentage < targetPercentage) {
          clearInterval(intervalId);
          percentageElement.textContent = '100%'; 
          // Use a small delay before finishing to let 100% show
          setTimeout(finishLoading, 100); 
      }
  });
  */
} 