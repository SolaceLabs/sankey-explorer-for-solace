#!/usr/bin/env bash
# Waits until every required status check of a pull request has passed, squash-merges
# it and then re-dispatches the workflows on main.
#
# Why the re-dispatch: a merge made with GITHUB_TOKEN creates no new workflow runs, so
# CI, docker-publish and the SCA manifest update would otherwise not run on main.
# workflow_dispatch is the documented exception to that rule.
#
# Fails closed: if no required checks are reported (ruleset missing), the PR is never
# merged and the script times out with an error.
#
# Requires: gh (preinstalled on GitHub-hosted runners), jq-capable gh (--jq).
# Environment:
#   GH_TOKEN            token with contents/pull-requests/actions write   (required)
#   GH_REPO             owner/repo, used by `gh workflow run`              (required)
#   PR_URL              pull request URL                                   (required)
#   HEAD_SHA            PR head commit that was evaluated; merge aborts if
#                       the branch moved in the meantime                   (required)
#   MAX_WAIT_SECONDS    give up after this long (default 2700)
#   POLL_SECONDS        polling interval (default 30)
#   DISPATCH_REF        branch to re-run workflows on (default main)
#   DISPATCH_WORKFLOWS  space-separated workflow files
#                       (default "ci.yml docker-publish.yml sca-scan-and-guard.yml")
set -euo pipefail

: "${GH_TOKEN:?GH_TOKEN is required}"
: "${GH_REPO:?GH_REPO is required}"
: "${PR_URL:?PR_URL is required}"
: "${HEAD_SHA:?HEAD_SHA is required}"
max_wait="${MAX_WAIT_SECONDS:-2700}"
poll="${POLL_SECONDS:-30}"
dispatch_ref="${DISPATCH_REF:-main}"
read -r -a workflows <<< "${DISPATCH_WORKFLOWS:-ci.yml docker-publish.yml sca-scan-and-guard.yml}"

# Prints one of: pass | fail | pending | none
required_checks_state() {
  local buckets
  # gh errors with "no required checks reported" while none exist (yet); treat any
  # error as "none" so the caller keeps polling and finally fails closed.
  if ! buckets=$(gh pr checks "$PR_URL" --required --json bucket --jq '[.[].bucket] | join(" ")' 2>/dev/null); then
    echo none
    return 0
  fi
  case " $buckets " in
    *" fail "* | *" cancel "*) echo fail ;;
    *" pending "*) echo pending ;;
    "  ") echo none ;;
    *) echo pass ;;
  esac
}

main() {
  local deadline=$((SECONDS + max_wait))
  local checks state review

  while :; do
    checks=$(required_checks_state)
    echo "Required checks: $checks"

    if [ "$checks" = fail ]; then
      echo "::notice::A required check failed or was cancelled - leaving the PR open for review."
      return 0
    fi

    if [ "$checks" = pass ]; then
      # `|| true`: a transient API error must not abort the run under `set -e`
      # (read returns 1 on empty input); state stays empty and we poll again.
      state='' review=''
      IFS=$'\t' read -r state review < <(gh pr view "$PR_URL" \
        --json mergeStateStatus,reviewDecision --jq '[.mergeStateStatus, .reviewDecision] | @tsv' 2>/dev/null) || true
      echo "Merge state: $state, review decision: ${review:-<none>}"
      case "$state" in
        # UNSTABLE: only non-required checks are pending/failing (this job itself is one).
        CLEAN | UNSTABLE | HAS_HOOKS) break ;;
        DIRTY | DRAFT | BEHIND)
          echo "::notice::PR is $state - leaving it for Dependabot or a human."
          return 0
          ;;
        BLOCKED)
          if [ "$review" = REVIEW_REQUIRED ] || [ "$review" = CHANGES_REQUESTED ]; then
            echo "::notice::Branch rules require a review ($review) - leaving the PR open."
            return 0
          fi
          ;;
      esac
      # BLOCKED/UNKNOWN otherwise: a required check may still be registering; poll again.
    fi

    if ((SECONDS >= deadline)); then
      echo "::error::Gave up after ${max_wait}s (required checks: $checks). Are required status checks configured for $dispatch_ref?"
      return 1
    fi
    sleep "$poll"
  done

  gh pr merge "$PR_URL" --squash --match-head-commit "$HEAD_SHA"
  echo "Merged $PR_URL"

  local wf
  for wf in "${workflows[@]}"; do
    gh workflow run "$wf" --ref "$dispatch_ref"
    echo "Dispatched $wf on $dispatch_ref"
  done
}

main "$@"
