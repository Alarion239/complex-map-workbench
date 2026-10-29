# Our own GPU machines as GitHub runners

GitHub's machines have no usable GPU, so the gate there measures only relative slowdowns under software rendering
([README.md](README.md)). The **GPU gate** (`.github/workflows/gpu-gate.yml`) runs the same paired perf suite, image
quality and GLSL conformance on our **Windows laptop** and our **Mac**, with their real GPUs. Each machine becomes a
*self-hosted runner*: GitHub's small runner program, installed on the machine. It connects out to GitHub (no ports
are opened), waits for jobs labelled for it, runs them in a folder on the machine and reports back.

This guide sets up both machines, once. Allow about 20 minutes per machine.

A friend's or relative's computer can join too: [FAMILY_RUNNER.md](FAMILY_RUNNER.md) is this procedure written for
the AI assistant on that computer (it registers with the label `family-gpu`, so it takes no gate job until you add
`gpu` to it in *Settings → Actions → Runners*).

What you end up with:

| machine | runner name | labels (the gate picks a machine by these) |
|---|---|---|
| Windows laptop | `windows-gpu` | `self-hosted`, `Windows`, `X64`, **`gpu`** |
| Mac | `mac-gpu` | `self-hosted`, `macOS`, `ARM64` (Apple silicon) or `X64`, **`gpu`** |

## 1. Repository settings (once, by the owner)

All of these are on GitHub, in the repository's **Settings** tab.

1. **Approve outside contributors' workflows.** *Settings → Actions → General → Approval for running fork pull
   request workflows from contributors* → choose **Require approval for all external contributors** → *Save*. A pull
   request from someone outside the repository then runs no workflow until you press *Approve and run* on it.
2. **Approve every GPU run.** *Settings → Environments → New environment*, name it exactly **`gpu-runners`** →
   *Configure environment* → tick **Required reviewers**, add yourself (and anyone else who may approve) → *Save
   protection rules*. Every GPU gate run now waits for one of you to press *Review deployments → Approve and deploy*
   before anything reaches the machines.
3. **The label for pull requests.** *Issues → Labels → New label*, name it **`gpu-gate`**. Adding it to a pull
   request (from a branch of this repository) asks for a GPU gate run of that pull request.
4. **Turn the GPU gate on** *after* both machines are registered (sections 3 and 4): *Settings → Secrets and variables
   → Actions → Variables → New repository variable*, name **`GPU_RUNNERS`**, value **`true`**. While it is not `true`
   the GPU gate is skipped, so nothing waits in the queue for a machine that is not there, and the Gate on GitHub's
   machines runs the perf suite itself (Windows; its checks gate, its timings are only reported: GitHub's machines are
   too noisy to gate speed). Once it is `true`, speed is gated on these machines and the Gate drops its perf jobs, so
   pull requests get their result much sooner (what is left: unit tests and image quality, about 7 minutes, and the
   shader pages, which run only when shader code changed). A pull request's speed is
   then measured when it carries the label `gpu-gate` (step 3), and on every push to `main` and every night.

The GPU gate never runs for a pull request from a fork, whatever the settings: code from outside the repository never
reaches our machines.

## 2. Prepare each machine

