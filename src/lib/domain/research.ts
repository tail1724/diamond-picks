/**
 * Reference data for the research, registry, replay and performance workspaces.
 * This is a synthetic governance/analytics record for the demonstration
 * environment; the live pipeline (src/lib/engines/*) computes the production
 * slate, while these tables stand in for the historical stores the PRD's
 * Research, Model Registry, Replay Lab and Analytics contexts would own.
 */

export type ExperimentStatus = "Promote" | "Review" | "Backtest" | "Reject";
export interface Experiment {
  id: string;
  title: string;
  candidate: string;
  dataset: string;
  brier: number;
  clv: number;
  status: ExperimentStatus;
}

export const EXPERIMENTS: Experiment[] = [
  {
    id: "EXP-184",
    title: "Bullpen leverage decay",
    candidate: "v2.1.0-rc2",
    dataset: "2023–26",
    brier: 0.184,
    clv: 0.052,
    status: "Promote",
  },
  {
    id: "EXP-183",
    title: "Transformer lineup sequence",
    candidate: "v2.1.0-rc1",
    dataset: "2021–26",
    brier: 0.191,
    clv: 0.044,
    status: "Review",
  },
  {
    id: "EXP-181",
    title: "Weather interaction features",
    candidate: "v2.0.1-rc4",
    dataset: "2022–26",
    brier: 0.187,
    clv: 0.049,
    status: "Backtest",
  },
  {
    id: "EXP-178",
    title: "Catcher framing adjustment",
    candidate: "v2.0.1-rc2",
    dataset: "2024–26",
    brier: 0.199,
    clv: 0.031,
    status: "Reject",
  },
];

export interface FeatureImportance {
  label: string;
  value: number;
}
/** Production moneyline ensemble · SHAP mean |value|. */
export const FEATURE_IMPORTANCE: FeatureImportance[] = [
  { label: "Starting pitcher", value: 22.8 },
  { label: "Lineup xwOBA", value: 20.1 },
  { label: "Bullpen fatigue", value: 17.2 },
  { label: "Park & weather", value: 13.4 },
  { label: "Defense", value: 10.3 },
  { label: "Travel / rest", value: 7.2 },
];

export type ModelStatus = "Active" | "Candidate" | "Retired";
export interface ModelRecord {
  version: string;
  note: string;
  status: ModelStatus;
  parent: string;
  dataset: string;
  featureSet: string;
  brier: number;
  clv: number;
  rollback: string;
  approval: string;
  promoted: string;
}

export const MODELS: ModelRecord[] = [
  {
    version: "v2.0.0",
    note: "Production · promoted July 2",
    status: "Active",
    parent: "v1.9.3",
    dataset: "ds-v67",
    featureSet: "fs-v41",
    brier: 0.188,
    clv: 0.048,
    rollback: "v1.9.3",
    approval: "Approved",
    promoted: "2026-07-02",
  },
  {
    version: "v2.1.0-rc2",
    note: "Bullpen leverage decay · EXP-184",
    status: "Candidate",
    parent: "v2.0.0",
    dataset: "ds-v69",
    featureSet: "fs-v43",
    brier: 0.184,
    clv: 0.052,
    rollback: "v2.0.0",
    approval: "Pending",
    promoted: "—",
  },
  {
    version: "v1.9.3",
    note: "Previous production · rollback target",
    status: "Retired",
    parent: "v1.9.1",
    dataset: "ds-v61",
    featureSet: "fs-v38",
    brier: 0.194,
    clv: 0.041,
    rollback: "v1.9.1",
    approval: "Approved",
    promoted: "2026-05-18",
  },
];

export type ReplayStatus = "Complete" | "Ready" | "Partial odds";
export interface ReplaySlate {
  date: string;
  games: number;
  snapshot: string;
  status: ReplayStatus;
}
export const REPLAY_SLATES: ReplaySlate[] = [
  { date: "July 12, 2026", games: 15, snapshot: "2026.07.12.3", status: "Complete" },
  { date: "July 11, 2026", games: 14, snapshot: "2026.07.11.2", status: "Complete" },
  { date: "July 10, 2026", games: 12, snapshot: "2026.07.10.4", status: "Ready" },
  { date: "July 9, 2026", games: 10, snapshot: "2026.07.09.2", status: "Partial odds" },
];
export const REPLAY_ARCHIVE_COUNT = 2416;

/** Rolling 30-day analytics (Performance workspace). */
export const PERFORMANCE = {
  roiUnits: 34.7,
  roiPct: 0.061,
  avgClv: 0.048,
  brier: 0.188,
  logLoss: 0.541,
  settledBets: 1284,
  winRate: 0.567,
  backtestObservations: 6_400_000,
  datasetVersion: "v67",
  // Calibration: predicted bucket → observed hit rate (well-calibrated ≈ diagonal).
  calibration: [
    { bucket: "50–55%", predicted: 0.525, observed: 0.517, n: 214 },
    { bucket: "55–60%", predicted: 0.575, observed: 0.569, n: 188 },
    { bucket: "60–65%", predicted: 0.625, observed: 0.634, n: 151 },
    { bucket: "65–70%", predicted: 0.675, observed: 0.662, n: 122 },
    { bucket: "70–75%", predicted: 0.725, observed: 0.741, n: 96 },
    { bucket: "75–80%", predicted: 0.775, observed: 0.788, n: 67 },
  ],
  // Cumulative units over the last 14 settled slates.
  equityCurve: [0, 2.1, 1.4, 3.8, 6.2, 5.1, 8.9, 11.4, 10.2, 14.6, 18.1, 22.5, 27.9, 31.2, 34.7],
  byMarket: [
    { market: "Moneyline", roi: 0.052, clv: 0.051, brier: 0.188, n: 384 },
    { market: "Totals", roi: 0.071, clv: 0.049, brier: 0.191, n: 356 },
    { market: "Run line", roi: 0.038, clv: 0.043, brier: 0.201, n: 142 },
    { market: "Pitcher props", roi: 0.066, clv: 0.047, brier: 0.186, n: 268 },
    { market: "Hitter props", roi: 0.044, clv: 0.039, brier: 0.207, n: 134 },
    { market: "Parlays", roi: 0.093, clv: 0.058, brier: 0.214, n: 96 },
  ],
};

export const LAB_STATS = {
  backtestObservations: 6_400_000,
  candidateWinRate: "1 / 4",
  datasetVersion: "v67",
};
