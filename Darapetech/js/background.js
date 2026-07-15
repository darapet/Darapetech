/* =========================================
   DARAPET TECHNOLOGY — Background Injector
   Runs on every page — creates the plain
   premium white background layer
   ========================================= */
(function () {
  'use strict';

  /* Create fixed #site-bg container (styling lives in background.css) */
  const siteBg = document.createElement('div');
  siteBg.id = 'site-bg';

  /* Insert as first child of body */
  document.body.insertBefore(siteBg, document.body.firstChild);
})();
