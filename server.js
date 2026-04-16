const express = require('express')
const puppeteer = require('puppeteer')
const { source: axeSource } = require('axe-core')

const app = express()
app.use(express.json())

app.post('/scan', async (req, res) => {
  const { url } = req.body
  if (!url) return res.status(400).json({ error: 'URL required' })

  let browser
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
      ]
    })

    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 800 })
    
    // Blockera bilder och fonts för snabbare laddning
    await page.setRequestInterception(true)
    page.on('request', (req) => {
      if (['image', 'font', 'media'].includes(req.resourceType())) {
        req.abort()
      } else {
        req.continue()
      }
    })

    await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: 60000
    })

    // Vänta lite extra på JS
    await new Promise(r => setTimeout(r, 2000))

    await page.evaluate(axeSource)

    const results = await page.evaluate(async () => {
      return await axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }
      })
    })

    const violations = results.violations.map(v => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      help: v.help,
      helpUrl: v.helpUrl,
      nodes: v.nodes.slice(0, 3).map(n => ({
        html: n.html,
        target: n.target,
        failureSummary: n.failureSummary
      })),
      count: v.nodes.length
    }))

    res.json({
      url,
      violations,
      violationCount: violations.length,
      criticalCount: violations.filter(v => v.impact === 'critical').length,
      seriousCount: violations.filter(v => v.impact === 'serious').length,
      moderateCount: violations.filter(v => v.impact === 'moderate').length,
      minorCount: violations.filter(v => v.impact === 'minor').length,
    })

  } catch (err) {
    res.status(500).json({ error: err.message })
  } finally {
    if (browser) await browser.close()
  }
})

app.get('/health', (_, res) => res.json({ ok: true }))

const PORT = process.env.PORT || 3333
app.listen(PORT, () => console.log(`Scanner running on port ${PORT}`))
