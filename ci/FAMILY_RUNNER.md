# Setting up a friend's or relative's computer as a GPU runner (instructions for an AI assistant)

This page is written for an **AI assistant that can run commands on the person's computer** (for example Claude Code
or the Claude desktop app). The person was invited by the owner of this repository to lend their computer's GPU to the
project's tests. Your job is to set the computer up as a GitHub Actions *self-hosted runner*, safely and with the
person's consent at every step. The owner's own guide, with the reasoning behind each choice, is
[RUNNERS.md](RUNNERS.md); this page is the same procedure for someone else's computer.

If you cannot run commands, walk the person through the same steps by hand, one at a time.

## Ground rules

- **Talk to the person in their language** (the invitation was in Russian). Explain each step in one or two plain
  sentences before you run it, and ask before anything that installs software, changes settings, or needs an
  administrator password.
- **Never run the runner as a Windows service, and never as Administrator or root.** Chrome reaches the GPU only from
  the logged-in desktop session; a service gets software rendering and the machine is useless to the project.
- **The registration token is a secret.** It comes from the owner, is valid for one hour, and is used once. Do not
  write it to any file, echo it into a log, or send it anywhere but `config.cmd` / `config.sh`.
- Change nothing in the repository and nothing on GitHub. The person's computer is the only thing you set up.
- Stop and tell the person to ask the owner if a step fails in a way this page does not cover.

## What the person should know first (tell them before you start)

A self-hosted runner is GitHub's small official program. It connects **out** to GitHub (no ports are opened), waits
for test jobs of this one repository, runs them in its own folder and reports the results. Jobs are **not** sandboxed:
they run as the user account the runner runs under and can read what that account can read. What keeps this safe:

- only code from this repository's own branches reaches the runner, never a pull request from a fork;
- every run waits until the owner approves it by hand on GitHub;
- the jobs install no packages from the internet beyond GitHub's own Node.js; they build the app and drive Chrome.

So the person is trusting the owner, as they would by running a program the owner sent them. To keep their own files
out of reach anyway, **recommend a separate user account** for the runner (a standard, non-administrator account,
e.g. named `runner`). If they agree, they create it themselves, log in to it, and you do everything below while logged
in as that account. That account must then stay logged in (switching users or locking the screen is fine; logging it
out stops the runner).

## 1. Check the computer

1. **System:** Windows 10/11 (x64) or macOS 13+ (Apple silicon or Intel). Not a virtual machine. Linux is not used by
   the tests.
2. **GPU:** note the model. Windows: `Get-CimInstance Win32_VideoController | Select-Object Name, DriverVersion`.
   macOS: `system_profiler SPDisplaysDataType | grep -E "Chipset|Metal"`.
3. **Disk:** at least 5 GB free on the drive that will hold the runner (`C:` on Windows, the home folder on macOS).
4. **It stays on:** a desktop, or a laptop that is kept plugged in.

## 2. Ask the person for

- **The registration token** the owner sent them (a long string; it expires one hour after the owner made it, so ask
  for it only once everything else is ready, just before step 5).
- **A runner name** to use: the owner may have given one; otherwise `family-<first name in Latin letters>-<win|mac>`,
  lower case, e.g. `family-masha-win`.

## 3. Install what the jobs need

The jobs use the machine's own **Google Chrome** (the normal release), **Python 3.12** and **Git**, and need
**Node.js** (22 or newer) on the PATH. Skip what is already installed (`chrome --version` is not reliable on
Windows; check the Start menu or `C:\Program Files\Google\Chrome\Application\chrome.exe`).

Windows (no administrator PowerShell needed for winget; it may show a UAC prompt for the person to accept):

```powershell
winget install -e --id Google.Chrome
winget install -e --id Python.Python.3.12
winget install -e --id Git.Git
winget install -e --id OpenJS.NodeJS.LTS
```

Then open a **new** PowerShell window (so the PATH is fresh) and check: `python --version`, `git --version`,
`node --version`. If PowerShell refuses to run scripts later: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

macOS:

