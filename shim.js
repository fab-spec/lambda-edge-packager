module.exports = `
'use strict'
const URL = require('url').URL
const fetch = require('node-fetch')
const fab = require('./server')

const prodSettings = fab.getProdSettings ? fab.getProdSettings() : {}

global.fetch = fetch
global.Request = fetch.Request
global.Response = fetch.Response
global.Headers = fetch.Headers
global.URL = URL

const transformHeadersToFetch = (headers) => {
  const fetch_headers = new Headers()
  for (const header_name in headers) {
    for (const header_info of headers[header_name]) {
      fetch_headers.append(header_name, header_info.value)
    }
  }
  return fetch_headers
}

const excludedHeaders = new Set([
  'cache-control',
  'connection',
  'expect',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'proxy-connection',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'via',
  'x-accel-buffering',
  'x-accel-charset',
  'x-accel-limit-rate',
  'x-accel-redirect',
  'x-cache',
  'x-forwarded-proto',
  'x-real-ip'
])
const excludedHeaderPrefixes = [/^x-amz-/i, /^x-amzn-/i, /^x-edge-/i]

const transformHeadersFromFetch = (headers) => {
  const lambda_headers = {}
  for (let [header, value] of headers.entries()) {
    console.log({ header, value })
    if (excludedHeaders.has(header.toLowerCase())) continue
    if (excludedHeaderPrefixes.some(prefix => prefix.exec(header))) continue
    lambda_headers[header.toLowerCase()] = [{ header, value }]
  }
  return lambda_headers
}

const transformBody = (body) => {
  if (typeof body === 'string') {
    return { body, bodyEncoding: 'text' }
  } else {
    return { body: body.toString('base64'), bodyEncoding: 'base64' }
  }
}

exports.handler = async (event) => {
  const cf_request = event.Records[0].cf.request
  const host = cf_request.headers.host[0].value
  const url = \`https://\${host}\${cf_request.uri}\`
  const headers = transformHeadersToFetch(cf_request.headers)
  console.log({ url, headers })
  const fetch_request = new Request(url, {
    method: cf_request.method,
    headers,
  })

  const fetch_response = await fab.render(fetch_request, prodSettings)
  console.log({ fetch_response })
  const { body, bodyEncoding } = transformBody(fetch_response.body)
  const lambda_response = {
    status: '' + fetch_response.status,
    statusDescription: fetch_request.statusText,
    body,
    bodyEncoding,
    headers: transformHeadersFromFetch(fetch_response.headers),
  }
  console.log({ lambda_response })

  return lambda_response
}
`
