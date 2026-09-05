/* ===================================================================
   PAYUU LIVE PLATFORM V40 - THEME CONTROLLER MODULE
   =================================================================== */

class ThemeController {
    constructor() {
        this.currentTheme = "darkblue";
    }

    setTheme(themeName) {
        if (!themeName) return;
        this.currentTheme = themeName.toLowerCase();
        document.body.setAttribute('data-theme', this.currentTheme);
    }

    getTheme() {
        return this.currentTheme;
    }
}

window.themeController = new ThemeController();