import { pluginAlias as platforName } from '../config.schema.json';
import { name as pluginName } from '../package.json';

/**
 * This is the name of the platform that users will use to register the plugin in the Homebridge config.json
 */
export const PLATFORM_NAME = platforName;

/**
 * This must match the name of your plugin as defined the package.json
 */
export const PLUGIN_NAME = pluginName;
