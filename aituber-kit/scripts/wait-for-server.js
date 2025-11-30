/**
 * サーバーが起動するまで待機するスクリプト
 * localhost:3000が応答するまでポーリングします
 */

const http = require('http')

const MAX_RETRIES = 60 // 最大60回（約60秒）
const RETRY_INTERVAL = 1000 // 1秒間隔

function checkServer(port = 3000) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://localhost:${port}`, (res) => {
      resolve(true)
    })

    req.on('error', () => {
      resolve(false)
    })

    req.setTimeout(1000, () => {
      req.destroy()
      resolve(false)
    })
  })
}

async function waitForServer(port = 3000) {
  console.log(`Waiting for server on port ${port}...`)
  
  for (let i = 0; i < MAX_RETRIES; i++) {
    const isReady = await checkServer(port)
    if (isReady) {
      console.log(`Server is ready on port ${port}!`)
      process.exit(0)
    }
    
    if (i < MAX_RETRIES - 1) {
      process.stdout.write('.')
      await new Promise(resolve => setTimeout(resolve, RETRY_INTERVAL))
    }
  }
  
  console.log(`\nTimeout: Server did not start within ${MAX_RETRIES} seconds`)
  process.exit(1)
}

const port = process.argv[2] ? parseInt(process.argv[2], 10) : 3000
waitForServer(port)


