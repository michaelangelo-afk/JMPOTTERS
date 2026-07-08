# Codebuff → GitHub Workflow

This repo is wired so that Codebuff (a local AI coding assistant) can
make edits, you commit them with `cbpr`, and a Pull Request opens
automatically on GitHub.

```text
┌──────────────┐    edit    ┌────────────────┐   git push    ┌──────────────────────┐
│  Codebuff    │ ─────────► │  local working │ ────────────► │  GitHub: codebuff/** │
│  (CLI/agent) │            │  copy of repo  │               │  branch created      │
└──────────────┘            └────────────────┘               └──────────┬───────────┘
                                       │                              │ push event
                                       │  $ cbpr "msg"                ▼
                                       │                     ┌──────────────────────┐
                                       └────────────────────►│  .github/workflows/  │
                                                             │  codebuff-pr.yml     │
                                                             │  → opens PR to main  │
                                                             └──────────────────────┘
```

## One-time setup

### 1. Connect the local folder to your GitHub repo

If your local folder is not yet a git repo:

```bash
cd /root/JMPOTTERS-main
git init
git remote add origin https://github.com/michaelangelo-afk/JMPOTTERS.git
git add -A
git commit -m "Initial commit"
git branch -M main
git push -u origin main
```

If your local folder is a stale copy, prefer cloning fresh:

```bash
cd /root
rm -rf JMPOTTERS-main
git clone https://github.com/michaelangelo-afk/JMPOTTERS.git JMPOTTERS-main
```

### 2. Install `gh` (GitHub CLI) and authenticate

| OS      | Install                                 | Auth           |
|---------|-----------------------------------------|----------------|
| macOS   | `brew install gh`                       | `gh auth login`|
| Ubuntu  | `sudo apt install gh` or `snap install gh` | `gh auth login`|
| Windows | `winget install GitHub.cli`             | `gh auth login`|

### 3. Set your git identity

```bash
git config --global user.name  "Your Name"
git config --global user.email "you@example.com"
```

### 4. Install `cbpr` on your PATH

```bash
install -m 0755 scripts/cbpr ~/.local/bin/cbpr
```

Make sure `~/.local/bin` is on your `PATH`. Add to `~/.bashrc` if needed:

```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

> ⚠️  Do **not** source `scripts/cbpr` from your shell rc. It's a top-level
> executable, not a function library. Sourcing it would run pre-flight
> checks (`gh auth status`, `git rev-parse --is-inside-work-tree`) on every
> new shell and could log you out of non-git directories.

### 5. Push the workflow + script to GitHub

```bash
cd /root/JMPOTTERS-main
cbpr "ci: add Codebuff workflow + cbpr helper"
```

This will:
- stage `.github/workflows/codebuff-pr.yml`, `scripts/cbpr`, and this doc
- create a new `codebuff/<timestamp>-<sha>` branch
- push it to GitHub
- open a PR to `main`

The workflow fires on its first push from that branch — no need to merge
to `main` first for the auto-PR logic itself to start working.

## Daily use

After a Codebuff session:

```bash
cd /root/JMPOTTERS-main
cbpr "feat: add cart-page load-more button"
```

That's it. The script:

1. Stages everything (`git add -A`).
2. Creates a `codebuff/<YYYYMMDD-HHMMSS>-<short-sha>` branch if you're on `main`.
3. Commits with your message.
4. Pushes to GitHub.
5. Reuses the existing PR for that branch if one exists, or opens a new one.
6. The GitHub Action `.github/workflows/codebuff-pr.yml` then opens
   (or stays open) a PR against `main`.

## Common flags

| Flag                                | Effect                                       |
|-------------------------------------|----------------------------------------------|
| `cbpr "msg"`                        | Commit with custom message                   |
| `cbpr --base develop "msg"`         | Target a non-`main` branch                   |
| `cbpr --branch codebuff/x "msg"`    | Use a specific branch (must start with `codebuff/` to trigger the workflow) |
| `cbpr --draft "msg"`                | Open PR as draft                             |
| `cbpr --no-push`                    | Just commit; don't push                      |
| `cbpr --amend`                      | Add more changes to the last commit and push (keeps the previous message unless you supply a new one) |
| `cbpr -y`                           | Skip the confirmation prompt                 |

## What the GitHub Action does

`codebuff-pr.yml` listens for pushes to `codebuff/**`. When triggered, it:

1. Resolves the repo's default branch dynamically (so it works regardless
   of whether your default branch is `main`, `master`, or something else).
2. Checks if an open PR already exists for the branch.
3. If closed/merged: skips (no spam on stale branches).
4. If open: does nothing (push already updates it).
5. If none: opens a new PR with a checklist and a CC to whoever pushed.

It uses `contents: read` + `pull-requests: write` permissions — no
write-to-main, no secrets needed.

## Troubleshooting

| Issue                                            | Fix                                                                 |
|--------------------------------------------------|---------------------------------------------------------------------|
| `❌ gh: command not found`                       | Install GitHub CLI (see step 2)                                     |
| `❌ Not authenticated to GitHub`                 | Run `gh auth login`                                                 |
| `❌ git user.name/.email is not set`             | `git config --global user.name/email "..."`                         |
| `❌ Push failed: non-fast-forward`               | Script auto-rebases; if it can't, run `git pull --rebase` manually  |
| Workflow doesn't fire                            | The PR that adds `.github/workflows/codebuff-pr.yml` must merge first|
| Wrong base branch                                | Use `cbpr --base <branch>`                                          |
| Want to skip the prompt                          | Add `-y`                                                            |

## When you stop using this

The workflow file and `cbpr` script do nothing on their own until you
push to `codebuff/**`. To opt out: just delete `.github/workflows/codebuff-pr.yml`
or remove the `actions/github-script` step that creates the PR.
