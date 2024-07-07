export const celsiusToFahrenheit = (celsius: number) => {
  return (celsius * 9) / 5 + 32;
};

export const fahrenheitToCelsius = (fahrenheit: number) => {
  return ((fahrenheit - 32) * 5) / 9;
};

export const capitalizeFirstWord = (str: string) =>
  str
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
