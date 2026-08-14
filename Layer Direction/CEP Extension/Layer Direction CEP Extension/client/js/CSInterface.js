/*
    MINIMAL CSInterface shim - NOT Adobe's official file.

    This exposes only what Layer Direction actually uses: evalScript() (to
    call into host/main.jsx) and hostEnvironment (to read After Effects'
    own panel background/accent colors later, if we want the panel to
    theme itself automatically to match the user's AE color settings).

    Before distributing this extension to anyone else, replace this file
    with Adobe's official CSInterface.js:
      https://github.com/Adobe-CEP/CEP-Resources -> CEP_12.x/CSInterface.js
    It's free, MIT-style redistributable per Adobe's own CEP license, and
    has the full API (events, extension list, flyout menus, etc.) that this
    shim intentionally leaves out to stay small while we're iterating.
*/

function CSInterface() {}

CSInterface.prototype.hostEnvironment = window.__adobe_cep__
    ? JSON.parse(window.__adobe_cep__.getHostEnvironment())
    : null;

CSInterface.prototype.getHostEnvironment = function () {
    this.hostEnvironment = JSON.parse(window.__adobe_cep__.getHostEnvironment());
    return this.hostEnvironment;
};

CSInterface.prototype.evalScript = function (script, callback) {
    if (callback === null || callback === undefined) {
        callback = function () {};
    }
    window.__adobe_cep__.evalScript(script, callback);
};

CSInterface.prototype.getExtensionID = function () {
    return window.__adobe_cep__.getExtensionId();
};

CSInterface.prototype.closeExtension = function () {
    window.__adobe_cep__.closeExtension();
};
