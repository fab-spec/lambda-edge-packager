const fs = require('fs')
const path = require('path')
const promisify = require('util').promisify

const zip = promisify(require('deterministic-zip'))
const nanoid = require('nanoid/non-secure')
const fetch = require('node-fetch')
const rimraf = promisify(require('rimraf'))
const tar = require('tar')
const unzip = promisify(require('extract-zip'))

const shim = require('./shim.js')

const ensureDir = (dir) => {
  console.log({ dir })
  if (!fs.existsSync(dir)) {
    console.log(`creating: ${dir}`)
    fs.mkdirSync(dir)
  }
}

const unzip_fab = async (fab_file, work_dir) => {
  await ensureDir(work_dir)
  await unzip(fab_file, { dir: path.resolve(work_dir) })
}

const downloadNodeFetch = async (file) => {
  const url = 'https://registry.npmjs.org/node-fetch/-/node-fetch-2.3.0.tgz'
  const response = await fetch(url)
  const buffer = await response.buffer()
  fs.writeFileSync(file, buffer)
}

const fixServerPath = async (work_dir) => {
  const bundle_path = path.join(work_dir, 'server', 'bundle.js')
  const server_path = path.join(work_dir, 'server.js')
  if (fs.existsSync(bundle_path) && !fs.existsSync(server_path)) {
    fs.copyFileSync(bundle_path, server_path)
  }
}

const installNodeFetch = async (work_dir) => {
  const node_modules_dir = path.join(work_dir, 'node_modules')
  await ensureDir(node_modules_dir)
  const fetch_download_file = path.join(work_dir, 'node-fetch.tgz')
  await downloadNodeFetch(fetch_download_file)
  await tar.extract({ file: fetch_download_file, cwd: node_modules_dir })
  const from = path.join(node_modules_dir, 'package')
  const to = path.join(node_modules_dir, 'node-fetch')
  fs.renameSync(from, to)
  fs.unlinkSync(fetch_download_file)
}

const zipLambda = async (output_dir, work_dir) => {
  const zipfile = path.join(output_dir, 'lambda.zip')
  await zip(work_dir, zipfile, {
    includes: ['./index.js', './server.js', './node_modules/**'],
    cwd: work_dir,
  })
}

const zipAssets = async (output_dir, work_dir) => {
  const zipfile = path.join(output_dir, 'assets.zip')
  await zip(work_dir, zipfile, { includes: ['./_assets/**'], cwd: work_dir })
}

const package = async (fab_file, output_dir) => {
  await ensureDir(output_dir)
  const work_dir = path.join(output_dir, nanoid())
  await unzip_fab(fab_file, work_dir)
  await installNodeFetch(work_dir)
  await fixServerPath(work_dir)
  fs.writeFileSync(path.join(work_dir, 'index.js'), shim)
  await zipLambda(output_dir, work_dir)
  await zipAssets(output_dir, work_dir)
  await rimraf(work_dir, { glob: { cwd: output_dir } })
}

module.exports = package
