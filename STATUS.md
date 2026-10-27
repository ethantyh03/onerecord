# OneRecord build status (lead integrator log)

Deadline: **12:00 SGT Wed 28 Oct 2026**. The user is asleep until ~07:30 and has delegated every decision to the lead.

## Key docs
- Plan: `docs/superpowers/plans/2026-10-28-onerecord-build.md`
- Design: `C:\Users\ethan\OneDrive - Singapore Management University\04 Competitions & Hackathons\Data Case Competition 2026\docs\superpowers\specs\2026-10-23-onerecord-design.md`
- Final model (after the judge panel): same folder, `2026-10-28-final-model.md`
- Research facts: `...\docs\research\2026-10-23-business-case-facts.md`

## Decisions made overnight (for the user to review)
- Live link on Vercel. The user does a 1-minute "Continue with GitHub" login in the morning.
- Claude API is optional. If the user's credits work, the key goes into the Vercel env; otherwise the rules engine runs, with a badge.
- Video: the lead auto-records the screen with Playwright; the user narrates over it.
- GitHub: a private repo `ethantyh03/onerecord`, made public in the morning after a secrets scan, with the user's OK.
- 5th country: Myanmar (assumption A1).
- State lives in a client-side Zustand store with localStorage as the per-visitor sandbox. No DB, no Turso.

## Timeline
| Time (SGT) | Event |
|---|---|
| 00:25 | Session resumed; judge-panel grading workflow launched (wf_6d800672-722) |
| 00:35 | Scaffold done (Next 15.5.28, Tailwind 4, shadcn, vitest 5, playwright 1.64); private repo created |
| 00:45 | Wave 1 launched (wf_aa01d0d4-6cd): engine, store + seed, shell, mocks, then integrate |
| 00:50 | W1-E data science launched (wf_2a966514-261). Adopted DS-judge decisions: growth = trailing-12M YoY; leak-free 6-origin backtest; stress test; clean×method 2×2; held-out matcher eval; blind triage test set; summary.json is the single source of headline numbers |

| 00:55 | Judge panel + red-team done; final model at docs/superpowers/specs/2026-10-28-final-model.md (OneDrive). Adopted: no API route / no live LLM (cached + rules extraction), 36-month history, SoD, scene loader, pitch routes, /architecture /impact /scope /assumptions, messaging fixes (median 14 days → ≤4 business days; soften the "SAP can't approve" claim; Extend = BP update with U_Entities UDF; Product C pipeline-weighted forecast). DS workflow restarted as wf_ec189f32-2af. Wave 2 script pre-written at scratchpad/wave2.js |
| 00:55 | shadcn is the Base UI variant (no asChild; use render prop). Kept, because agents adapt. next.config: eslint.ignoreDuringBuilds |
| 00:56 | Both brief form links (S7 + S9) redirect to the SAME Google Form; it needs sign-in (401 when fetched anonymously) |

| 01:28 | Wave 1 DONE + committed (8522d90): tsc 0, vitest 192/192, build green. Cost-centre SAP key fixed to 8 chars (CC-SG-0031 → SG-0031 inside SAP). Marcus's BU = NEW_BU_TEMPLATE "MLS — Meridian Life Sciences" |
| 01:29 | Wave 2 launched (wf_59d75aac-07d) from scratchpad/wave2.js: lead patch, then intake/approvals/tracker/mdm/pulse-core/pulse-analytics/admin/story/scenes, then integrate + golden-path e2e |
| 01:29 | Usage pacing: builders at effort=high; heavy Wave 3/4 after the 5:20 AM usage reset; cron resume at 05:27 + hourly heartbeat at :43 |

| 02:11 | Wave 2 DONE + committed (fe37345): tsc 0, vitest 238, build 21 static pages, Playwright golden path 24/24. Expected live date for Amy = Tue 3 Nov (engine: 2+2 business days); use that in the VO |
| 02:20 | Wave 2b launched (wf_ba318939-d24): MLS molecular pre-check → item requests only (extend goes Business Support + Finance → MDM); triage rules improved on an independent dev set (blind test was 47%) |

| 02:28 | Wave 2b DONE + committed (0f24f0b): MLS pre-check for items only; triage blind 47% → 92% (rules built on an independent dev set) |
| 03:02 | DS DONE + committed (bf0f8f2). Headlines: S$53.4M +4.0% YoY; forecast off 11 → 9 per 100 (A+B, illustrative; gain seasonal); Bukit Damai MY #2 −32% once merged; matcher held-out P 0.929 / R 0.867; payback 5.9 mo; stress test passes (no-signal −0.6 pts) |
| 03:06 | Real-data build green; golden path 24/24. Server on :3100 (background). Wave 3 review/fix launched (wf_c60c0da1-e11) |

