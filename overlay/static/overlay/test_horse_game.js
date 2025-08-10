var g_HorseGame = undefined;

window.addEventListener('load', function(e) {

  (async () => {
    g_HorseGame = new HorseGame(417, 6); // Math.floor(1000 * Math.random() + 1));
    
    await g_HorseGame.setup();

    g_HorseGame.addCanvas($(document.body));

    g_HorseGame.drawFixtures = true;

  })();

}, false);