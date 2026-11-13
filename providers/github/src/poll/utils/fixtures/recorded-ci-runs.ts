// Recorded with `gh run view <run> --json jobs` and the run-log archive's entry order, from the
// two failing runs whose CI events quoted the wrong job (2026-11-12). Repository name anonymised.
// Runs are listed in the order their checks appeared in the pull request's status rollup.

export type RecordedJob = { databaseId: number; name: string; conclusion: string; url: string }
export type RecordedRun = { id: number; archive: string[]; jobs: RecordedJob[] }
export type RecordedFailure = { pr: number; failedJobs: string[]; runs: RecordedRun[] }

export const RECORDED_FAILURES: RecordedFailure[] = [
  {
    pr: 17,
    failedJobs: [
      "rust"
    ],
    runs: [
      {
        id: 43172770221,
        archive: [
          "package (linux-x64, ubuntu-latest)",
          "package (darwin-arm64, macos-latest)",
          "rust",
          "msrv",
          "kani"
        ],
        jobs: [
          {
            databaseId: 131029735720,
            name: "kani",
            conclusion: "success",
            url: "https://github.com/org/repo/actions/runs/43172770221/job/131029735720"
          },
          {
            databaseId: 131029735903,
            name: "msrv",
            conclusion: "success",
            url: "https://github.com/org/repo/actions/runs/43172770221/job/131029735903"
          },
          {
            databaseId: 131029735972,
            name: "rust",
            conclusion: "failure",
            url: "https://github.com/org/repo/actions/runs/43172770221/job/131029735972"
          },
          {
            databaseId: 131029736077,
            name: "package (darwin-arm64, macos-latest)",
            conclusion: "success",
            url: "https://github.com/org/repo/actions/runs/43172770221/job/131029736077"
          },
          {
            databaseId: 131029736127,
            name: "package (linux-x64, ubuntu-latest)",
            conclusion: "success",
            url: "https://github.com/org/repo/actions/runs/43172770221/job/131029736127"
          }
        ]
      }
    ]
  },
  {
    pr: 38,
    failedJobs: [
      "gates / commands/readmes (.)"
    ],
    runs: [
      {
        id: 43256223464,
        archive: [
          "package (linux-x64, ubuntu-latest)"
        ],
        jobs: [
          {
            databaseId: 131315056624,
            name: "package (darwin-arm64, macos-latest)",
            conclusion: "cancelled",
            url: "https://github.com/org/repo/actions/runs/43256223464/job/131315056624"
          },
          {
            databaseId: 131315057127,
            name: "package (linux-x64, ubuntu-latest)",
            conclusion: "success",
            url: "https://github.com/org/repo/actions/runs/43256223464/job/131315057127"
          }
        ]
      },
      {
        id: 43256223476,
        archive: [
          "gates / commands/nextest (.)",
          "gates / commands/fmt (.)",
          "gates / commands/msrv (.)",
          "gates / commands/rustdoc (.)",
          "gates / commands/clippy (.)",
          "gates / commands/doctest (.)",
          "gates / commands/shear (.)",
          "gates / commands/readmes (.)",
          "gates / commands/kani (.)",
          "gates / commands/mutants (.)",
          "gates / commands/deny (.)",
          "gates / plan"
        ],
        jobs: [
          {
            databaseId: 131315057482,
            name: "gates / plan",
            conclusion: "success",
            url: "https://github.com/org/repo/actions/runs/43256223476/job/131315057482"
          },
          {
            databaseId: 131315368526,
            name: "gates / commands/doctest (.)",
            conclusion: "success",
            url: "https://github.com/org/repo/actions/runs/43256223476/job/131315368526"
          },
          {
            databaseId: 131315368538,
            name: "gates / commands/shear (.)",
            conclusion: "success",
            url: "https://github.com/org/repo/actions/runs/43256223476/job/131315368538"
          },
          {
            databaseId: 131315368583,
            name: "gates / commands/kani (.)",
            conclusion: "success",
            url: "https://github.com/org/repo/actions/runs/43256223476/job/131315368583"
          },
          {
            databaseId: 131315368615,
            name: "gates / commands/mutants (.)",
            conclusion: "success",
            url: "https://github.com/org/repo/actions/runs/43256223476/job/131315368615"
          },
          {
            databaseId: 131315368618,
            name: "gates / commands/clippy (.)",
            conclusion: "success",
            url: "https://github.com/org/repo/actions/runs/43256223476/job/131315368618"
          },
          {
            databaseId: 131315368631,
            name: "gates / commands/rustdoc (.)",
            conclusion: "success",
            url: "https://github.com/org/repo/actions/runs/43256223476/job/131315368631"
          },
          {
            databaseId: 131315368737,
            name: "gates / commands/deny (.)",
            conclusion: "success",
            url: "https://github.com/org/repo/actions/runs/43256223476/job/131315368737"
          },
          {
            databaseId: 131315368752,
            name: "gates / commands/readmes (.)",
            conclusion: "failure",
            url: "https://github.com/org/repo/actions/runs/43256223476/job/131315368752"
          },
          {
            databaseId: 131315369219,
            name: "gates / commands/fmt (.)",
            conclusion: "success",
            url: "https://github.com/org/repo/actions/runs/43256223476/job/131315369219"
          },
          {
            databaseId: 131315369371,
            name: "gates / commands/msrv (.)",
            conclusion: "success",
            url: "https://github.com/org/repo/actions/runs/43256223476/job/131315369371"
          },
          {
            databaseId: 131315369442,
            name: "gates / commands/nextest (.)",
            conclusion: "success",
            url: "https://github.com/org/repo/actions/runs/43256223476/job/131315369442"
          }
        ]
      }
    ]
  }
]
