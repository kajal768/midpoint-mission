import express from 'express'
import { appendFile, mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const app = express()
const port = 5000
const root = path.dirname(fileURLToPath(import.meta.url))
const dataDir = process.env.MIDPOINT_DATA_DIR || path.join(root, 'data')
const eventsFile = path.join(dataDir, 'activity.ndjson')
app.use(express.json({ limit: '8kb' }))

app.get('/api/health', (_req, res) => res.json({ ok: true }))

app.post('/api/events', async (req, res) => {
  const { sessionId, eventType, page, details } = req.body ?? {}
  if (typeof sessionId !== 'string' || !/^[a-zA-Z0-9-]{8,80}$/.test(sessionId)) {
    return res.status(400).json({ error: 'A valid anonymous sessionId is required.' })
  }
  if (typeof eventType !== 'string' || !/^[a-z_]{2,40}$/.test(eventType)) {
    return res.status(400).json({ error: 'A valid eventType is required.' })
  }
  const safeDetails = details && typeof details === 'object' && !Array.isArray(details) ? details : {}
  const event = {
    sessionId,
    eventType,
    page: typeof page === 'string' ? page.slice(0, 30) : 'unknown',
    details: Object.fromEntries(Object.entries(safeDetails).slice(0, 12)),
    createdAt: new Date().toISOString(),
  }
  try {
    await mkdir(dataDir, { recursive: true })
    await appendFile(eventsFile, `${JSON.stringify(event)}\n`, 'utf8')
    return res.status(201).json({ ok: true })
  } catch (error) {
    console.error('Could not store activity event:', error)
    return res.status(500).json({ error: 'Could not save activity.' })
  }
})

app.get('/api/user/:sessionId/summary', async (req, res) => {
  const { sessionId } = req.params
  if (!/^[a-zA-Z0-9-]{8,80}$/.test(sessionId)) return res.status(400).json({ error: 'A valid anonymous sessionId is required.' })
  try {
    const raw = await readFile(eventsFile, 'utf8').catch((error) => error.code === 'ENOENT' ? '' : Promise.reject(error))
    const events = raw.split('\n').filter(Boolean).flatMap((line) => {
      try { const event = JSON.parse(line); return event.sessionId === sessionId ? [event] : [] } catch { return [] }
    })
    const count = (type) => events.filter((event) => event.eventType === type).length
    const guesses = events.filter((event) => event.eventType.includes('guess'))
    res.json({
      guest: `Guest-${sessionId.slice(-4).toUpperCase()}`,
      totalEvents: events.length,
      lessonsStarted: count('search_started'),
      lessonsCompleted: count('lesson_completed'),
      practiceSessions: count('practice_started'),
      roundsCompleted: count('practice_round_completed'),
      comparisons: count('comparison_started'),
      guesses: guesses.length,
      correctGuesses: guesses.filter((event) => event.details?.correct === true).length,
      hints: count('hint_used'),
      recentActivity: events.slice(-12).reverse().map((event) => ({ eventType: event.eventType, page: event.page, at: event.createdAt, details: event.details })),
    })
  } catch (error) {
    console.error('Could not read learner summary:', error)
    res.status(500).json({ error: 'Could not load your dashboard.' })
  }
})

app.get('/api/admin/summary', async (_req, res) => {
  try {
    const raw = await readFile(eventsFile, 'utf8').catch((error) => error.code === 'ENOENT' ? '' : Promise.reject(error))
    const events = raw.split('\n').filter(Boolean).flatMap((line) => {
      try { return [JSON.parse(line)] } catch { return [] }
    })
    const bySession = new Map()
    for (const event of events) {
      const row = bySession.get(event.sessionId) ?? { sessionId: event.sessionId, events: 0, guesses: 0, correct: 0, hints: 0, lastActive: event.createdAt, actions: [] }
      row.events += 1
      if (event.eventType.includes('guess')) {
        row.guesses += 1
        if (event.details?.correct === true) row.correct += 1
      }
      if (event.eventType === 'hint_used') row.hints += 1
      if (event.createdAt > row.lastActive) row.lastActive = event.createdAt
      row.actions.push({ eventType: event.eventType, page: event.page, at: event.createdAt, details: event.details })
      bySession.set(event.sessionId, row)
    }
    const sessions = [...bySession.values()].map((row) => ({
      ...row,
      guest: `Guest-${row.sessionId.slice(-4).toUpperCase()}`,
      actions: row.actions.slice(-8).reverse(),
    })).sort((a, b) => b.lastActive.localeCompare(a.lastActive))
    res.json({ totalEvents: events.length, totalSessions: sessions.length, totalGuesses: events.filter((event) => event.eventType.includes('guess')).length, totalCorrect: events.filter((event) => event.eventType.includes('guess') && event.details?.correct === true).length, totalHints: events.filter((event) => event.eventType === 'hint_used').length, sessions })
  } catch (error) {
    console.error('Could not read activity summary:', error)
    res.status(500).json({ error: 'Could not load Insights.' })
  }
})

app.listen(port, '127.0.0.1', () => console.log(`Midpoint Mission API ready at http://localhost:${port}`))