- **Software:** [Google Chrome](https://www.google.com/chrome/) (the normal release), [Node.js 22 LTS](https://nodejs.org/),
  [Python 3.12](https://www.python.org/downloads/) (Windows: tick *Add python.exe to PATH*), and Git
  ([git-scm.com](https://git-scm.com/) on Windows; on the Mac, `xcode-select --install`). The jobs install their own
  Node into the runner's folder; Chrome, Python and Git must be on the machine.
- **An account:** a separate user account for the runner is safest (a job can read what that account can read).
  Your own account works too. Either way, that account must **stay logged in**: Chrome reaches the GPU only from a
  logged-in desktop session. A locked screen is fine.
- **Power:** keep the machine plugged in and stop it from sleeping on power:
  - Windows: *Settings → System → Power & battery → Screen and sleep*, "When plugged in, put my device to sleep
    after" **Never**.
  - **A laptop: closing the lid must not sleep it.** *Control Panel → Hardware and Sound → Power Options → Choose
    what closing the lid does*, "When I close the lid", *Plugged in*: **Do nothing** (or in an administrator
    PowerShell: `powercfg /setacvalueindex SCHEME_CURRENT SUB_BUTTONS LIDACTION 0; powercfg /setactive SCHEME_CURRENT`).
    The idle setting above does not cover the lid. On 2026-10-28 the Windows laptop slept with its lid closed for 53
    minutes in the middle of a GLSL job: GitHub marked the job failed 3 minutes later, and the runner, once awake,
    kept working on the job for another 23 minutes before it took the next one, while every other GPU job waited
    (#169). Keep it plugged in too: the settings *on battery* are separate (the laptop's own: sleep after 3 minutes).
  - Mac: *System Settings → Battery → Options*, turn on **Prevent automatic sleeping on power adapter when the display
    is off** (on a desktop Mac: *Energy*).
- **Disk:** about 5 GB free (two builds of the app, browser profiles, results). The GLSL job also keeps a shader
  cache in the runner's folder, `_work/_tool/cmw-glsl-cache` (a Chrome profile; 20-50 KB per compiled program, tens
  of MB per version of the shader code): it is what keeps that job short on Windows (ci/README.md, `CMW_GLSL_CACHE`).
  Deleting it is safe; the next run compiles everything again, which on the Windows laptop takes hours.

## 3. The Windows laptop

1. On GitHub: *Settings → Actions → Runners → New self-hosted runner* → **Windows**, architecture **x64**. The page
   shows commands with a one-time token (valid for one hour). Keep it open.
2. Open **PowerShell** (not as administrator) and run the page's *Download* commands, with `C:\actions-runner` as the
   folder:

   ```powershell
   mkdir C:\actions-runner; cd C:\actions-runner
   # then the page's Invoke-WebRequest ... and Expand-Archive ... lines
   ```

3. Configure it, with the URL and token from the page:

   ```powershell
   .\config.cmd --url https://github.com/Alarion239/complex-map-workbench --token <TOKEN> --name windows-gpu --labels gpu --work _work
   ```

   - *Enter the name of runner group*: press Enter (Default).
   - **Would you like to run the runner as service? (Y/N)**: answer **N**. A Windows service runs where Chrome
     cannot reach the GPU; we start the runner at logon instead (next step).

4. Start it at every logon. In the same PowerShell window:

   ```powershell
   $a = New-ScheduledTaskAction -Execute "C:\actions-runner\run.cmd" -WorkingDirectory "C:\actions-runner"
   $t = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
   $s = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
   Register-ScheduledTask -TaskName "GitHub Actions runner" -Action $a -Trigger $t -Settings $s
   Start-ScheduledTask -TaskName "GitHub Actions runner"
   ```

   A console window opens with `Listening for Jobs`: leave it open (minimise it). To start it by hand instead:
   `C:\actions-runner\run.cmd`.

5. On GitHub, *Settings → Actions → Runners* now lists **windows-gpu** as *Idle*.

Laptops with two GPUs (Intel and NVIDIA): Chrome picks one by itself, usually the integrated one, which is what most
of our users have. To pin one: *Settings → System → Display → Graphics → Google Chrome → Options*.

## 4. The Mac

1. On GitHub: *Settings → Actions → Runners → New self-hosted runner* → **macOS**, architecture **ARM64** (Apple
   silicon; **x64** on an Intel Mac).
2. In **Terminal**, run the page's *Download* commands with `~/actions-runner` as the folder:

   ```sh
   mkdir ~/actions-runner && cd ~/actions-runner
   # then the page's curl -o ... and tar xzf ... lines
   ```

3. Configure it:

   ```sh
   ./config.sh --url https://github.com/Alarion239/complex-map-workbench --token <TOKEN> --name mac-gpu --labels gpu --work _work
   ```

   Press Enter for the runner group.

4. Run it in the background while you are logged in (a LaunchAgent, which has the GPU):

   ```sh
   mkdir -p ~/Library/LaunchAgents
   ./svc.sh install
   ./svc.sh start
   ./svc.sh status
   ```

   (`./svc.sh stop` and `./svc.sh uninstall` undo it.) To run it in a Terminal window instead: `./run.sh`.

5. On GitHub, *Settings → Actions → Runners* lists **mac-gpu** as *Idle*.

### Replacing an x64 runner with the arm64 build

On Apple silicon the runner must be the **ARM64** package. The **x64** one also runs there, under Rosetta: then the
jobs' Node and Chrome are Intel builds translated on the fly, so the GPU gate's timings are not the machine's. The
**gpu probe** step warns when it runs under Rosetta (`sysctl -n sysctl.proc_translated` prints `1`). To replace it:

1. Make sure no job is running on it (*Actions*: nothing *In progress* on `mac-gpu`), or set `GPU_RUNNERS` to
   `false` for the time being (section 1, step 4).
2. Stop and remove the old runner, in its folder:

   ```sh
   cd ~/actions-runner
   ./svc.sh stop && ./svc.sh uninstall
   ./config.sh remove --token <TOKEN>
   ```

   (the token: *Settings → Actions → Runners → mac-gpu → Remove* shows the command with a fresh one). Then move the
   folder aside: `mv ~/actions-runner ~/actions-runner-x64`.
3. Install the **ARM64** package as in steps 1–4 above (*New self-hosted runner* → **macOS** → **ARM64**), with the
   same name `mac-gpu` and the label `gpu`.
4. Check that Node is a native build too (an x64 Node installed from the Intel package runs under Rosetta as well):
   `file "$(which node)"` should say `arm64`, and `node -p process.arch` should print `arm64`. If not, install the
   arm64 Node 22 and restart the runner (`./svc.sh stop && ./svc.sh start`).
5. Run the GPU gate once by hand (section 5): **gpu probe** shows `darwin arm64` and the Metal renderer, and no
   Rosetta warning. Then delete `~/actions-runner-x64`, and set `GPU_RUNNERS` back to `true` if you turned it off.

## 5. Check the GPU, then turn it on

1. Set the variable `GPU_RUNNERS` to `true` (section 1, step 4).
2. *Actions → GPU gate → Run workflow*, branch **main**, machines **both** → *Run workflow*. The run waits for
   approval: open it, *Review deployments*, tick **gpu-runners**, *Approve and deploy*.
3. Each job starts with **gpu probe**, which prints the renderer Chrome got and stops the job if it is software
   rendering. Expected:
   - Windows: `ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 ...)` (or the laptop's GPU).
   - Mac: `ANGLE (Apple, ANGLE Metal Renderer: Apple M...)`.

   If it says `SwiftShader`, `Microsoft Basic Render Driver` or `WARP`, the runner is not in a logged-in desktop
   session (Windows: it was installed as a service, or the task runs "whether user is logged on or not"; make it
   "Run only when user is logged on").

The first run builds two copies of the app and runs every shard on both machines. On a GPU a shard takes a few
minutes, so the whole gate takes roughly one to two hours per machine; the two machines work in parallel.
The Windows laptop's GLSL job is the exception the first time: Direct3D 11 compiles every shader program on the CPU
(the glsl page alone takes hours a side; one program took 12 minutes), where the Mac takes 7 minutes for all three
pages. The first runs may hit the job's 240 minutes; each keeps what it compiled in the shader cache (section 2,
*Disk*), so the next goes further, and from then on only programs whose code changed compile: 1/64 of the glsl page
took 103 s cold and 7 s warm. To warm the cache in one go, run on the laptop, in a checkout of `main` (hours; not
while the runner has a GLSL job):
`$env:CMW_GLSL_CACHE='C:\actions-runner\_work\_tool\cmw-glsl-cache'; node ci/glsl.js --ref HEAD~1 --force`.
Each page prints a line a minute while it runs, with how busy Chrome's GPU process was (busy: compiling; idle with an
idle page: stuck).

## 6. Everyday use

- **When it runs:** every push to `main`, every night (04:17 UTC), by hand (*Actions → GPU gate → Run workflow*),
  and on a pull request from a branch of this repository with the label `gpu-gate`. Every run waits for your approval.
- **What it says:** each job's summary (open the run, then the job) has a table: reference → this change for
  every metric that got worse, and a list of improvements. The raw results (JSON) are the run's artifacts.
- **A machine is off:** its jobs wait in the queue for up to 24 hours, then GitHub cancels them. Cancel the run if
  you know it will not come back, or turn the gate off (`GPU_RUNNERS` to `false`).
- **While a run is on the machine:** avoid heavy work on it (a build, a game, another browser test). Both sides of
  each comparison run back to back, so a busy machine slows both, but it adds noise.
- **Updates:** the runner updates itself. Keep Chrome, Node and Python updated as usual.
- **Removing a machine:** *Settings → Actions → Runners → (the runner) → Remove*, then on the machine
  `.\config.cmd remove --token <TOKEN>` (Windows) or `./svc.sh uninstall && ./config.sh remove --token <TOKEN>` (Mac).

## Troubleshooting

| symptom | fix |
|---|---|
| Jobs stay *Queued* | The machine is asleep, logged out, or its runner is not started (section 3 step 4, section 4 step 4). *Settings → Actions → Runners* shows *Offline*. |
| Jobs stay *Queued* while the runner is online | It is busy: the runner window's last line is `Running job: …`. After the machine slept during a job, that job may already show as failed on GitHub while the runner still works on it; it lets go of it by itself (23 minutes on 2026-10-28), or close the runner window and start `run.cmd` again. Its log is in `C:\actions-runner\_diag\Worker_*.log`. |
| A cancelled run stays *Queued* | A job that waits for a self-hosted runner is cancelled only when a runner takes it, or after 24 hours, and the run holds its concurrency group (the next push to `main` waits behind it). Force it: `gh api -X POST repos/Alarion239/complex-map-workbench/actions/runs/<run id>/force-cancel`. |
| "No GPU" in **gpu probe** | See section 5, step 3. |
| `Google Chrome not found` | Chrome is not in its usual place. Put `CHROME_BIN=<path to chrome>` and `CHROME=<same path>` in the file `.env` in the runner's folder, then restart the runner. |
| `python` or `git` not found | Install it (section 2), then restart the runner so it sees the new PATH. |
| Windows: PowerShell refuses to run scripts | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| A shard fails with a slowdown you do not believe | Run it again: *Actions → GPU gate → Run workflow* with only that shard (e.g. `views`). Each failing unit is already re-run twice within a job; a slowdown that survives a second run is real. |
