import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Award, BookOpen,
  Check, CheckCircle2, ChevronRight, CircleHelp, Clock3, Code2,
  Flame, Gauge, Lightbulb, ListChecks, Play, RotateCcw, Sparkles,
  Target, Trophy, X,
} from 'lucide-react'

const INITIAL = [3, 8, 12, 17, 23, 31, 42]
const PAGE_NAMES = ['Home', 'Dashboard', 'Learn', 'Practice', 'Compare', 'Insights', 'Results']

function getSessionId() {
  const key = 'midpoint-mission-session'
  let id = localStorage.getItem(key)
  if (!id) {
    id = globalThis.crypto?.randomUUID?.() ?? `guest-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    localStorage.setItem(key, id)
  }
  return id
}

function midpoint(low, high) {
  return Math.floor((low + high) / 2)
}

function getSearchSteps(values, target) {
  const steps = []
  let low = 0
  let high = values.length - 1
  while (low <= high) {
    const mid = midpoint(low, high)
    steps.push({ low, high, mid, value: values[mid], found: values[mid] === target })
    if (values[mid] === target) break
    if (values[mid] < target) low = mid + 1
    else high = mid - 1
  }
  return steps
}

function makeRound() {
  const start = 10 + Math.floor(Math.random() * 10)
  const gap = 2 + Math.floor(Math.random() * 2)
  const values = Array.from({ length: 7 }, (_, i) => start + i * gap)
  return { values, target: values[Math.floor(Math.random() * values.length)] }
}

function App() {
  const [sessionId] = useState(getSessionId)
  const [page, setPage] = useState('Home')
  const [targetInput, setTargetInput] = useState('23')
  const [learnTarget, setLearnTarget] = useState(23)
  const [learnStep, setLearnStep] = useState(-1)
  const [learnCompleted, setLearnCompleted] = useState(false)
  const [learnMessage, setLearnMessage] = useState('Choose a target, then start the guided search.')
  const [practice, setPractice] = useState(() => makeRound())
  const [practiceBounds, setPracticeBounds] = useState({ low: 0, high: 6 })
  const [practiceScore, setPracticeScore] = useState(0)
  const [practiceRound, setPracticeRound] = useState(1)
  const [practiceFeedback, setPracticeFeedback] = useState('Compare the middle value with your target, then choose a side.')
  const [practiceAnswered, setPracticeAnswered] = useState(false)
  const [practiceFirstGuessMade, setPracticeFirstGuessMade] = useState(false)
  const [compareTarget, setCompareTarget] = useState(42)
  const [raceRunning, setRaceRunning] = useState(false)
  const [raceTick, setRaceTick] = useState(0)
  const [lastResult, setLastResult] = useState({ score: 4, rounds: 5, target: 23 })
  const [showHint, setShowHint] = useState(false)

  const learnValues = INITIAL
  const learnSteps = useMemo(() => getSearchSteps(learnValues, learnTarget), [learnTarget])
  const activeLearn = learnSteps[Math.max(0, learnStep)]
  const targetIsValid = Number.isFinite(Number(targetInput)) && Number(targetInput) >= 0

  function track(eventType, details = {}) {
    fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, eventType, page, details }),
    }).catch(() => {})
  }

  useEffect(() => { track('page_view') }, [page])

  useEffect(() => {
    if (!raceRunning) return undefined
    const timer = window.setInterval(() => setRaceTick((tick) => {
      if (tick >= 7) {
        window.clearInterval(timer)
        setRaceRunning(false)
        return 7
      }
      return tick + 1
    }), 550)
    return () => window.clearInterval(timer)
  }, [raceRunning])

  function startLearn() {
    const value = Number(targetInput)
    if (!Number.isFinite(value)) return
    setLearnTarget(value)
    setLearnStep(0)
    setLearnCompleted(false)
    const first = learnValues[midpoint(0, learnValues.length - 1)]
    setLearnMessage(value === first
      ? `The middle value is ${first}. We found your target in the first check!`
      : value > first
        ? `${first} is smaller than ${value}, so the target can only be on the right.`
        : `${first} is larger than ${value}, so the target can only be on the left.`)
    setPage('Learn')
    track('search_started', { target: value })
  }

  function nextLearnStep() {
    if (learnStep < 0) return startLearn()
    if (learnStep >= learnSteps.length - 1) {
      if (learnCompleted) return
      setLearnCompleted(true)
      setLearnMessage(learnSteps[learnSteps.length - 1]?.found
        ? `Found ${learnTarget} after ${learnSteps.length} comparison${learnSteps.length === 1 ? '' : 's'}.`
        : `${learnTarget} is not in this array. Binary Search ruled out every possible position.`)
      track('lesson_completed', { target: learnTarget, comparisons: learnSteps.length, found: Boolean(learnSteps[learnSteps.length - 1]?.found) })
      return
    }
    const next = learnStep + 1
    const step = learnSteps[next]
    setLearnStep(next)
    if (step.found) setLearnMessage(`Found it! ${step.value} is the target. We needed ${next + 1} comparisons.`)
    else if (step.value < learnTarget) setLearnMessage(`${step.value} is smaller than ${learnTarget}. The left side is ruled out; keep the right half.`)
    else setLearnMessage(`${step.value} is larger than ${learnTarget}. The right side is ruled out; keep the left half.`)
  }

  function guessLearn(side) {
    if (learnStep < 0 || !activeLearn || activeLearn.found || learnStep >= learnSteps.length - 1) return
    if (learnTarget === activeLearn.value) {
      setLearnMessage(`Exactly! ${activeLearn.value} is the target, so the search ends here.`)
      return
    }
    const correctSide = learnTarget > activeLearn.value ? 'right' : 'left'
    track('guided_guess', { target: learnTarget, midpoint: activeLearn.value, side, correct: side === correctSide })
    if (side === correctSide) {
      setLearnMessage(`Correct — ${activeLearn.value} is ${correctSide === 'right' ? 'smaller' : 'larger'} than ${learnTarget}, so we keep the ${correctSide} half. Press “Next step” to reveal it.`)
    } else {
      setLearnMessage(`Not quite. ${activeLearn.value} is ${correctSide === 'right' ? 'smaller' : 'larger'} than ${learnTarget}, so the target must be on the ${correctSide}. Try the other side.`)
    }
  }

  function resetLearn() {
    setLearnStep(-1)
    setLearnCompleted(false)
    setLearnMessage('Choose a target, then start the guided search.')
  }

  function beginPractice() {
    setPractice(makeRound())
    setPracticeBounds({ low: 0, high: 6 })
    setPracticeScore(0)
    setPracticeRound(1)
    setPracticeFeedback('Compare the middle value with your target, then choose a side.')
    setPracticeAnswered(false)
    setPracticeFirstGuessMade(false)
    setShowHint(false)
    setPage('Practice')
    track('practice_started')
  }

  function chooseSide(side) {
    if (practiceAnswered) return
    const { low, high } = practiceBounds
    const mid = midpoint(low, high)
    const midValue = practice.values[mid]
    if (practice.target === midValue) {
      track('practice_guess', { target: practice.target, midpoint: midValue, side: 'found', correct: true, round: practiceRound })
      const earnsPoint = !practiceFirstGuessMade
      if (earnsPoint) setPracticeScore((score) => score + 1)
      setPracticeFirstGuessMade(true)
      setPracticeFeedback(`Exactly! The middle value is ${midValue}, so the target is already found.${earnsPoint ? ' You earned the round point!' : ''}`)
      setPracticeAnswered(true)
      setLastResult({ score: practiceScore + (earnsPoint ? 1 : 0), rounds: 5, target: practice.target })
      track('practice_round_completed', { round: practiceRound, correct: earnsPoint, score: practiceScore + (earnsPoint ? 1 : 0) })
      return
    }
    const correctSide = practice.target > midValue ? 'right' : 'left'
    const isCorrect = side === correctSide
    track('practice_guess', { target: practice.target, midpoint: midValue, side, correct: isCorrect, round: practiceRound })
    const newBounds = correctSide === 'right' ? { low: mid + 1, high } : { low, high: mid - 1 }
    setPracticeBounds(newBounds)
    const earnsPoint = isCorrect && !practiceFirstGuessMade
    if (isCorrect) {
      if (earnsPoint) setPracticeScore((score) => score + 1)
      setPracticeFirstGuessMade(true)
      setPracticeFeedback(`Correct! ${midValue} is ${correctSide === 'right' ? 'less' : 'greater'} than ${practice.target}, so we keep the ${correctSide} half.${earnsPoint ? ' You earned the round point!' : ''}`)
    } else {
      setPracticeFirstGuessMade(true)
      setPracticeFeedback(`Not quite. Since ${midValue} is ${correctSide === 'right' ? 'less' : 'greater'} than ${practice.target}, the target must be on the ${correctSide}.`)
    }
    setPracticeAnswered(true)
    const nextMid = newBounds.low <= newBounds.high ? midpoint(newBounds.low, newBounds.high) : -1
    if (newBounds.low > newBounds.high || practice.values[nextMid] === practice.target) {
      const finalScore = practiceScore + (earnsPoint ? 1 : 0)
      setLastResult({ score: finalScore, rounds: 5, target: practice.target })
      track('practice_round_completed', { round: practiceRound, correct: finalScore > practiceScore, score: finalScore })
    }
  }

  function continuePractice() {
    setPracticeAnswered(false)
    setShowHint(false)
    setPracticeFeedback('Compare the middle value with your target, then choose a side.')
  }

  function nextPracticeRound() {
    if (practiceRound >= 5) {
      setLastResult({ score: practiceScore, rounds: 5, target: practice.target })
      setPage('Results')
      return
    }
    setPractice(makeRound())
    setPracticeBounds({ low: 0, high: 6 })
    setPracticeRound((round) => round + 1)
    setPracticeAnswered(false)
    setPracticeFirstGuessMade(false)
    setShowHint(false)
    setPracticeFeedback('Compare the middle value with your target, then choose a side.')
  }

  function runRace() {
    setRaceTick(0)
    setRaceRunning(true)
  }

  function goResults() {
    setLastResult({ score: practiceScore, rounds: 5, target: practice.target })
    setPage('Results')
    track('results_viewed', { score: practiceScore, rounds: 5 })
  }

  const content = {
    Home: <HomePage go={setPage} startLearn={startLearn} targetInput={targetInput} setTargetInput={setTargetInput} />,
    Dashboard: <LearnerDashboard sessionId={sessionId} onGo={setPage} />,
    Learn: <LearnPage targetInput={targetInput} setTargetInput={setTargetInput} targetIsValid={targetIsValid} target={learnTarget} step={learnStep} steps={learnSteps} active={activeLearn} message={learnMessage} completed={learnCompleted} onStart={startLearn} onNext={nextLearnStep} onGuess={guessLearn} onReset={resetLearn} />,
    Practice: <PracticePage practice={practice} bounds={practiceBounds} score={practiceScore} round={practiceRound} feedback={practiceFeedback} answered={practiceAnswered} hint={showHint} onGuess={chooseSide} onHint={() => { setShowHint(true); track('hint_used', { round: practiceRound }) }} onContinue={continuePractice} onNext={nextPracticeRound} onResults={goResults} />,
    Compare: <ComparePage target={compareTarget} setTarget={setCompareTarget} running={raceRunning} tick={raceTick} onRun={() => { track('comparison_started', { target: compareTarget }); runRace() }} />,
    Insights: <InsightsPage sessionId={sessionId} />,
    Results: <ResultsPage result={lastResult} onAgain={beginPractice} onLearn={() => { resetLearn(); setPage('Learn') }} />,
  }[page]

  return (
    <div className="min-h-screen bg-[#f5f8ff] text-ink">
      <Header page={page} setPage={setPage} sessionId={sessionId} />
      <main className="mx-auto max-w-[1320px] px-5 pb-12 pt-8 sm:px-8 lg:px-10">{content}</main>
      <footer className="mx-auto flex max-w-[1320px] items-center justify-between border-t border-blue-100 px-5 py-5 text-xs text-slate-400 sm:px-8 lg:px-10">
        <span>Midpoint Mission · Learn by making the next move</span>
        <span className="hidden sm:inline">Built for curious minds ✦</span>
      </footer>
    </div>
  )
}

function Header({ page, setPage, sessionId }) {
  const links = PAGE_NAMES.slice(1, 6)
  return (
    <header className="sticky top-0 z-20 border-b border-blue-100/80 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto max-w-[1320px] px-4 sm:px-8 lg:px-10">
       <div className="flex h-[66px] items-center justify-between gap-2 sm:h-[72px]">
        <button onClick={() => setPage('Home')} className="flex min-w-0 items-center gap-2.5 text-left">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-white shadow-lg shadow-blue-200"><Code2 size={19} /></span>
          <span className="whitespace-nowrap text-sm font-extrabold tracking-tight text-ink sm:text-[15px]">Midpoint <span className="text-brand">Mission</span></span>
        </button>
        <nav aria-label="Main navigation" className="hidden items-center gap-0.5 lg:flex">
          {links.map((item) => <button key={item} onClick={() => setPage(item)} className={`nav-link ${page === item ? 'nav-link-active' : ''}`}>{item}</button>)}
        </nav>
        <div className="flex shrink-0 items-center gap-2"><span className="hidden text-[11px] font-bold text-slate-400 xl:inline">Guest-{sessionId.slice(-4).toUpperCase()}</span><button onClick={() => setPage('Learn')} className="button-primary h-9 px-3 text-xs sm:h-10 sm:px-4 sm:text-sm">Get started <ArrowRight size={14} /></button></div>
       </div>
       <nav aria-label="Mobile navigation" className="mobile-nav -mx-1 flex gap-1 overflow-x-auto pb-2 lg:hidden">
         {links.map((item) => <button key={item} onClick={() => setPage(item)} className={`nav-link shrink-0 px-3 py-2 text-xs ${page === item ? 'nav-link-active' : ''}`}>{item}</button>)}
       </nav>
      </div>
    </header>
  )
}

function HomePage({ go, startLearn, targetInput, setTargetInput }) {
  return (
    <div className="space-y-7 animate-fade-in">
      <section className="home-hero relative overflow-hidden px-5 pb-7 pt-10 text-center sm:px-10 sm:pt-12">
        <div className="hero-orb orb-one" /><div className="hero-orb orb-two" />
        <div className="relative z-10 mx-auto max-w-3xl">
          <div className="eyebrow"><Sparkles size={13} /> INTERACTIVE LEARNING</div>
          <h1 className="mt-5 text-4xl font-black leading-[1.08] tracking-[-0.04em] text-ink sm:text-5xl lg:text-[58px]">Find the answer <span className="text-brand">faster.</span></h1>
          <p className="mx-auto mt-4 max-w-[480px] text-base leading-7 text-slate-600 sm:text-lg">Learn Binary Search by making the next move.</p>
          <div className="mt-6 flex justify-center"><button onClick={startLearn} className="button-primary px-5 py-3">Start learning <ArrowRight size={17} /></button></div>
          <div className="home-array-scene mx-auto mt-8 max-w-2xl rounded-[22px] border border-white/80 bg-white/70 px-4 py-5 shadow-[0_18px_55px_-35px_rgba(44,91,205,0.45)] backdrop-blur sm:px-10 sm:py-7">
            <p className="mb-5 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">A sorted list · one smart choice at a time</p>
            <div className="array-row">{INITIAL.map((n, i) => <div key={n} className={`array-cell home-cell ${i === 4 ? 'home-target' : ''}`}>{n}</div>)}</div>
            <div className="mt-5 flex items-center justify-center gap-2 text-xs font-semibold text-brand"><ArrowUpRight size={14} /> Start in the middle. Eliminate half.</div>
          </div>
          <p className="mt-4 text-xs font-semibold text-slate-500">A 5-minute hands-on lesson · No sign-up needed</p>
        </div>
      </section>
      <section>
        <div className="mb-4 flex items-end justify-between"><div><p className="section-kicker">CHOOSE YOUR PATH</p><h2 className="mt-1 text-2xl font-extrabold tracking-tight">How do you want to learn?</h2></div><div className="hidden text-sm text-slate-500 sm:block">Three ways to make it click <ArrowDown className="ml-1 inline" size={14} /></div></div>
        <div className="grid gap-4 md:grid-cols-3">
          <ModeCard icon={<BookOpen size={20} />} title="Learn" text="Walk through Binary Search with clear, guided steps." action="Open lesson" color="blue" onClick={() => go('Learn')} />
          <ModeCard icon={<Target size={20} />} title="Practice" text="Make the call yourself. Get hints and instant feedback." action="Start a challenge" color="violet" onClick={() => go('Practice')} />
          <ModeCard icon={<Gauge size={20} />} title="Compare" text="Race Linear Search against Binary Search, side by side." action="See the difference" color="cyan" onClick={() => go('Compare')} />
        </div>
      </section>
    </div>
  )
}

function ModeCard({ icon, title, text, action, color, onClick }) {
  return <button onClick={onClick} className="mode-card group text-left"><span className={`mode-icon mode-${color}`}>{icon}</span><h3 className="mt-4 text-lg font-extrabold">{title}</h3><p className="mt-2 min-h-[48px] text-sm leading-6 text-slate-500">{text}</p><span className="mt-4 flex items-center gap-1 text-sm font-bold text-brand">{action}<ChevronRight size={15} className="transition-transform group-hover:translate-x-1" /></span></button>
}

function LearnPage({ targetInput, setTargetInput, targetIsValid, target, step, steps, active, message, completed, onStart, onNext, onGuess, onReset }) {
  const current = step >= 0 ? steps[step] : null
  const isDone = current?.found || (step >= 0 && step === steps.length - 1 && current && !current.found)
  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex items-center gap-4 rounded-2xl border border-blue-100 bg-white px-5 py-4 shadow-sm"><span className="shrink-0 text-xs font-bold text-slate-500">Lesson {step < 0 ? 1 : Math.min(steps.length, step + 1)} of 5</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand transition-all" style={{ width: `${step < 0 ? 18 : Math.min(100, 20 + (step + 1) * 20)}%` }} /></div><span className="hidden text-xs font-bold text-slate-400 sm:block">Binary Search basics</span></div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><p className="section-kicker">GUIDED STEP-BY-STEP LESSON</p><h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">Learn Binary Search</h1><p className="mt-2 text-sm text-slate-500">We'll find {target} step by step using the midpoint.</p></div><div className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-white px-4 py-2 shadow-sm"><div><span className="block text-[10px] font-bold text-slate-400">TARGET VALUE</span><strong className="text-2xl font-black text-brand">{target}</strong></div><div className="hidden h-9 w-px bg-blue-100 sm:block" /><div className="flex gap-1.5"><input aria-label="Change target value" className="input-field w-20 py-2" type="number" value={targetInput} onChange={(e) => setTargetInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && targetIsValid && onStart()} /><button disabled={!targetIsValid} onClick={onStart} className="button-secondary px-3 py-2 text-xs">Set</button></div></div></div>
      <section className="panel p-5 sm:p-7">
        {step < 0 && <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50/70 p-4"><p className="font-extrabold text-slate-800">Quick start · 3 simple moves</p><ol className="mt-2 grid gap-2 text-sm text-slate-600 sm:grid-cols-3"><li><b className="text-brand">1.</b> Press <b>Start</b> to highlight the middle.</li><li><b className="text-brand">2.</b> Compare the middle number with the target.</li><li><b className="text-brand">3.</b> Choose Left or Right, then press <b>Next step</b>.</li></ol></div>}
        <p className="section-kicker">SORTED ARRAY · LOW, MID AND HIGH</p>
        <ArrayView values={INITIAL} low={current?.low ?? 0} high={current?.high ?? 6} mid={current?.mid ?? -1} target={target} showTarget={step >= 0} />
        <div className="mt-6 rounded-2xl border border-blue-100 bg-[#f4f7ff] p-4 sm:p-5"><div className="flex items-start gap-3"><span className="coach-avatar"><Sparkles size={17} /></span><div className="flex-1"><p className="font-extrabold">Where should we search next?</p><p className="mt-1 text-sm leading-6 text-slate-500">{step < 0 ? 'Start the search, then choose which half may contain your target.' : message}</p></div></div><div className="mt-4 grid gap-2 sm:grid-cols-2 sm:pl-12"><button disabled={step < 0 || isDone || active?.found} onClick={() => onGuess('left')} className="button-answer"><ArrowLeft size={15} /> Left half <small>lower values</small></button><button disabled={step < 0 || isDone || active?.found} onClick={() => onGuess('right')} className="button-answer"><ArrowRight size={15} /> Right half <small>higher values</small></button></div></div>
        {step >= 0 && <div className={`feedback-banner mt-3 ${active?.found || message.startsWith('Correct') ? 'feedback-success' : ''}`}><CheckCircle2 size={18} /><div><strong>{active?.found ? 'Target found!' : message.startsWith('Not quite') ? 'Try that decision again' : `Comparison ${step + 1}`}</strong><p>{message}</p></div></div>}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><div className="flex gap-2"><button className="button-secondary" onClick={onStart}><Play size={15} /> Start</button><button disabled={completed} className="button-primary px-5" onClick={onNext}>{completed ? <>Lesson complete <Check size={15} /></> : step < 0 ? <>Next step <ArrowRight size={15} /></> : isDone ? <>Lesson summary <Check size={15} /></> : <>Next step <ArrowRight size={15} /></>}</button><button className="button-secondary" onClick={onReset}><RotateCcw size={15} /> Reset</button></div><div className="text-xs font-semibold text-slate-400">{step >= 0 ? `Comparison ${Math.min(step + 1, steps.length)} of ${steps.length}` : 'Ready when you are'}</div></div>
      </section>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500"><Lightbulb size={15} className="text-amber-500" /><b className="text-slate-700">Remember:</b> The list must be sorted so each comparison safely removes half of the remaining options.</div>
    </div>
  )
}

function ArrayView({ values, low, high, mid, target, showTarget }) {
  return <div className="array-scroll mt-8"><div className="array-row min-w-[520px]">{values.map((value, i) => {
    const eliminated = i < low || i > high
    const isMid = i === mid
    const isTarget = showTarget && value === target
    return <div key={`${value}-${i}`} className="array-item"><div className={`array-cell ${isMid ? 'array-mid' : ''} ${isTarget ? 'array-target' : ''} ${eliminated ? 'array-eliminated' : ''}`}><span>{value}</span>{isMid && <span className="array-marker">mid</span>}</div><span className="array-index">{i}</span><span className={`array-bound ${i === low ? 'bound-low' : ''} ${i === high ? 'bound-high' : ''}`}>{i === low ? 'low' : i === high ? 'high' : ''}</span></div>
  })}</div></div>
}

function PageHeading({ kicker, title, subtitle, progress }) {
  return <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="section-kicker">{kicker}</p><h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{subtitle}</p></div>{progress && <span className="rounded-full border border-blue-100 bg-white px-3 py-2 text-xs font-bold text-slate-500">{progress}</span>}</div>
}

function PracticePage({ practice, bounds, score, round, feedback, answered, hint, onGuess, onHint, onContinue, onNext, onResults }) {
  const mid = midpoint(bounds.low, bounds.high)
  const midValue = practice.values[mid]
  const found = midValue === practice.target
  const nextMid = bounds.low <= bounds.high ? midpoint(bounds.low, bounds.high) : -1
  const foundOnNextCheck = answered && nextMid >= 0 && practice.values[nextMid] === practice.target
  const done = answered && (found || bounds.low > bounds.high || foundOnNextCheck)
  return (
    <div className="animate-fade-in">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="text-xs font-bold text-slate-500">Challenge {round} of 5</span><div className="flex gap-1">{Array.from({ length: 5 }, (_, i) => <span key={i} className={`h-2 w-5 rounded-full ${i < round ? 'bg-brand' : 'bg-slate-200'}`} />)}</div></div><div className="flex gap-2"><span className="stat-pill"><Flame size={14} className="text-orange-500" /> Streak: {Math.max(0, score)}</span><span className="stat-pill"><Award size={14} className="text-brand" /> Score: {score} / 5</span></div></div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><p className="section-kicker">INTERACTIVE CHALLENGE</p><h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">Your turn!</h1><p className="mt-2 text-sm text-slate-500">Use Binary Search to find the target value.</p></div><div className="target-box"><span>Target value</span><strong>{practice.target}</strong></div></div>
      <section className="panel p-5 sm:p-7">
        <p className="section-kicker">SORTED ARRAY · CURRENT RANGE {bounds.low}–{bounds.high}</p>
        <div className="array-scroll mt-4"><div className="array-row min-w-[520px]">{practice.values.map((value, i) => { const out = i < bounds.low || i > bounds.high; return <div className="array-item" key={i}><div className={`array-cell ${i === mid && !out ? 'array-mid' : ''} ${value === practice.target ? 'array-target' : ''} ${out ? 'array-eliminated' : ''}`}><span>{value}</span>{i === mid && !out && <span className="array-marker">mid</span>}</div><span className="array-index">{i}</span><span className="array-bound">{i === bounds.low ? 'low' : i === bounds.high ? 'high' : ''}</span></div>})}</div></div>
        <div className="mt-6 rounded-2xl bg-[#f4f7ff] p-4 sm:p-5"><div className="text-center"><h2 className="font-extrabold">Where should we search next?</h2><p className="mt-1 text-sm text-slate-500">Compare the middle value <b className="text-ink">{midValue}</b> with the target and choose a side.</p></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><button onClick={() => onGuess('left')} disabled={answered || done} className={`guess-card justify-center ${answered && practice.target < midValue ? 'guess-correct' : ''}`}><ArrowLeft size={18} /><span><b>Left half</b><small>Indices {bounds.low}–{Math.max(bounds.low, mid - 1)}</small></span></button><button onClick={() => onGuess('right')} disabled={answered || done} className={`guess-card justify-center ${answered && practice.target > midValue ? 'guess-correct' : ''}`}><span><b>Right half</b><small>Indices {Math.min(bounds.high, mid + 1)}–{bounds.high}</small></span><ArrowRight size={18} /></button></div></div>
        {hint && <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm text-amber-900"><Lightbulb size={15} className="mr-1 inline" /> {practice.target === midValue ? 'The target is the midpoint itself—it has already been found.' : `${practice.target} is ${practice.target > midValue ? 'greater' : 'less'} than ${midValue}. Follow that direction.`}</div>}
        {answered && <div className={`feedback-banner mt-4 ${done ? 'feedback-success' : ''}`}><CheckCircle2 size={18} /><div><strong>{done ? 'Target found!' : feedback.startsWith('Correct') ? 'Correct choice!' : 'Not quite yet'}</strong><p>{feedback}</p></div></div>}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><button className="button-secondary" onClick={onHint}><Lightbulb size={15} /> Hint</button>{answered && <button className="button-primary" onClick={done ? (round >= 5 ? onResults : onNext) : onContinue}>{done ? round >= 5 ? 'See results' : 'Next challenge' : 'Continue search'} <ArrowRight size={15} /></button>}</div>
      </section>
    </div>
  )
}

function ComparePage({ target, setTarget, running, tick, onRun }) {
  const linearChecks = Math.min(tick, INITIAL.indexOf(target) >= 0 ? INITIAL.indexOf(target) + 1 : INITIAL.length)
  const binarySteps = getSearchSteps(INITIAL, target)
  const binaryChecks = Math.min(tick, binarySteps.length)
  const currentBinary = binarySteps[binaryChecks - 1]
  return (
    <div className="animate-fade-in">
      <PageHeading kicker="SIDE-BY-SIDE VISUALIZATION" title="Race the Searches" subtitle="Same sorted list. Same target. Watch how each algorithm gets there." />
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm"><div className="flex items-center gap-2"><Target size={17} className="text-brand" /><span className="text-sm font-bold">Target number</span><input type="number" min="0" className="input-field ml-1 w-24 py-2" value={target} onChange={(e) => setTarget(Number(e.target.value))} /></div><div className="flex items-center gap-3"><span className="hidden text-xs text-slate-400 sm:inline">Change target to replay the comparison</span><button onClick={onRun} className="button-primary px-4 py-2.5"><Play size={15} /> {running ? 'Racing…' : 'Start race'}</button></div></div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2"><SearchRaceCard type="linear" checks={linearChecks} target={target} /> <SearchRaceCard type="binary" checks={binaryChecks} target={target} current={currentBinary} /></div>
      <div className="mt-5 panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-500"><Lightbulb size={20} /></span><div><p className="font-extrabold">What should you notice?</p><p className="mt-1 text-sm leading-6 text-slate-500">Linear Search checks items one by one. Binary Search uses the sorted order to remove half of the remaining possibilities after each comparison.</p></div><div className="sm:ml-auto sm:min-w-[145px] sm:text-right"><div className="font-mono text-xl font-black text-brand">O(n) <span className="text-slate-300">vs</span> O(log n)</div><span className="text-[11px] text-slate-400">time complexity</span></div></div>
    </div>
  )
}

function SearchRaceCard({ type, checks, target, current }) {
  const linearIndex = INITIAL.indexOf(target)
  const isBinary = type === 'binary'
  const title = isBinary ? 'Binary Search' : 'Linear Search'
  const description = isBinary ? 'Eliminates half the search range each step.' : 'Checks each value in order, one by one.'
  const completed = checks > 0 && (isBinary ? (current?.found || checks >= getSearchSteps(INITIAL, target).length) : checks >= (linearIndex >= 0 ? linearIndex + 1 : INITIAL.length))
  return <section className="panel overflow-hidden"><div className="flex items-start justify-between border-b border-blue-50 p-5"><div className="flex gap-3"><span className={`grid h-10 w-10 place-items-center rounded-xl ${isBinary ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>{isBinary ? <Sparkles size={19} /> : <ListChecks size={19} />}</span><div><h2 className="font-extrabold">{title}</h2><p className="mt-1 text-xs text-slate-500">{description}</p></div></div><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${isBinary ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{isBinary ? 'SMARTER' : 'BASELINE'}</span></div>
    <div className="p-5"><div className="grid grid-cols-7 gap-1.5 sm:gap-2">{INITIAL.map((value, i) => { const linearVisited = i < checks && !isBinary; const binaryExcluded = isBinary && checks > 0 && current && (i < current.low || i > current.high) && !current.found; const binaryCurrent = isBinary && checks > 0 && current?.mid === i; const found = value === target && (linearVisited || binaryCurrent || completed); return <div key={i} className={`race-cell ${found ? 'race-found' : ''} ${linearVisited ? 'race-checked' : ''} ${binaryExcluded ? 'race-excluded' : ''} ${binaryCurrent && !found ? 'race-midpoint' : ''}`}>{binaryExcluded ? <X size={16} /> : found ? <Check size={16} /> : value}{binaryCurrent && !found && <span className="race-step-label">mid</span>}</div>})}</div>
      <div className="mt-5 flex items-center justify-between"><span className="text-xs text-slate-400">{isBinary ? 'Midpoint checks' : 'Values checked'}</span><span className={`text-2xl font-black ${isBinary ? 'text-emerald-600' : 'text-slate-600'}`}>{checks}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full transition-all duration-500 ${isBinary ? 'bg-emerald-500' : 'bg-slate-400'}`} style={{ width: `${(checks / 7) * 100}%` }} /></div><p className="mt-3 text-xs leading-5 text-slate-500">{completed ? `Target ${target} ${linearIndex < 0 ? 'was not found' : 'found'} in ${checks} ${checks === 1 ? 'comparison' : 'comparisons'}.` : checks ? `Checking ${isBinary ? `midpoint ${current?.value ?? ''}` : `value ${INITIAL[checks - 1]}`}` : 'Ready to start.'}</p></div>
  </section>
}

function LearnerDashboard({ sessionId, onGo }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  async function refresh() {
    setLoading(true)
    try {
      const response = await fetch(`/api/user/${encodeURIComponent(sessionId)}/summary`)
      if (!response.ok) throw new Error('Could not load your progress. Make sure npm run dev is running.')
      setData(await response.json())
      setError('')
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { refresh() }, [sessionId])
  const accuracy = data?.guesses ? Math.round((data.correctGuesses / data.guesses) * 100) : 0
  const hasStarted = ((data?.lessonsStarted ?? 0) + (data?.practiceSessions ?? 0) + (data?.comparisons ?? 0)) > 0
  const tiles = [
    { label: 'Lessons completed', value: data?.lessonsCompleted ?? 0, icon: <BookOpen size={17}/>, tone: 'blue' },
    { label: 'Practice rounds', value: data?.roundsCompleted ?? 0, icon: <Target size={17}/>, tone: 'violet' },
    { label: 'Guess accuracy', value: `${accuracy}%`, icon: <CheckCircle2 size={17}/>, tone: 'green' },
    { label: 'Hints used', value: data?.hints ?? 0, icon: <Lightbulb size={17}/>, tone: 'amber' },
  ]
  return <div className="animate-fade-in space-y-6">
    <section className="dashboard-hero relative overflow-hidden rounded-3xl border border-blue-100 p-5 sm:p-8">
      <div className="relative z-10 flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
        <div><span className="eyebrow"><Sparkles size={13}/> YOUR LEARNING SPACE</span><h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Welcome back, {data?.guest ?? `Guest-${sessionId.slice(-4).toUpperCase()}`}!</h1><p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">Your Binary Search journey lives here. Learn one idea, practice it, and watch your confidence grow.</p></div>
        <div className="flex flex-wrap gap-2"><button onClick={() => onGo('Learn')} className="button-primary px-4 py-3 text-sm"><BookOpen size={15}/> Continue learning</button><button onClick={() => onGo('Practice')} className="button-secondary px-4 py-3 text-sm"><Target size={15}/> Practice</button></div>
      </div>
      <div className="dashboard-orb" aria-hidden="true"/>
    </section>
    {error && <div className="feedback-banner"><CircleHelp size={18}/><div><strong>Progress is temporarily unavailable</strong><p>{error}</p></div></div>}
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{tiles.map((tile) => <div className="panel flex items-center gap-3 p-4 sm:p-5" key={tile.label}><span className={`dashboard-icon dashboard-${tile.tone}`}>{tile.icon}</span><div><p className="text-xs font-bold text-slate-500">{tile.label}</p><strong className="mt-1 block text-2xl font-black text-ink">{loading ? '…' : tile.value}</strong></div></div>)}</section>
    <div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
      <section className="panel p-5 sm:p-6"><div className="flex items-start justify-between gap-3"><div><p className="section-kicker">YOUR PROGRESS</p><h2 className="mt-1 text-xl font-extrabold">Small steps add up</h2></div><button onClick={refresh} className="button-secondary px-3 py-2 text-xs">Refresh</button></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-[#f5f8ff] p-4"><div className="flex items-center justify-between"><span className="text-sm font-bold">Practice accuracy</span><span className="text-lg font-black text-brand">{accuracy}%</span></div><div className="mt-3 h-2.5 overflow-hidden rounded-full bg-blue-100"><div className="h-full rounded-full bg-brand transition-all" style={{width:`${accuracy}%`}}/></div><p className="mt-2 text-xs text-slate-500">{data?.correctGuesses ?? 0} correct out of {data?.guesses ?? 0} guesses</p></div><div className="rounded-2xl bg-[#f5f8ff] p-4"><span className="text-sm font-bold">Learning path</span><div className="mt-3 flex items-center gap-2 text-xs font-bold"><span className={`path-step ${hasStarted ? 'path-step-done' : ''}`}>{hasStarted ? <Check size={12}/> : '1'}</span><span>Learn</span><span className="h-px flex-1 bg-blue-200"/><span className={`path-step ${(data?.roundsCompleted ?? 0) ? 'path-step-done' : ''}`}>{(data?.roundsCompleted ?? 0) ? <Check size={12}/> : '2'}</span><span>Practice</span><span className="h-px flex-1 bg-blue-200"/><span className={`path-step ${(data?.comparisons ?? 0) ? 'path-step-done' : ''}`}>{(data?.comparisons ?? 0) ? <Check size={12}/> : '3'}</span><span>Compare</span></div><p className="mt-3 text-xs text-slate-500">{hasStarted ? 'Nice progress. Practice next to build confidence.' : 'Start the lesson to begin your path.'}</p></div></div>
      </section>
      <section className="panel p-5 sm:p-6"><p className="section-kicker">NEXT UP</p><h2 className="mt-1 text-xl font-extrabold">{hasStarted && !(data?.roundsCompleted) ? 'Try a practice round' : 'Learn the midpoint move'}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{hasStarted && !(data?.roundsCompleted) ? 'You have started learning. Now test your understanding with a short challenge and instant feedback.' : 'Binary Search works on sorted data. Compare the middle value, then safely remove half of the remaining list.'}</p><button onClick={() => onGo(hasStarted && !(data?.roundsCompleted) ? 'Practice' : 'Learn')} className="button-primary mt-4 px-4 py-2.5 text-sm">{hasStarted && !(data?.roundsCompleted) ? 'Start practice' : 'Open lesson'} <ArrowRight size={15}/></button><p className="mt-3 text-[11px] text-slate-400">No account needed · Your progress is saved for this browser session ID</p></section>
    </div>
    <section className="panel overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-50 p-5"><div><p className="section-kicker">ACTIVITY</p><h2 className="mt-1 font-extrabold">Your recent learning</h2></div><span className="text-xs text-slate-400">{loading ? 'Loading…' : `${data?.totalEvents ?? 0} actions recorded`}</span></div>
      {!data?.recentActivity?.length ? <div className="p-7 text-center"><p className="font-bold text-slate-700">Your activity will appear here</p><p className="mt-1 text-sm text-slate-500">Start the lesson or practice a round to see your progress.</p></div> : <div className="space-y-2 p-4 sm:p-5">{data.recentActivity.map((action, index) => <div key={`${action.at}-${index}`} className="activity-card"><span className="activity-dot"><Check size={12}/></span><div className="min-w-0 flex-1"><b className="block capitalize text-slate-700">{action.eventType.replaceAll('_', ' ')}</b><span className="text-xs text-slate-400">{action.page}{action.details?.target != null ? ` · target ${action.details.target}` : ''}{action.details?.correct != null ? ` · ${action.details.correct ? 'correct' : 'incorrect'}` : ''}</span></div><time className="shrink-0 text-[10px] text-slate-400">{new Date(action.at).toLocaleString()}</time></div>)}</div>}
    </section>
    <p className="text-xs text-slate-400">Progress is tied to this browser’s anonymous Guest ID. Opening another browser creates a separate learner dashboard.</p>
  </div>
}

function InsightsPage({ sessionId }) {
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  async function loadSummary() {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/summary')
      if (!response.ok) throw new Error('Insights API did not respond. Start the app with npm run dev.')
      setSummary(await response.json())
      setError('')
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { loadSummary() }, [])
  const Stat = ({ title, value, icon }) => <div className="panel p-4"><div className="flex items-center justify-between text-xs font-bold text-slate-500"><span>{title}</span><span className="text-brand">{icon}</span></div><strong className="mt-2 block text-3xl font-black text-ink">{value ?? '—'}</strong></div>
  return <div className="animate-fade-in space-y-6">
    <PageHeading kicker="LOCAL DEMO ANALYTICS" title="Learning Insights" subtitle="See what anonymous guest sessions tried, where they practiced, and how often guesses were correct." />
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm"><span><b>Your browser ID:</b> Guest-{sessionId.slice(-4).toUpperCase()} <span className="text-slate-500">· stays anonymous</span></span><button onClick={loadSummary} className="button-secondary px-3 py-2 text-xs">Refresh</button></div>
    {error && <div className="feedback-banner"><CircleHelp size={18}/><div><strong>Insights not available</strong><p>{error}</p></div></div>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Stat title="Guest sessions" value={summary?.totalSessions} icon={<Target size={16}/>} /><Stat title="Recorded actions" value={summary?.totalEvents} icon={<ListChecks size={16}/>} /><Stat title="Guesses" value={summary?.totalGuesses} icon={<ArrowLeft size={16}/>} /><Stat title="Correct guesses" value={summary?.totalCorrect} icon={<Check size={16}/>} /><Stat title="Hints used" value={summary?.totalHints} icon={<Lightbulb size={16}/>} /></div>
    <section className="panel overflow-hidden"><div className="flex items-center justify-between border-b border-blue-50 p-5"><div><h2 className="font-extrabold">Recent guest sessions</h2><p className="mt-1 text-xs text-slate-500">Updates from the local server · {loading ? 'Loading…' : `${summary?.sessions?.length ?? 0} sessions`}</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">No accounts collected</span></div>
      {!summary?.sessions?.length ? <div className="p-8 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-brand"><Sparkles size={22}/></div><h3 className="mt-3 font-extrabold">Your first learner will show up here</h3><p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">Open Learn or Practice in another tab, make a guess, then refresh this page. Each browser gets an anonymous Guest ID.</p></div> : <div className="divide-y divide-blue-50">{summary.sessions.map((session) => <details key={session.sessionId} className="group p-4 sm:p-5"><summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3"><div><b>{session.guest}</b><p className="mt-1 text-xs text-slate-400">Last active {new Date(session.lastActive).toLocaleString()}</p></div><div className="flex gap-2"><span className="stat-pill">{session.events} actions</span><span className="stat-pill">{session.correct}/{session.guesses} correct</span><span className="stat-pill">{session.hints} hints</span></div></summary><div className="mt-4 space-y-2">{session.actions.map((action, index) => <div key={`${action.at}-${index}`} className="timeline-row"><span className="timeline-dot timeline-dot-active"><Check size={11}/></span><b className="text-slate-700">{action.eventType.replaceAll('_', ' ')}</b><span>· {action.page}</span>{action.details?.target != null && <span>· target {action.details.target}</span>}{action.details?.midpoint != null && <span>· midpoint {action.details.midpoint}</span>}{action.details?.correct != null && <span>· {action.details.correct ? 'correct' : 'incorrect'}</span>}<time className="ml-auto text-[10px]">{new Date(action.at).toLocaleTimeString()}</time></div>)}</div></details>)}</div>}
    </section>
    <p className="text-xs leading-5 text-slate-400">Demo note: Guest IDs identify a browser profile, not a real person. Activity is stored locally in <code>data/activity.ndjson</code>; clearing the file resets this demo’s history.</p>
  </div>
}

function ResultsPage({ result, onAgain, onLearn }) {
  const target = result.target ?? 23
  const binaryChecks = getSearchSteps(INITIAL, target).length || 4
  const linearChecks = INITIAL.indexOf(target) >= 0 ? INITIAL.indexOf(target) + 1 : INITIAL.length
  return <div className="mx-auto max-w-4xl animate-fade-in"><div className="results-hero panel relative overflow-hidden px-5 py-9 text-center sm:px-10 sm:py-12"><div className="result-spark spark-a">✦</div><div className="result-spark spark-b">✦</div><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 text-amber-500"><Trophy size={28} /></div><p className="section-kicker mt-5">MISSION COMPLETE</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Great work! You found it.</h1><p className="mt-2 text-sm text-slate-500">Every step you made helped Binary Search narrow the possibilities.</p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-[#f5f8ff] p-5"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Your practice score</p><p className="mt-2 text-4xl font-black text-brand">{result.score}<span className="text-2xl text-slate-300"> / {result.rounds}</span></p><p className="mt-1 text-xs text-slate-500">correct predictions</p></div><div className="rounded-2xl bg-[#f5f8ff] p-5"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Search comparison</p><div className="mt-3 flex items-center justify-center gap-8"><div><strong className="block text-3xl font-black text-emerald-600">{binaryChecks}</strong><span className="text-xs text-slate-500">Binary checks</span></div><span className="text-slate-300">vs</span><div><strong className="block text-3xl font-black text-rose-500">{linearChecks}</strong><span className="text-xs text-slate-500">Linear checks</span></div></div></div></div>
      <div className="mt-4 flex items-start gap-3 rounded-2xl bg-blue-50 p-4 text-left"><span className="text-amber-500"><Lightbulb size={19} /></span><div><b className="text-sm">Key insight</b><p className="mt-1 text-sm leading-6 text-slate-600">Sorted data lets Binary Search remove half the remaining options at each step. That's why it scales so well to large lists.</p></div></div>
      <div className="mt-6 flex flex-wrap justify-center gap-3"><button onClick={onAgain} className="button-primary px-5 py-3"><RotateCcw size={15} /> Try again</button><button onClick={onLearn} className="button-secondary px-5 py-3"><BookOpen size={15} /> Review the lesson</button></div>
    </div></div>
}

export default App
