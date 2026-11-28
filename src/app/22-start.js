  // (the script runs at the end of the body, with the LEDs parsed and init, which waits for DOMContentLoaded, still to come: a frame can come between)
  nameLeds();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