| ~03:10 | USAGE LIMIT REACHED. Wave 3 (wf_c60c0da1-e11) stopped mid-Fix phase: the working tree has UNCOMMITTED partial fixer edits (README, approvals page, e2e, business_case.py, …). On resume, run tsc + vitest first and keep or repair them. The :3100 server also exited |

| 05:27 | Resumed after the reset. Wave 3 resumed (verify only; reviewers/fixers cached). Prep (VO + TTS 2:36, Q&A + checklist) done |
| 05:36 | Wave 3 DONE + committed (6fe3b31): tsc 0, vitest 288, build green, golden 24/24 |
| 05:38 | Hygiene launched (wf_6db13b79-ced): rename real hospital/chain names at the source, regenerate, verify numbers, wording fixes; then Wave 4 (video, slides, guide) |

| 05:55 | Hygiene DONE + committed (ab854ee): real names → fictional at the source; numbers identical; triage 0.917 unchanged; tsc/vitest 288/build/e2e 24 green |
| 05:56 | Wave 4 launched (wf_8214c72c-10c): video (CDP capture + TTS + captions), 2-slide summary PDF, presenter guide, then review + polish. Vercel CLI 65 installed; trying `vercel deploy --temporary` (no login) to validate the Linux build |

| 06:00 | `vercel deploy --temporary` is not available without login (it started a device-login flow, now expired). In the morning: run `vercel login` (device flow), the user approves the link, then `vercel --prod` |

| 06:43 | Wave 4 DONE: video 2:53.5 (1080p, TTS en-US-AndrewNeural, captions), 2-slide PDF, presenter guide; review + polish applied 11/15 fixes |
| 06:55 | REQ-1101 fix: Marcus's extension now has its own id; video weijie beat re-recorded; slides re-exported. tsc 0, vitest 289, golden 24/24 |
| 06:58 | Deliverables committed (6cd241a) and copied to OneDrive …/Data Case Competition 2026/Submission/. Final secrets scan clean. Hourly heartbeat cron deleted |

| 07:30 | Vercel: logged in (ethantay2003-5612); project onerecord-lives-dsa26; vercel.json framework=nextjs; LIVE https://onerecord-lives-dsa26.vercel.app; golden e2e 24/24 against the live URL |
| 07:34 | Team name CTFudders on the slides + README; PDF re-exported |
| 07:43 | Caption-free narrator cut (REC_OUT/NO_CAPTIONS) → Submission/OneRecord-demo-silent-nocaptions.mp4; FOR-THE-NARRATOR.md written |
| 07:50 | Repo PUBLIC (user OK). Branch renamed master → main (in-app links use blob/main). Form = 1 file upload (≤10 MB): name it CTFudders.pdf; the YouTube + GitHub links must be inside the PDF |

## Waves
- [x] Wave 1: foundation (engine, store, shell, mocks) + integration
- [x] W1-E: Python data + DS → src/data JSON
- [x] Wave 2: features (intake, approvals, tracker + MDM, admin, pulse, triage + impact)
- [x] Wave 3: integrate + e2e demo path + visual review loop
- [x] Wave 4: README, recording, voiceover script, 2 slides, secrets scan (deploy pending user login)

## Morning checklist for the user (final)
Files: OneDrive …/Data Case Competition 2026/Submission/ (video, silent video, captions, voice-over script, 2-slide PDF + PNGs, PRESENTER-GUIDE.html)
1. Tell Claude your TEAM NAME (goes on the slide footers).
2. Open the submission form (https://forms.gle/ApCcjxN7YedCzTas7; the S7 link is the same form) signed in with your SMU Google account. Note the fields and file limits. Don't submit yet.
3. Live link: Claude runs `vercel login` and gives you a link + code to approve in your browser (1 min), then deploys with --prod.
4. Watch Submission/OneRecord-demo.mp4 (2:53). Upload it as-is (AI voice), OR record your own voice over OneRecord-demo-silent.mp4 using voiceover-script.md (Clipchamp).
5. YouTube: upload as Unlisted; check it in incognito once HD has processed. Send Claude the link → slides, README and the close frame get updated and the PDF re-exported.
6. Say "make the repo public" (secrets scan done; note that commit metadata shows your Gmail).
7. Submit the form with: YouTube link, GitHub link, live link, Submission/OneRecord-summary.pdf. Target 11:30; deadline 12:00.
