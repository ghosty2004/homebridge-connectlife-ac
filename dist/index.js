"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const settings_js_1 = require("./settings.js");
const platform_1 = require("./platform");
/**
 * This method registers the platform with Homebridge
 */
exports.default = (api) => {
    api.registerPlatform(settings_js_1.PLATFORM_NAME, platform_1.ConnectLifeAcPlatformPlugin);
};
//# sourceMappingURL=index.js.map