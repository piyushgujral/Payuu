/* ==================================================== PAYUU LIVE DASHBOARD - ADMIN CONTROL MODULE ==================================================== */

window.initAdminModule = function (STATE) {
  // SIMULATED OVERLAY PREVIEW TRIGGER (NO FIREBASE WRITES)
  const btnSimulateOverlay = document.getElementById("btn-simulate-overlay");
  if (btnSimulateOverlay) {
    btnSimulateOverlay.addEventListener("click", () => {
      const fakeSupport = {
        _key: "simulated_test_" + Date.now(),
        name: "ShadowSlayer (Test)",
        amount: 500,
        msg: "This is a simulated test alert for OBS and LiveNow!",
        approvedAt: Date.now(),
      };

      if (
        typeof overlayQueue !== "undefined" &&
        typeof processNextOverlayAlert === "function"
      ) {
        overlayQueue.push(fakeSupport);
        processNextOverlayAlert();
        alert("Simulated test alert triggered on Overlay!");
      } else if (window.firebaseDB) {
        window.firebaseDB.pushOverlayAlert(fakeSupport, fakeSupport._key);
        alert("Test alert pushed to Overlay queue!");
      }
    });
  }
};
