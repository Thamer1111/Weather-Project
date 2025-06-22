export const openWeatherConfig = {
  apiKey: process.env.OPENWEATHER_API_KEY || '716b0e0e8be966e0029c05c63e0292c1',
  baseUrl: 'https://api.openweathermap.org/data/2.5/weather',
  units: 'metric',
  cacheMinutes: parseInt(process.env.WEATHER_CACHE_MINUTES || '30', 10),
  staleCacheToleranceMinutes: parseInt(process.env.WEATHER_STALE_CACHE_TOLERANCE_MINUTES || '120', 10)
};
