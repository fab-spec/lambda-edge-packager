const packager = require('./index')

packager('./test-data/linc-demo.zip', './dist', { API_URL: 'https://localhost:8080/api' })
