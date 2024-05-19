import { defineConfig } from 'cypress'

export default defineConfig({
  projectId: 'hp34pm',
    e2e: {
        "defaultCommandTimeout": 10000,
        "chromeWebSecurity": false,
        "experimentalSourceRewriting": true,
        "env": {
            "NODE_ENV": "test"
        },
        "baseUrl": 'http://localhost:3000',
        "specPattern": "./cypress/e2e/*.cy.js",

        "supportFile": false,
        "video": false
    },
})

