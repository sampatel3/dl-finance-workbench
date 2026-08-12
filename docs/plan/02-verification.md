# Verification

What was checked, how, and what it found. Not what was intended to be checked.

## The gates

| | Command | Expected |
|---|---|---|
| Types | `pnpm -r typecheck` | exit 0 |
| Tests | `pnpm -r test` | exit 0 |
| Build | `pnpm --filter web build` | exit 0 |
| Determinism | `git grep -n "Math.random" web/lib` | no matches |
| Deck | `pnpm deck:slides` | no slide overflows |
| Health | `curl <url>/api/health` | `.commit` equals the deployed SHA |

## Accepted weaknesses

<Things that are wrong and are staying wrong, with the reason. A weakness written down is a
decision; a weakness nobody wrote down is a surprise. Start with the ones demo-kit inherits:
the passcode gate is not authentication, and the in-process attempt limiter fans out across
serverless instances.>

## Defects found and fixed

<!--
  THIS SECTION BEING EMPTY MEANS VERIFICATION HAS NOT HAPPENED.

  Every defect found while checking the demo goes here: what was wrong, how it surfaced, and
  what changed. A verification pass that found nothing either checked nothing or is not
  finished. Both source demos filled this section, and in both cases the entries are the most
  useful paragraphs in their documentation.
-->

## Live smoke

<The transcript of the run that proved it: provision, deploy, verify, and the health document
the live URL returned. Paste it, do not summarise it — a summary of a transcript is a claim,
and the transcript is the evidence.>
