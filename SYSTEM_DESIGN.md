# Ad → Landing Page Personalization Engine

### An AI-Powered Multi-Agent System That Bridges the Gap Between Ads and Landing Pages

> Built with **Gemini 2.5 Flash** · **Next.js 14** · **TypeScript** · **Cheerio** · **Framer Motion**

---

## Table of Contents

1. [What This System Does](#1-what-this-system-does)
2. [Architecture Overview](#2-architecture-overview)
3. [System Flow — End to End](#3-system-flow--end-to-end)
4. [Agent Design — Deep Dive](#4-agent-design--deep-dive)
5. [Handling Edge Cases & Failures](#5-handling-edge-cases--failures)
6. [Evaluation Framework](#6-evaluation-framework)
7. [Research — What Already Exists & What I Learned From](#7-research--what-already-exists--what-i-learned-from)
8. [Tech Stack & Setup](#8-tech-stack--setup)

---

## 1. What This System Does

Think about the last time you clicked an ad that promised something specific — say "50% off running shoes" — and ended up on a generic page that just said "Welcome to our store." That disconnect is what we call **message mismatch**, and it's one of the biggest conversion killers in digital marketing.

This system solves that problem automatically.

It takes two simple inputs:

| Input | What It Is |
|-------|-----------|
| **Ad Creative** | An image — could be a Facebook ad, a Google display banner, an Instagram post, anything visual |
| **Landing Page URL** | The page a user would land on after clicking that ad |

From there, the system reads the ad like a marketer would, understands what it's promising, scrapes the landing page, and then **rewrites the page copy so it actually matches what the ad said**. No manual rewriting. No guesswork.

But here's where it goes further — it doesn't just make changes and hope for the best. A dedicated Verifier agent reviews every single modification to catch hallucinations, broken page elements, off-brand copy, and random changes before anything reaches the user.

What you get at the end:
- A personalized version of the landing page with aligned headlines, CTAs, and body copy
- A confidence score and estimated conversion lift
- A full verification report showing what was checked and what was flagged
- Complete agent execution traces, so you can see exactly what happened at each step
- Learning data stored for future runs, so the system gets smarter over time

---

## 2. Architecture Overview

The system follows a four-agent architecture, each with a clearly defined role. They don't operate independently — an Orchestrator coordinates the entire flow, manages retries when things go wrong, and collects traces for full observability.

```
┌─────────────────────────────────────────────────────────────────┐
│                        ORCHESTRATOR                             │
│                     (The Planner Agent)                         │
│                                                                 │
│   Coordinates all agents · Manages retries · Collects traces    │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ PLANNER  │→ │ EXECUTOR │→ │ VERIFIER │→ │  MEMORY  │        │
│  │          │  │          │  │          │  │          │        │
│  │ Analyze  │  │ CRO      │  │ Halluc.  │  │ Store    │        │
│  │ Ad + Page│  │ Optimize │  │ Broken   │  │ Patterns │        │
│  │          │  │ + Apply  │  │ Random   │  │ + Learn  │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
│                                                                 │
│  Retry Logic: 2 retries · Exponential backoff · Validation      │
└─────────────────────────────────────────────────────────────────┘
```

Here's how I think about each role:

| Agent | Role | What It Actually Does |
|-------|------|----------------------|
| **Planner** | Understand | Looks at the ad creative with Gemini Vision, pulls out the messaging, tone, audience, and urgency. Then scrapes the landing page and maps out its structure. |
| **Executor** | Act | Scores how well the page currently matches the ad, identifies the biggest gaps, and rewrites the copy to close them — using real CRO principles, not random edits. |
| **Verifier** | Guard | The skeptic in the room. Runs five parallel checks to catch hallucinations, broken HTML, tone mismatches, brand violations, and unjustified changes. |
| **Memory** | Learn | Records what worked and what didn't. Classifies the ad type, stores successful patterns, and feeds learnings back into future runs. |

---

## 3. System Flow — End to End

### Phase 1: PLANNER — Understanding the Inputs

The user uploads an ad image and enters the landing page URL. The system kicks off by trying to deeply understand both.

```
User uploads ad image + enters landing page URL
              │
              ▼
┌──────────────────────────────┐
│   Ad Analyzer (Gemini Vision) │
│                              │
│  Extracts:                   │
│  • Headline & sub-headline   │
│  • Value proposition         │
│  • Target audience           │
│  • Tone & brand voice        │
│  • Keywords & CTA            │
│  • Emotional triggers        │
│  • Color scheme              │
│  • Urgency level             │
│                              │
│  Guardrails:                 │
│  ✓ Validates output shape    │
│  ✓ Retries 2x on failure    │
│  ✓ Low temperature (0.3)     │
└──────────────────────────────┘
              │
              ▼
┌──────────────────────────────┐
│   Page Scraper (Cheerio)     │
│                              │
│  • Fetches landing page HTML │
│  • Extracts page structure   │
│  • Identifies: headings,     │
│    CTAs, body text, meta     │
│  • Records element selectors │
│    for precise modification  │
└──────────────────────────────┘
```

The Ad Analyzer uses Gemini's vision capabilities to read the ad like a human marketer would — pulling out not just the obvious stuff like the headline, but subtler things like emotional triggers, urgency levels, and brand voice. This context is critical for making changes that actually feel coherent.

The Page Scraper fetches the landing page and breaks it down into a structured map of elements — headings, buttons, body paragraphs, hero sections. Each element gets a selector so the Personalizer can find and modify it precisely later.

### Phase 2: EXECUTOR — Making It Better

Now that we understand the ad and the page, the Executor steps in with two sub-agents.

```
              │
              ▼
┌──────────────────────────────┐
│   CRO Optimizer (Gemini)     │
│                              │
│  Applies 7 CRO Principles:  │
│  1. Message Match            │
│  2. Scent Trail              │
│  3. Single Focus             │
│  4. Social Proof             │
│  5. Urgency Alignment        │
│  6. Benefit-Oriented Copy    │
│  7. Friction Reduction       │
│                              │
│  Output:                     │
│  • Message match score 0-100 │
│  • 5-8 strategic changes     │
│  • Each with CRO rationale   │
│                              │
│  Guardrails:                 │
│  ✓ No fake testimonials      │
│  ✓ No fabricated statistics  │
│  ✓ Retries 2x on failure    │
└──────────────────────────────┘
              │
              ▼
┌──────────────────────────────┐
│   Personalizer (Cheerio DOM) │
│                              │
│  For each planned change:    │
│  1. Find element by type +   │
│     fuzzy text matching      │
│  2. Replace text content     │
│  3. Add visual indicator     │
│     (✨ Personalized badge)  │
│                              │
│  Matching Strategy:          │
│  • Exact text match          │
│  • Substring match           │
│  • Edit distance > 0.6      │
│                              │
│  If not found:               │
│  → Marked as [SUGGESTED]     │
│  → Skipped, not forced       │
└──────────────────────────────┘
```

The CRO Optimizer is where the real marketing intelligence lives. It doesn't just swap words randomly — it evaluates the page against the ad using seven established conversion rate optimization principles. It scores the current message match (0 to 100), identifies the biggest disconnects, and proposes 5-8 targeted changes. Each change comes with a rationale explaining which CRO principle it follows and why it should improve conversions.

The Personalizer then takes those proposed changes and applies them to the actual HTML. It uses fuzzy text matching (Levenshtein edit distance) to find the right elements, even when the text doesn't match exactly. If it can't find an element confidently enough, it doesn't force the change — it marks it as a suggestion instead. This is a deliberate design choice to avoid breaking things.

### Phase 3: VERIFIER — The Quality Gate

This is the part I'm most proud of. Making changes is easy. Making sure those changes are actually good? That's the hard part.

```
              │
              ▼
┌──────────────────────────────────────┐
│   Verifier Agent — The Guardian      │
│                                      │
│   Runs 5 checks IN PARALLEL:        │
│                                      │
│   ┌────────────────────────────┐     │
│   │ 1. Hallucination Detection │     │
│   │    Pass threshold: ≥ 80    │     │
│   │    Catches: fake stats,    │     │
│   │    invented claims         │     │
│   └────────────────────────────┘     │
│   ┌────────────────────────────┐     │
│   │ 2. Message Consistency     │     │
│   │    Pass threshold: ≥ 70    │     │
│   │    Catches: tone mismatch, │     │
│   │    audience deviation      │     │
│   └────────────────────────────┘     │
│   ┌────────────────────────────┐     │
│   │ 3. Structural Integrity    │     │
│   │    Pass threshold: ≥ 85    │     │
│   │    Catches: broken HTML,   │     │
│   │    missing tags, injection │     │
│   └────────────────────────────┘     │
│   ┌────────────────────────────┐     │
│   │ 4. Brand Safety            │     │
│   │    Pass threshold: ≥ 90    │     │
│   │    Catches: off-brand      │     │
│   │    copy, reputation risk   │     │
│   └────────────────────────────┘     │
│   ┌────────────────────────────┐     │
│   │ 5. CRO Alignment           │     │
│   │    Pass threshold: ≥ 75    │     │
│   │    Catches: unjustified    │     │
│   │    changes                 │     │
│   └────────────────────────────┘     │
│                                      │
│   Overall Pass: score ≥ 75 AND      │
│   no CRITICAL flagged issues        │
│                                      │
│   Auto-Fix: Critical issues are     │
│   flagged for immediate review      │
└──────────────────────────────────────┘
```

The Verifier runs five independent checks simultaneously. It uses a very low temperature (0.2) to keep its evaluations strict and consistent — the last thing you want is for the quality checker itself to be unpredictable.

The overall result only passes if the combined score is 75 or above AND there are zero critical-severity issues. If something serious is found, it gets auto-flagged for review rather than quietly slipping through.

### Phase 4: MEMORY — Learning From Every Run

```
              │
              ▼
┌──────────────────────────────┐
│   Memory Agent               │
│                              │
│  Captures from this run:     │
│  • Successful CRO patterns   │
│  • Failed/flagged patterns   │
│  • Message match delta       │
│  • Domain + ad type class    │
│                              │
│  Ad Type Classification:     │
│  • urgency-driven            │
│  • b2b-professional          │
│  • b2c-casual                │
│  • premium-aspirational      │
│  • general                   │
│                              │
│  Future Use:                 │
│  • Retrieve past patterns    │
│    for same domain/ad type   │
│  • Avoid repeating failures  │
│  • User feedback integration │
└──────────────────────────────┘
              │
              ▼
        ┌───────────┐
        │  RESULTS   │
        │            │
        │ • Preview  │
        │ • Changes  │
        │ • Traces   │
        │ • Metrics  │
        │ • Report   │
        └───────────┘
```

Every run is a learning opportunity. The Memory Agent captures which CRO patterns led to successful changes, which ones got flagged by the Verifier, and what the overall message match improvement was. It also classifies the ad by type — urgency-driven, B2B professional, B2C casual, premium aspirational — so that future runs on similar ads or the same domain can pull from past experience.

Users can also give thumbs up or thumbs down on the results. That feedback gets tied back to the specific patterns and domain, creating a genuine learning loop.

---

## 4. Agent Design — Deep Dive

### 4.1 The Orchestrator

The Orchestrator is the brain of the operation. It doesn't call the LLM itself — instead, it coordinates the other agents, decides what runs when, handles failures gracefully, and collects execution traces throughout.

**How retry logic works in practice:**

When an agent returns a result, the Orchestrator doesn't just accept it blindly. It runs a validation check specific to that agent. If the output doesn't meet expectations — say the Ad Analyzer returned no headline or the CRO Optimizer gave zero changes — it waits a moment (exponential backoff: 1 second, then 2 seconds) and tries again. After three total attempts, it records the failure and throws an error with full trace data.

Here's what gets validated at each step:

| Agent | What The Orchestrator Checks |
|-------|------------------------------|
| Ad Analyzer | Did it extract a headline, a value proposition, and at least one keyword? |
| CRO Optimizer | Is there a valid message match score and at least one proposed change? |
| Personalizer | Best-effort — if elements aren't found, they're skipped, not failed |
| Verifier | If parsing fails, safe fallback scores kick in instead of crashing |

**How confidence is calculated:**

The final confidence score isn't just a guess — it's a weighted formula:

```
score = (messageMatchScore × 0.3)
      + (verifierScore × 0.4)
      + (changesApplied × 3)
      + (successRate × 0.1)

Clamped to [40, 95]
```

The verifier score carries the most weight (40%), because a high message match means nothing if the changes are hallucinated. The ceiling is capped at 95 because no automated system should claim 100% confidence.

### 4.2 Ad Analyzer

This is where Gemini's vision capabilities shine. The analyzer looks at an ad image and extracts 11 distinct marketing signals — everything from the obvious (headline, CTA) to the nuanced (emotional triggers, brand voice, urgency level).

The temperature is set to 0.3. Low enough to keep outputs consistent and structured, but not so low that it can't pick up on subtle creative choices in the ad. Images are handled as base64 inline data, so both file uploads and image URLs work.

### 4.3 CRO Optimizer

This is the marketing brain. Rather than making changes based on vibes, it applies seven well-established CRO principles:

1. **Message Match** — Does the page headline mirror what the ad promised?
2. **Scent Trail** — Do visual and verbal cues carry through from ad to page?
3. **Single Focus** — Is there one clear CTA aligned with the ad's intent?
4. **Social Proof** — Are claims backed up with evidence?
5. **Urgency** — Does the page match the urgency level of the ad?
6. **Benefit-Oriented Copy** — Are features framed as benefits, aligned with the ad?
7. **Friction Reduction** — Is anything on the page working against the ad's promise?

The prompt explicitly forbids fabricating testimonials or statistics. Every proposed change must reference which CRO rule it follows and explain why it should improve conversion.

### 4.4 Personalizer

Unlike the other agents, the Personalizer doesn't use the LLM at all. It's pure DOM manipulation using Cheerio — a server-side HTML parser. This is intentional. You don't want an AI rewriting raw HTML — you want precise, predictable DOM operations.

The matching strategy uses Levenshtein edit distance with a 0.6 similarity threshold. This handles cases where the scraped text doesn't perfectly match the CRO Optimizer's reference text (whitespace differences, minor formatting, etc.). If a match falls below that threshold, the change is recorded as `[SUGGESTED]` — meaning "we think this should change, but we couldn't confidently find the element."

Every modified element gets a `data-personalized="true"` attribute and a small visual badge, so reviewers can instantly see what was changed.

### 4.5 Verifier

I designed the Verifier to be the skeptic in the pipeline. It assumes changes are wrong until proven otherwise.

Two verification streams run in parallel:

**Content integrity** (LLM-powered, temp 0.2): Evaluates every change for hallucination, consistency, brand safety, and CRO alignment. Returns four separate scores plus a list of specific issues found.

**Structural integrity** (code-based, no LLM): Checks that the HTML wasn't damaged. Looks at page size changes, critical tag preservation, and script injection attempts. Each violation carries a specific point penalty.

The prompt for content verification explicitly says: "Be strict. It's better to flag a false positive than let a hallucination through." This bias toward caution is deliberate — a false alarm is annoying, but a hallucination reaching a real user is a disaster.

### 4.6 Memory Agent

The Memory Agent doesn't use the LLM either. It's pure logic that records and retrieves patterns.

After every run, it captures which CRO rules led to successful changes, which modifications got flagged, the message match score, the domain, and an auto-classified ad type. When a new run comes in for the same domain or a similar ad type, the system can pull relevant past experience — what patterns worked, what failed, what to avoid.

The `getRelevantMemories()` function returns the five most recent matching entries, prioritizing same-domain results. User feedback (thumbs up/down) is associated with specific runs, so the learning loop reflects real human judgment, not just the Verifier's opinion.

---

## 5. Handling Edge Cases & Failures

### 5.1 Hallucinations

This is the biggest risk with any LLM-powered system. The model might make up a statistic ("97% of users agree"), invent a testimonial, or claim the product has features it doesn't.

Here's how the system addresses it at multiple layers:

| Layer | What We Do | Why It Matters |
|-------|------------|----------------|
| **Prompt-level prevention** | CRO Optimizer is explicitly told "Do NOT invent fake testimonials or statistics" | Reduces the likelihood at the source |
| **Temperature control** | Verifier runs at 0.2 to minimize creative improvisation | Keeps the quality checker itself from hallucinating |
| **Dedicated detection** | Verifier scores hallucination risk 0-100, comparing every change against the original ad and page content | Catches fabricated content after the fact |
| **Source grounding** | Every change must trace back to a CRO principle derived from the ad analysis | If a change can't justify its source, it's flagged |
| **Strict bias** | Verifier prompt says "flag a false positive rather than miss a hallucination" | Better to over-flag than to let something slip through |
| **Auto-flagging** | Any hallucination flagged as critical severity gets auto-flagged for immediate review | Critical issues never pass silently |

### 5.2 Broken UI

Modifying HTML is risky. One misplaced tag or a rogue script and the entire page can break.

Here's the safety net:

| Check | What It Catches | Penalty | Severity |
|-------|----------------|---------|----------|
| **Size delta** | If the HTML size changed by more than 30%, something likely went wrong structurally | −20 points | Medium |
| **Critical tags** | Missing `</head>`, `</body>`, or `</html>` means the page structure is compromised | −15 per tag | High |
| **Script injection** | Any new `<script>` containing `eval`, `document.write`, or `innerHTML` that wasn't in the original page | −30 points | Critical |

Beyond scoring, there are fundamental design choices that prevent breakage:

- The Personalizer uses Cheerio (server-side DOM) — it never executes JavaScript, so injected scripts can't run
- Changes are strictly text-level (copy modifications), never structural HTML changes
- If an element isn't found, the change is skipped entirely — it's never forced into a random location
- The original HTML is always preserved alongside the personalized version, so there's always a safe fallback

### 5.3 Random or Unjustified Changes

An LLM might decide to "improve" the footer, rewrite an unrelated paragraph, or make changes that have nothing to do with the ad. These random edits are subtle but dangerous — they erode trust in the system.

Here's how we prevent them:

| Layer | How It Works |
|-------|-------------|
| **Structural requirement** | Every proposed change must include a `croRule` field that maps to one of the seven CRO principles. No rule? No change. |
| **CRO Alignment check** | The Verifier specifically scores whether each change follows a legitimate CRO principle (threshold: 75) |
| **Change budget** | The CRO Optimizer is limited to 5-8 changes per run. This prevents the bulk random edits you'd see with an unconstrained model. |
| **Issue categorization** | The Verifier explicitly categorizes `random_change` as an issue type, with a description and suggested resolution |
| **Conservative matching** | The Personalizer only modifies elements it matches with a similarity score above 0.6. Low-confidence matches become suggestions, not applied changes. |

### 5.4 Inconsistent Outputs

Imagine a formal, B2B ad for enterprise software — and the system rewrites the landing page in casual, slang-filled copy. That's an inconsistency problem. Even if the words technically align with the ad's message, the tone is completely wrong.

Here's how the system catches this:

| Layer | How It Works |
|-------|-------------|
| **Message Consistency check** | The Verifier scores whether all changes align with the ad's tone, target audience, and messaging. The threshold is 70 — below that, the check fails. |
| **Brand Safety check** | A separate score (threshold: 90) evaluates whether any change could damage brand reputation or misrepresent the product. This has the highest bar of any check. |
| **Ad Analysis grounding** | The verifier compares every change against the `AdAnalysis` object, which captures the ad's exact tone, audience, voice, and emotional triggers. |
| **Retry on bad output** | If the CRO Optimizer produces output that fails validation, the Orchestrator retries up to two more times with exponential backoff. This handles cases where the model had one bad generation. |
| **Strict verifier temperature** | At 0.2, the Verifier itself is highly deterministic. You don't want the quality checker giving different answers on the same input. |

### 5.5 The Defense-in-Depth Model

No single layer of protection is enough. The system uses five layers, each catching what the previous one might miss:

```
Layer 1: PROMPT ENGINEERING
  └─ Explicit constraints baked into every agent's prompt
  └─ JSON-only output format to prevent freeform drift
  └─ Direct prohibitions: "Do NOT invent fake testimonials"

Layer 2: VALIDATION GATES
  └─ Orchestrator validates every agent's output before accepting it
  └─ Shape checks (required fields exist) + content checks (values make sense)
  └─ Failed validation triggers retry with exponential backoff

Layer 3: VERIFIER AGENT
  └─ Five independent quality checks running in parallel
  └─ Content integrity (LLM) + structural integrity (code)
  └─ Auto-flagging for critical issues — they never pass silently
  └─ Overall gate: score ≥ 75 AND zero critical issues

Layer 4: SAFE DEFAULTS
  └─ Elements not found → skipped, never force-applied
  └─ Verifier parse failure → safe fallback scores instead of crash
  └─ Original HTML always preserved as a fallback
  └─ Base URL injection to fix relative paths in the preview

Layer 5: OBSERVABILITY
  └─ Full agent traces with timestamps and durations
  └─ Retry counts and failure reasons logged per agent
  └─ 8-metric evaluation dashboard visible to the user
  └─ User feedback loop that feeds into the Memory Agent
```

---

## 6. Evaluation Framework

### Metrics Tracked Per Run

Every single run produces eight quantitative metrics. These aren't just internal diagnostics — they're displayed to the user in a live dashboard, so there's full transparency into how well the system performed.

| Metric | What It Measures | What "Good" Looks Like |
|--------|-----------------|------------------------|
| **Output Success Rate** | What percentage of agents completed without errors | 100% means every agent ran clean |
| **Task Completion Rate** | How much of the pipeline actually finished (uses verifier score for partial completions) | 100% means the full pipeline succeeded |
| **Verifier Pass Rate** | How many of the five quality checks passed | 100% means no quality concerns |
| **Avg Execution Time** | Mean time per agent, in milliseconds | Under 5 seconds per agent is the target |
| **Hallucinations Caught** | How many fabricated-content issues the Verifier flagged | Zero is ideal — it means the Executor was clean |
| **Auto-Fixes Applied** | How many critical issues were automatically remediated | Zero is ideal — it means nothing critical was found |
| **Error Rate** | What percentage of agents threw errors | Zero means nothing broke |
| **Retry Rate** | What percentage of agents needed a second or third attempt | Zero means everything worked on the first try |

### Confidence Score

The confidence score is a composite number between 40 and 95. It's deliberately capped below 100 because no automated personalization system should claim certainty.

The weighting reflects priorities:
- **Verifier score (40%)** carries the most weight — quality matters more than anything
- **Message match (30%)** reflects how well the changes align with the ad
- **Number of changes applied** adds proportional weight — more successful modifications suggest a deeper personalization
- **Agent success rate (10%)** rewards smooth execution

### Feedback Loop

After seeing the results, users can rate them with a simple thumbs up or thumbs down. That rating gets stored in the Memory Agent alongside:
- Which domain was being personalized
- What type of ad it was (urgency-driven, B2B, B2C, premium, etc.)
- Which specific CRO patterns were used

This means the system genuinely learns. If message-match-style changes consistently get positive feedback for e-commerce sites, the system can lean into that pattern for similar future runs. If urgency copy keeps getting flagged or receiving negative feedback for a particular domain, the system learns to avoid it.

---

## 7. Research — What Already Exists & What I Learned From

Before writing a single line of code, I spent time studying what's already out there — both in the landing page personalization space and in multi-agent AI architecture. Here's what I found and how it shaped my thinking.

### Existing Tools in This Space

**Instapage** ([instapage.com/products/personalization](https://instapage.com/products/personalization/))
Instapage is probably the closest thing to what this system does. They have a feature called AdMap that lets marketers connect specific ads to specific landing page experiences, and they generate copy variations for headlines and CTAs using AI. The catch? It's entirely manual. Someone has to sit there and create each personalized variant by hand, set up the audience rules, and manage the connections. Our system does all of that automatically — you give it an ad and a URL, and it figures out the rest.

**Mutiny** ([mutinyhq.com](https://www.mutinyhq.com/))
Mutiny takes a different angle — they're an AI agent for creating customer-facing content. What caught my attention is how they learn brand identity from your website and use it to keep everything on-brand. That's basically what our Memory Agent does, but Mutiny focuses more on sales enablement (deal rooms, business cases, proposals) while we're focused specifically on the ad-to-page message match problem.

**Unbounce** ([unbounce.com](https://unbounce.com/))
Unbounce popularized Dynamic Text Replacement (DTR) — where landing page text gets swapped based on which search keyword the visitor clicked. It's clever, but it's limited to keyword-level swaps. If your ad has a rich visual creative with emotional triggers, urgency cues, and a specific brand voice, DTR won't capture any of that. Our system analyzes the full ad creative visually and rewrites copy to match the complete message, not just a keyword.

**Optimizely** ([optimizely.com](https://www.optimizely.com/))
Optimizely is the enterprise standard for experimentation and landing page optimization. I studied their CRO methodology heavily — their documentation on message match, A/B testing, and conversion optimization principles directly influenced the seven CRO rules our system uses. They also recently started adding AI agents for experimentation, which validates the agent-based approach.

**Personyze** ([personyze.com](https://www.personyze.com/))
A website personalization engine that changes content based on visitor data like location, behavior, or referral source. It's rule-based rather than AI-driven, so it requires manual setup of every rule. Interesting to see as a baseline of where personalization was before LLMs made real-time content generation possible.

### What Makes This System Different

The key gap I noticed across all these tools: **none of them verify their own output**. They make changes and trust the result. There's no hallucination detection, no structural integrity check, no brand safety scoring. That's where the Verifier agent comes in — it's the piece that none of these existing products have, and it's arguably the most important part when you're letting an AI rewrite customer-facing content.

The other differentiator is the full automation. Existing tools require a human to set up each ad-to-page connection, create variants, and define rules. This system takes a raw ad image and a URL, and handles everything from analysis to personalization to verification to learning — all in one pipeline.

### Resources That Shaped the Architecture

For the multi-agent design (Planner → Executor → Verifier → Memory), I drew from:
- **CrewAI's role-based agent framework** — the idea that each agent has a specific role, goal, and backstory that shapes its behavior
- **LangGraph's orchestration patterns** — how to sequence agent calls with retry logic and conditional routing
- **Google's DeepMind research on tool-using agents** — the concept of agents that plan before executing, then verify their work

For the CRO principles, I studied:
- **Optimizely's optimization glossary** — their breakdown of message match, scent trail, and friction reduction
- **Unbounce's conversion intelligence research** — data on how DTR and personalization impact conversion rates
- **HubSpot's landing page statistics** — benchmarks like the average 5.89% conversion rate and how message match can push it significantly higher

---

## 8. Tech Stack & Setup

### Stack

| Component | Technology | Why This Choice |
|-----------|-----------|-----------------|
| **Framework** | Next.js 14 (App Router) | Server-side API routes + React UI in one project |
| **Language** | TypeScript | Type safety across the entire agent pipeline |
| **LLM** | Google Gemini 2.5 Flash (Vision + Text) | Fast, affordable, multimodal — handles both ad image analysis and text generation |
| **HTML Parsing** | Cheerio (server-side DOM) | Safe, predictable DOM manipulation without executing JavaScript |
| **Styling** | Tailwind CSS 3.4 | Rapid UI development with consistent design |
| **Animations** | Framer Motion | Smooth processing step animations and transitions |
| **UI Components** | Lucide React, React Dropzone, Sonner | Icons, drag-and-drop upload, toast notifications |

### Project Structure

```
src/
├── app/
│   ├── page.tsx                 # Main UI — input → processing → results flow
│   └── api/
│       ├── analyze/route.ts     # Standalone ad analysis endpoint
│       ├── scrape/route.ts      # Standalone page scraping endpoint
│       └── personalize/route.ts # Full orchestrated pipeline endpoint
│
├── lib/
│   ├── openai.ts                # Gemini client setup
│   ├── scraper.ts               # Page fetcher + structure extractor
│   └── agents/
│       ├── orchestrator.ts      # Pipeline coordinator with retry logic
│       ├── adAnalyzer.ts        # Gemini Vision — ad creative analysis
│       ├── croOptimizer.ts      # CRO analysis — message match scoring
│       ├── personalizer.ts      # Cheerio DOM — HTML modification
│       ├── verifier.ts          # Quality gate — 5 verification checks
│       └── memory.ts            # Learning loop — pattern storage
│
├── components/
│   ├── InputForm.tsx            # Ad upload + URL input form
│   ├── ProcessingSteps.tsx      # 6-step animated progress
│   ├── ResultView.tsx           # 6-tab result dashboard
│   ├── AgentArchitecture.tsx    # Agent pipeline visualization
│   ├── MetricsDashboard.tsx     # 8-metric evaluation grid
│   ├── VerificationReport.tsx   # Quality check results + flagged issues
│   └── AnimatedBackground.tsx   # Animated gradient background
│
└── types/
    └── index.ts                 # All TypeScript interfaces
```

### Quick Start

```bash
# Install dependencies
npm install

# Add your Gemini API key
echo "GEMINI_API_KEY=your-key-here" > .env.local

# Run development server
npm run dev

# Open http://localhost:3000
```