- Git: `xcode-select --install` (a system dialog; the person clicks *Install*).
- Chrome, Python 3.12 and Node.js: with Homebrew if it is already there (`brew install --cask google-chrome`,
  `brew install python@3.12 node@22`, then follow brew's note to put `node@22` on the PATH); otherwise the installers
  from google.com/chrome, python.org/downloads and nodejs.org.
- On Apple silicon, Node must be the arm64 build: `node -p process.arch` prints `arm64`.

## 4. Keep it awake when plugged in

Explain why: a computer that falls asleep in the middle of a job fails it and holds up the other jobs.

Windows (the second pair of commands is for laptops: closing the lid must not put it to sleep; it needs an
administrator PowerShell, so ask the person first):

```powershell
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0
```

```powershell
powercfg /setacvalueindex SCHEME_CURRENT SUB_BUTTONS LIDACTION 0
powercfg /setactive SCHEME_CURRENT
```

macOS: *System Settings → Battery → Options* (on a desktop: *Energy*), turn on **Prevent automatic sleeping on power
adapter when the display is off**. The screen itself may turn off and lock; that is fine.

## 5. Install and register the runner

Get the current runner version from <https://github.com/actions/runner/releases/latest> (or
`https://api.github.com/repos/actions/runner/releases/latest`, field `tag_name`, e.g. `v2.329.0` → version
`2.329.0`). The release notes list a SHA-256 for every package: check the download against it.

Windows (normal PowerShell, **not** as administrator), with `<VER>` the version:

```powershell
mkdir C:\actions-runner; cd C:\actions-runner
Invoke-WebRequest -Uri https://github.com/actions/runner/releases/download/v<VER>/actions-runner-win-x64-<VER>.zip -OutFile runner.zip
(Get-FileHash runner.zip -Algorithm SHA256).Hash   # compare with the release notes
Expand-Archive runner.zip -DestinationPath .
.\config.cmd --unattended --url https://github.com/Alarion239/complex-map-workbench --token <TOKEN> --name <NAME> --labels family-gpu --work _work
```

Then start it at every logon of this account (this is a scheduled task in the user's session, not a service):

```powershell
$a = New-ScheduledTaskAction -Execute "C:\actions-runner\run.cmd" -WorkingDirectory "C:\actions-runner"
$t = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$s = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName "GitHub Actions runner" -Action $a -Trigger $t -Settings $s
Start-ScheduledTask -TaskName "GitHub Actions runner"
```

A console window opens and ends with `Listening for Jobs`. Tell the person to minimise it, not close it.

macOS (Terminal), with `<ARCH>` `arm64` on Apple silicon (`uname -m` prints `arm64`) or `x64` on Intel:

```sh
mkdir ~/actions-runner && cd ~/actions-runner
curl -fLo runner.tar.gz https://github.com/actions/runner/releases/download/v<VER>/actions-runner-osx-<ARCH>-<VER>.tar.gz
shasum -a 256 runner.tar.gz   # compare with the release notes
tar xzf runner.tar.gz
./config.sh --unattended --url https://github.com/Alarion239/complex-map-workbench --token <TOKEN> --name <NAME> --labels family-gpu --work _work
mkdir -p ~/Library/LaunchAgents
./svc.sh install
./svc.sh start
./svc.sh status
```

(`svc.sh` on macOS installs a LaunchAgent, which runs in the logged-in session and has the GPU; that is what we want.)

If `config` says the token is invalid or expired, the person asks the owner for a new one; nothing else needs undoing.

## 6. Check and report

1. The runner is connected: Windows, the console window's last line is `Listening for Jobs`; macOS, `./svc.sh status`
   says it is running and `_diag/Runner_*.log` ends with `Listening for Jobs`.
2. Chrome uses the hardware GPU: open `chrome://gpu` in Chrome; *WebGL2* should say **Hardware accelerated**. On a
   Windows laptop with two GPUs (Intel and NVIDIA), leave Chrome on the default unless the owner asks otherwise.
3. Help the person send the owner one message with: the runner name, the system (Windows/macOS, Apple silicon or
   Intel), the GPU model from step 1, and the *GL_RENDERER* line from `chrome://gpu`.

The runner is registered with the label `family-gpu`; the owner decides on GitHub which tests it takes, so there is
nothing more to do on the computer. It updates itself.

## Everyday use and removal (tell the person)

- Leave the computer on, plugged in and logged in. Tests run after the owner's changes and once a night (07:17
  Moscow time), and only after the owner approves each run. While a test runs, the fans may spin up; heavy games at
  that moment slow the test but do no harm.
- **To pause:** close the runner window (Windows) or `cd ~/actions-runner && ./svc.sh stop` (macOS). Starting it
  again: log out and in, or `C:\actions-runner\run.cmd` / `./svc.sh start`.
- **To remove for good:** ask the owner for a removal token, then on Windows
  `Unregister-ScheduledTask -TaskName "GitHub Actions runner"`, `cd C:\actions-runner`,
  `.\config.cmd remove --token <TOKEN>`, and delete `C:\actions-runner`; on macOS
  `cd ~/actions-runner && ./svc.sh stop && ./svc.sh uninstall && ./config.sh remove --token <TOKEN>`, then delete
  `~/actions-runner`. Without a token, deleting the folder is enough; the owner removes the entry on GitHub.
