# How to contribute

We'd love for you to contribute and welcome your help. Here are some guidelines to follow:

- [Issues and Bugs](#issue)
- [Submitting a fix](#submitting)
- [Feature Requests](#features)
- [Questions](#questions)
- [Dependency updates (Dependabot)](#dependabot)

## <a name="issue"></a> Did you find a issue?

* **Ensure the bug was not already reported** by searching on GitHub under *Issues*

* If you're unable to find an open issue addressing the problem, open a new one

## <a name="submitting"></a> Did you write a patch that fixes a bug?

Open a new GitHub pull request with the patch following the steps outlined below. Ensure the PR description clearly describes the problem and solution. Include the relevant issue number if applicable.

Before you submit your pull request consider the following guidelines:

* Search *Pull Requests* for an open or closed Pull Request
  that relates to your submission. You don't want to duplicate effort.

### Submitting a Pull Request

Please follow these steps for all pull requests. These steps are derived from the [GitHub flow](https://help.github.com/articles/github-flow/).

#### Step 1: Fork

Fork the current repository and clone your fork
locally.

```sh
git clone https://github.com/solacecommunity/<github-repo>
```

#### Step 2: Branch

Make your changes on a new git branch in your fork of the repository.

```sh
git checkout -b my-fix-branch main
```

#### Step 3: Commit

Commit your changes using a descriptive commit message.

```sh
git commit -a -m "Your Commit Message"
```

Note: the optional commit `-a` command line option will automatically "add" and "rm" edited files.

#### Step 4: Rebase (if possible)

Assuming you have not yet pushed your branch to origin, use `git rebase` (not `git merge`) to synchronize your work with the main
repository.

```sh
$ git fetch upstream
$ git rebase upstream/main
```

If you have not set the upstream, do so as follows:

```sh
$ git remote add upstream https://github.com/solacecommunity/<github-repo>
```

If you have already pushed your fork, then do not rebase. Instead merge any changes from main that are not already part of your branch.

#### Step 5: Push

Push your branch to your fork in GitHub:

```sh
git push origin my-fix-branch
```

#### Step 6: Pull Request

In GitHub, send a pull request to `<github-repo>:main`.

When fixing an existing issue, use the [commit message keywords](https://help.github.com/articles/closing-issues-via-commit-messages/) to close the associated GitHub issue.

* If we suggest changes then:
  * Make the required updates.
  * Commit these changes to your branch (ex: my-fix-branch)

That's it! Thank you for your contribution!

## <a name="features"></a> **Do you have an ideas for a new feature or a change to an existing one?**

* Open a GitHub issue and label it as an *enhancement* and describe the new functionality.

##  <a name="questions"></a> Do you have questions about the source code?

* Ask any question about the code or how to use Solace technologies in the [Solace community](https://solace.community).

## <a name="dependabot"></a> Dependency updates (Dependabot)

Dependabot opens weekly PRs for npm, GitHub Actions and the Docker base image (with a 3-day
release-age cooldown). The workflow `.github/workflows/dependabot-auto-merge.yml` enables
GitHub's native **auto-merge (squash)** on those PRs when:

* the update is a **patch or minor** version bump,
* the package did **not** change maintainers, and
* the PR was opened and last pushed by Dependabot.

GitHub then merges the PR by itself once every **required** status check on `main` has passed. No
runner waits for the checks. Major updates and updates without a semver version (e.g. SHA-pinned
workflow refs) stay open for manual review. A PR with a failed check, a merge conflict or a pending
required review is left open. If anyone other than Dependabot pushes to the PR, or the update stops
being eligible, the workflow switches auto-merge off again.

Auto-merge is enabled with a **GitHub App token**. A merge done on behalf of `GITHUB_TOKEN` would
trigger no workflow runs, so CI, `docker-publish.yml` and the SCA manifest update would not run on
`main`. With the App token the merge is a normal push to `main` and all workflows run as usual.

Before enabling auto-merge the workflow checks that `main` requires the status check `verify`
(ruleset or classic branch protection) and fails otherwise: without required checks GitHub would
merge immediately, before the pipeline has run.

One-time setup for repository admins:

1. **Ruleset / branch protection on `main`**: require pull requests and the status checks
   `verify` (CI) and the SCA scan job. Do not add the App to the ruleset's *bypass list* - it
   would then be allowed to merge before the checks pass.
   Do not enable *Require branches to be up to date before merging*: Dependabot does not rebase
   PRs that are merely behind, so they would stay unmerged.
2. **Settings > General**: enable *Allow auto-merge* and *Allow squash merging*.
3. **GitHub App** (org-owned, installed on this repository only), repository permissions:
   *Contents*: read and write, *Pull requests*: read and write, *Workflows*: read and write
   (needed to merge GitHub Actions updates that change `.github/workflows/`). No webhook needed.
4. **Dependabot secrets** (Settings > Secrets and variables > *Dependabot*): workflows triggered by
   Dependabot cannot read *Actions* secrets. Add
   * `DEPENDABOT_AUTOMERGE_APP_CLIENT_ID` - the App's client ID,
   * `DEPENDABOT_AUTOMERGE_APP_PRIVATE_KEY` - a private key of the App,
   * `FOSSA_API_KEY` - otherwise the SCA scan fails on Dependabot PRs and nothing is merged.
