"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLUGIN_NAME = exports.PLATFORM_NAME = void 0;
const config_schema_json_1 = require("../config.schema.json");
const package_json_1 = require("../package.json");
/**
 * This is the name of the platform that users will use to register the plugin in the Homebridge config.json
 */
exports.PLATFORM_NAME = config_schema_json_1.pluginAlias;
/**
 * This must match the name of your plugin as defined the package.json
 */
exports.PLUGIN_NAME = package_json_1.name;
//# sourceMappingURL=settings.js.map