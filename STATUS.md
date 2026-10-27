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

## Waves
- [x] Wave 1: foundation (engine, store, shell, mocks) + integration
- [ ] W1-E: Python data + DS → src/data JSON
- [ ] Wave 2: features (intake, approvals, tracker + MDM, admin, pulse, triage + impact)
- [ ] Wave 3: integrate + e2e demo path + visual review loop
- [ ] Wave 4: README, recording, voiceover script, 2 slides, secrets scan, deploy

## Morning checklist for the user (draft)
1. Open the submission form (https://forms.gle/ApCcjxN7YedCzTas7; the S7 link is the same form) while signed in to your SMU Google account. Note the fields and file limits, but don't submit yet.
2. Run `! npx vercel login` → Continue with GitHub (1 min). Then tell Claude "deploy".
3. Watch the auto-recorded demo video; record the voice-over (script provided) or use the TTS version.
4. Upload to YouTube as Unlisted; check it in an incognito window.
5. Review the 2-slide PDF; say OK to make the repo public.
6. Submit before 11:30.
