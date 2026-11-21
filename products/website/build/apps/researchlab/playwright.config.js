const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: ['smoke.spec.js', 'dashboard-probe.spec.js'],
  timeout: 90_000,
  workers: 1,
  fullyParallel: false,
  // В CI один повтор: две «плавающие» ошибки (сетевой сбой загрузки markdown
  // и гонка темы с догрузкой CSS) не должны ронять гейт. Повторы видны в
  // отчёте как flaky — сводка tools/smoke-summary.py их считает отдельно.
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/smoke.json' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    channel: 'chrome',
    ignoreHTTPSErrors: true,
    trace: 'off',
    // Service Worker кэширует ответы (SWR) и переживает перезагрузки страницы:
    // в тестах он отдавал устаревшие данные и добавлял сетевые ошибки в консоль.
    // Каждый прогон обязан видеть сеть, а не прошлый кэш.
    serviceWorkers: 'block'
  },
  webServer: {
    // HTTP/1.1 обязателен: при HTTP/1.0 (умолчание http.server) лаба открывает
    // ~180 соединений на страницу — это и медленно, и даёт отказы под нагрузкой.
    command: 'python -m http.server 4173 --bind 127.0.0.1 --protocol HTTP/1.1',
    cwd: __dirname,
    url: 'http://127.0.0.1:4173/index.html',
    reuseExistingServer: true,
    timeout: 120_000
  },
  projects: [{ name: 'smoke', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } }]
});