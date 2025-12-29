"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.capitalizeFirstWord = exports.fahrenheitToCelsius = exports.celsiusToFahrenheit = void 0;
const celsiusToFahrenheit = (celsius) => {
    return (celsius * 9) / 5 + 32;
};
exports.celsiusToFahrenheit = celsiusToFahrenheit;
const fahrenheitToCelsius = (fahrenheit) => {
    return ((fahrenheit - 32) * 5) / 9;
};
exports.fahrenheitToCelsius = fahrenheitToCelsius;
const capitalizeFirstWord = (str) => str
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
exports.capitalizeFirstWord = capitalizeFirstWord;
//# sourceMappingURL=utils.js.map