const lambda = require('./dist/index')
const event = require('./test-data/post.json')

lambda.handler(event)
