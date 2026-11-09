import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    fullyParallel: true,
    use: { baseURL: 'http://127.0.0.1:4173', browserName: 'chromium' },
    webServer: {
        command: 'node tests/server.js',
        url: 'http://127.0.0.1:4173/tests/fixture.html',
        reuseExistingServer: false
    }
});
