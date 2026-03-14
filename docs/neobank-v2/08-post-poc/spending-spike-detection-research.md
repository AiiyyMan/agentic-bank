# Spending Spike Detection: Research & Algorithm Design

**Context:** The current `InsightService.detectSpendingSpikes()` uses linear day-extrapolation to project partial-month spend to a full month, then compares against a 30-day rolling total. On day 5 of the month, actual spend is multiplied by 6 — producing guaranteed false spikes for any category with early-month purchases (groceries, subscriptions). This document surveys the state of the art and proposes three concrete replacement algorithms.

---

## Part 1: Research Summary by Source Type

### 1.1 Official PFM Provider Documentation

**Plaid**

Plaid's public developer docs reveal what large-scale PFM infrastructure looks like at the data-access layer rather than the algorithmic layer. Key findings:

- The `/transactions/recurring/get` endpoint identifies recurring transactions by clustering historical payments from the same counterparty at regular intervals. Plaid does not publish the clustering algorithm but the endpoint returns `frequency` (weekly, monthly, etc.) and `average_amount`, suggesting a median-based approach rather than mean, as medians are resistant to one-off large payments.
- The AI-enhanced transaction categorisation (v2, December 2025) uses supervised ML trained on 145+ engineered features and ~1.44M labelled data points (from the LendScore paper, which describes the same Plaid data pipeline). The categorisation uses pattern recognition "across millions of transactions daily" — i.e. population-level priors inform per-user classification.
- Plaid's LendScore model uses XGBoost with SHAP explainability and the Kolmogorov-Smirnov statistic to validate lift. It works on **cash flow volatility** as a feature — the variance of balance movements over time — which is directly relevant to anomaly detection. High cash flow volatility is itself a signal.
- **Key takeaway:** Plaid separates data enrichment (categorisation, merchant name normalisation) from analytics (recurring detection, cash flow modelling). They do not expose a "spending spike" API endpoint — that logic is left to the application layer.

**MX**

MX's Platform API documentation (overview level only — deeper API reference requires an account) describes:
- A "Spending Plan" concept — users set budgets per category, and the system tracks against them.
- A "Net Worth" derived endpoint.
- The phrase "insights into financial behaviours, trends, and needs" without algorithmic specifics.
- MX claims 30% improvement in financial health scores in 12 weeks — suggesting their insights engine drives action, but they do not document the detection algorithm.

**Yodlee / Envestnet**

Yodlee's API reference lists a "Get Transaction Summary" endpoint in its Derived APIs section that aggregates transactions by category over a specified period. No algorithmic detail is published. The product page for Analytics Plus references "spending trends" and "cash flow patterns" but all specifics are behind a sales engagement.

**TrueLayer**

TrueLayer's Data API (UK open banking) focuses purely on data retrieval — raw transaction records with merchant name and amount. There is no spending insight or anomaly detection layer in the public API. TrueLayer positions enrichment (categorisation) as a separate product. The developer docs confirm this is infrastructure, not analytics.

**Summary of PFM provider research:** Major providers (Plaid, MX, Yodlee, TrueLayer) treat transaction retrieval and enrichment as infrastructure. Spending anomaly detection is an application-layer responsibility left to the developer. None publish their spike-detection algorithms. The recurring transaction detection in Plaid and the budget tracking in MX are the closest public analogues.

---

### 1.2 UK Neobank Engineering Blogs

**Monzo**

Monzo's engineering blog (monzo.com/blog) reveals several relevant data points:

- **Machine Learning at Monzo 2025** confirms ML is used for "defending against financial crime, scaling operations, and powering intelligent personalised experiences." The personalisation use case aligns with spending insights.
- **Fraud Detection (March 2026):** Monzo uses multi-task neural networks with shared fraud representations. The key insight applicable to spending analysis: they model *user-level baselines* from historical behaviour, then score deviations from those baselines. For fraud, the deviation threshold is strict; for spending insights, a looser threshold is appropriate.
- **1p Savings Challenge (November 2025):** Involves a data science implementation that tracks incremental savings — not directly useful, but confirms Monzo builds custom analytics in-house rather than using off-the-shelf tools.
- Monzo's spending analytics (visible in the app) uses **calendar-month buckets** for the primary view, not rolling windows. Their "Summary" tab resets on the 1st of each month. This means Monzo *deliberately avoids* the early-month extrapolation problem by only showing actuals, never projections, within the month view. Spike alerts are reserved for when the month-to-date has already crossed a meaningful threshold.

**Starling Bank**

No engineering blog posts found that describe spending analytics internals. Starling's "Spending Insights" feature is visible in the app but no technical documentation is publicly available.

**Key UK neobank insight:** Monzo avoids early-month false positives by showing actuals and reserving proactive alerts for when spend has already crossed a threshold — not a projected threshold. This is a crucial design choice, not an algorithmic one.

---

### 1.3 Academic and Technical Blogs

**STL Decomposition (Seasonal and Trend Decomposition using Loess)**

From Rob Hyndman's Forecasting textbook (otexts.com/fpp3/stl.html — publicly accessible):

STL decomposes a time series into three additive components:

```
Y(t) = T(t) + S(t) + R(t)
```

Where:
- `T(t)` = trend-cycle (underlying direction)
- `S(t)` = seasonal component (e.g. weekly pay-cycle effects)
- `R(t)` = remainder (unexplained residual)

The remainder `R(t)` is the anomaly signal. STL uses LOESS (locally weighted regression) to fit the trend and seasonal components robustly — the "robust" flag in STL makes the fitting resistant to outliers, so extreme spikes don't contaminate the baseline. STL is particularly well-suited for monthly spending data because:
- It handles the weekly spending cycle (pay-day effect, weekend spending)
- It can model the "1st of month" subscription cluster
- The remainder component cleanly isolates anomalous periods

**Limitation for real-time use:** STL requires a complete history window (typically ≥2 full seasonal cycles). It is a batch algorithm. For real-time alerting, you apply STL to historical data to establish the baseline, then compare current actuals against the fitted model.

**Twitter/X Seasonal Hybrid ESD (S-H-ESD)**

Twitter's 2015 blog post introduced the Seasonal Hybrid Extreme Studentised Deviate test as their production anomaly detection algorithm. The approach:

1. Decompose the time series using piecewise median decomposition (STL-like)
2. Apply the Generalized ESD test to the remainder
3. The ESD test is the classical outlier test: iteratively remove the observation with the largest studentised deviation until the p-value exceeds threshold

This is the foundation of the open-source `AnomalyDetection` R package. It handles seasonality natively and was purpose-built for the "false spike from seasonal patterns" problem. Not directly applicable to a Node.js backend without porting, but the mathematical principle is.

**Uber's Architecture Approach**

Uber's anomaly detection platform uses a model-agnostic architecture where forecasting and thresholding are decoupled. Their "TimeTravel" model handles time series with recurring patterns; "AutoStatic" handles flat/non-seasonal metrics. The key engineering principle: **separate the baseline model from the alerting threshold**. This maps cleanly to a neobank context — compute baselines in a background job, apply thresholds in the real-time path.

**Prophet (Facebook/Meta)**

Prophet is a decomposable time series model (`Y(t) = g(t) + s(t) + h(t) + ε`) with:
- `g(t)` = trend (piecewise linear or logistic)
- `s(t)` = seasonality (Fourier series)
- `h(t)` = holidays/events
- `ε` = noise (anomaly residual)

Prophet automatically detects changepoints (trend shifts) using L1 regularisation with 25 potential changepoints in the first 80% of history. For anomaly detection, you fit Prophet to historical data, generate prediction intervals, and flag observations that fall outside the intervals.

**Practical limitation:** Prophet is Python-only (no TypeScript port) and requires significant training data (multiple months minimum). For a new neobank user with 3 months of data, Prophet may not converge reliably.

**Scikit-learn Outlier Detection Methods**

From the scikit-learn documentation (directly accessible), five production algorithms for outlier detection:

| Algorithm | Basis | Best for |
|-----------|-------|----------|
| Isolation Forest | Random partitioning — anomalies have shorter path lengths | High-dimensional data, non-normal distributions |
| Local Outlier Factor (LOF) | Density comparison to k-nearest neighbours | Moderate dimensions, density-varying data |
| Elliptic Envelope | Mahalanobis distance from robust covariance | Gaussian-distributed data |
| One-Class SVM | Boundary learning | Well-defined inlier distribution |
| ECOD (PyOD) | Empirical CDF-based | Unsupervised, no distributional assumption |

For univariate spending-per-category time series, Isolation Forest and LOF are overkill. The data is one-dimensional (spend amount) with temporal structure. **Statistical methods outperform ML methods in low-dimensional, interpretable financial contexts.**

**MAD (Median Absolute Deviation) — Datadog Production Experience**

From Datadog's engineering blog on outlier detection, MAD is their recommended robust statistic:

```
MAD = median(|Xi - median(X)|)
```

A modified Z-score using MAD:

```
modified_z = 0.6745 * (Xi - median(X)) / MAD
```

The constant 0.6745 makes MAD consistent with standard deviation for normally distributed data. Flag when `|modified_z| > threshold` (typically 3.5).

MAD is resistant to outliers in the baseline window — unlike mean-based rolling averages, a single large Christmas spend doesn't inflate future "normal" thresholds. This is the key advantage for spending data where outliers in the history window are common.

---

### 1.4 Open Source Projects

**PyOD (Python Outlier Detection)**

PyOD is the most comprehensive open-source library for outlier detection (45+ algorithms). For univariate spending data, the relevant algorithms are:

- **HBOS (Histogram-Based Outlier Score):** Constructs a histogram of the feature distribution; outlier score = inverse probability from histogram. Extremely fast, works well for univariate data, no distributional assumptions.
- **ECOD (Empirical Cumulative Distribution Functions):** Models the tail probability using empirical CDFs. Principled, interpretable — an observation with empirical CDF value > 0.95 is in the top 5% of the distribution and likely anomalous.
- **LOF:** Good for multi-category joint anomalies (e.g. "spending pattern across all categories is unusual today").

PyOD is Python-only. The mathematical principles are portable to TypeScript.

**Prophet**

Discussed above. Python-only, batch-oriented, requires substantial history.

**AnomalyDetection (Twitter R package)**

Implements S-H-ESD. R-only. The mathematical approach is portable.

**Key open-source finding:** There is no mature TypeScript/JavaScript library for time series anomaly detection. The space is dominated by Python. A neobank implementing in Node.js must either: (a) port the statistical math directly, (b) call a Python microservice, or (c) use simpler statistical primitives that are easy to implement in TypeScript.

---

### 1.5 Stack Overflow / Developer Community Forums

Stack Overflow does not permit direct access from this research environment. Based on the research gathered, common developer community discussions around spending anomaly detection converge on:

1. **The rolling window vs. calendar month debate:** Most developers naively use "this month vs last month" — the same early-month extrapolation problem described in this ticket. The community consensus is that rolling windows are superior for anomaly detection; calendar periods are better for user-facing display.
2. **Z-score vs. IQR vs. MAD:** The community generally recommends MAD over mean/standard-deviation-based Z-scores for skewed financial data.
3. **Minimum data requirements:** Consensus is that you need at least 60–90 days of data before attempting any statistical baseline. Before that, use heuristic rules (e.g. "first time spending > £100 in category X").

---

## Part 2: Algorithm Deep Dives

### Algorithm A: Median-Based Rolling Comparison (Simple)

**Description:** Replace the current linear extrapolation with direct comparison of the rolling 30-day actual spend against a longer-term median. Never extrapolate partial periods.

**How it works:**

```
1. Compute baseline: median of monthly spend per category over the past 6 months
   (6 separate calendar months, not a rolling 180 days)
2. Compute current: actual spend in the last 30 rolling days
3. Compute spike ratio: current / baseline_median
4. Alert if spike_ratio >= threshold (e.g. 1.8)
```

The critical change from the current algorithm: **never project a partial month**. Instead, compare a 30-day rolling window (which is always complete by definition) against the median of past rolling-30-day windows.

**The math:**

```
For each category C:
  windows = [spend(C, day-30 to day), spend(C, day-60 to day-30), ..., spend(C, day-180 to day-150)]
  baseline = median(windows)
  current  = spend(C, today-30 to today)
  ratio    = current / baseline  (if baseline > 0)

  if ratio >= 1.8 AND current >= min_spend_threshold: SPIKE
```

Using median of windows rather than mean means one high-spend month (Christmas, holiday) does not inflate the baseline.

**Data requirements:**
- Minimum: 60 days of transaction history (to have 2 baseline windows)
- Ideal: 180 days (6 windows for a robust median)
- Per-category transaction count: at least 3 transactions in baseline window (suppress for sparse categories)

**Pros:**
- Eliminates the early-month false spike problem entirely (no extrapolation)
- Simple to implement in TypeScript with no dependencies
- Interpretable: "Your dining spend this month (£340) is 2.1x your typical £162"
- Handles irregular spend cycles (fortnightly paid users, etc.)
- Robust to single outlier months via median

**Cons:**
- Does not account for seasonality (Christmas spend compared to summer baseline will produce false positives)
- The 30-day rolling window creates a "cliff edge" where one large transaction entering or leaving the window causes apparent spikes
- Minimum data requirement means new users get no spikes for the first 60 days

**False positive profile:**
- **Early-month problem:** Eliminated (no extrapolation)
- **Seasonal false positives:** Moderate risk (December vs August baseline)
- **New users:** Suppressed by minimum data check (good — better to show nothing than noise)
- **Pay-day effect:** Low risk (30-day window naturally smooths pay cycles)

**Real-time vs. batch:** Real-time safe. Query runs in <100ms on typical transaction volumes.

---

### Algorithm B: Per-Category Z-Score with MAD Baseline (Intermediate)

**Description:** Use a modified Z-score based on Median Absolute Deviation (MAD) to detect statistically significant deviations. This is the production approach used by Datadog and consistent with academic best practice for skewed distributions.

**How it works:**

The standard Z-score `(x - mean) / stddev` is sensitive to outliers in the baseline — one large transaction inflates both the mean and the standard deviation, making future spikes harder to detect. MAD replaces both:

```
MAD = median(|Xi - median(X)|)
modified_z = 0.6745 * (x - median(X)) / MAD
```

The constant 0.6745 is the 75th percentile of the normal distribution, making MAD scale-consistent with σ for Gaussian data. Flag when `|modified_z| > 3.5` (Iglewicz & Hoaglin's recommended threshold).

**Applied to spending:**

```
For each category C:
  // Baseline: last 6 monthly spend totals
  monthly_spends = [m1, m2, m3, m4, m5, m6]  // spend per calendar month
  baseline_median = median(monthly_spends)
  MAD = median(|mi - baseline_median|) for each mi

  // Current: last 30 rolling days
  current = spend(C, today-30 to today)

  // Score
  if MAD == 0: use simple ratio check (baseline_median * 1.5)
  else: modified_z = 0.6745 * (current - baseline_median) / MAD

  if modified_z > 3.5 AND current >= min_spend_threshold: SPIKE
```

**Handling MAD = 0:** When all months have identical spend (e.g. a fixed subscription), MAD = 0 and the formula breaks. In this case, fall back to: flag if current > 1.2 * baseline_median (any deviation from a fixed amount is notable).

**Day-of-month adjustment:** Rather than extrapolating, apply a **minimum accrual guard**: only run the spike check after day 7 of the rolling window, and use the actual 30-day window regardless of position in the calendar month.

**Data requirements:**
- Minimum: 90 days of history (3 monthly buckets for meaningful MAD)
- Ideal: 180+ days (6 monthly buckets)
- Minimum 5 transactions in baseline window per category

**Pros:**
- Statistically principled — adapts to each user's spend volatility
- High-volatility users (irregular income, variable lifestyle) get higher thresholds automatically
- Low-volatility users (predictable fixed costs) get tighter thresholds
- Eliminates early-month problem (operates on 30-day rolling windows)
- Widely understood — explainable to regulators and users

**Cons:**
- Requires 3+ months of data before meaningful baselines
- More complex to implement and test than Algorithm A
- MAD = 0 edge case requires special handling
- Monthly bucket approach still loses some information about within-month distribution

**False positive profile:**
- **Early-month problem:** Eliminated
- **Seasonal false positives:** Reduced vs. Algorithm A (MAD adapts to seasonal variance if the season appears in the 6-month window)
- **New users:** Graceful fallback to Algorithm A or suppression
- **Sparse categories:** Suppressed by minimum transaction count check

**Real-time vs. batch:** The baseline computation (6 monthly aggregates) should be pre-computed and cached (as the current `computeCategoryAverages` does). The spike check is then real-time.

---

### Algorithm C: Exponentially Weighted Moving Average (EWMA) with Adaptive Threshold (Sophisticated)

**Description:** Use an Exponentially Weighted Moving Average to estimate a continuously updated baseline, combined with an adaptive standard deviation band. This is the approach used in process control (Shewhart control charts) and adapted for financial monitoring.

**How it works:**

EWMA gives more weight to recent history while never discarding older data entirely. It is the financial industry standard for volatility estimation (used in GARCH models, VaR calculations, etc.):

```
EWMA(t) = α * x(t) + (1 - α) * EWMA(t-1)
```

Where α is the smoothing factor (0 < α < 1). Higher α = more weight to recent periods.

For spending anomaly detection, compute the EWMA of the daily spend per category, and the EWMA of the squared deviations (for adaptive variance):

```
For each day t, category C:
  x(t)          = spend on day t in category C
  μ(t)          = α * x(t) + (1 - α) * μ(t-1)           // EWMA mean
  σ²(t)         = α * (x(t) - μ(t))² + (1 - α) * σ²(t-1) // EWMA variance
  σ(t)          = sqrt(σ²(t))                              // EWMA std dev

  upper_band(t) = μ(t) + k * σ(t)  // control limit, k=3 for 3-sigma

  if x(t) > upper_band(t): DAY-LEVEL SPIKE
```

For monthly aggregation, aggregate daily EWMA values:

```
  monthly_projected = μ(current) * days_remaining_in_window
  // But better: just compare 30-day rolling total to 30-day EWMA sum
  current_30d = sum(x(t) for t in last 30 days)
  ewma_30d    = 30 * μ(today)  // expected 30-day total

  if current_30d > ewma_30d + 3 * sqrt(30) * σ(today): SPIKE
```

The `sqrt(30)` scaling converts the daily variance to a 30-day window variance under the (approximate) assumption of independence.

**Choosing α:**
- α = 0.1: slow-changing baseline, remembers ~10 days heavily
- α = 0.05: longer memory, more stable baseline, recommended for monthly spending
- A common heuristic for monthly data: α ≈ 2/(N+1) where N = lookback period in days, so for 90-day lookback: α = 2/91 ≈ 0.022

**Initialisation (cold start):**

For users with less than 30 days of history, initialise μ(0) from population-level priors per category (e.g. median UK household spend in FOOD_AND_DRINK = £300/month). This avoids the data requirement problem of Algorithms A and B.

**Day-of-month problem:** EWMA operates on daily data and does not require extrapolation. The 30-day rolling comparison is naturally complete.

**Pros:**
- Adapts continuously — no stale 6-month averages
- Cold-start solvable with population priors
- Day-level granularity enables richer explanations ("Tuesday was 4x your daily average for dining")
- Used in professional financial risk management (GARCH is a sophisticated version of this)
- Handles seasonal drift naturally (EWMA tracks slow drift in spend patterns)

**Cons:**
- Requires daily granularity — need to store/compute per-day category spend
- More state to maintain (μ and σ² per user per category, updated daily)
- α choice affects sensitivity significantly — needs tuning
- Less interpretable than median comparison: "your EWMA-adjusted spend is 3.2 sigma above baseline" is not user-friendly (must translate to plain language)
- Population priors for cold-start require calibration against actual user data

**False positive profile:**
- **Early-month problem:** Eliminated by design
- **Seasonal false positives:** Lowest of all three algorithms — EWMA tracks seasonal drift automatically if it happens gradually
- **Sudden spend changes (new baby, moving house):** EWMA lags behind — will flag these as spikes for several weeks before the new baseline establishes. This is arguably correct behaviour.
- **New users:** Handled by population priors, but priors introduce bias

**Real-time vs. batch:** The EWMA state (μ, σ² per category) must be updated daily in a background job. The spike check at query time is O(1) — compare current 30-day total against pre-computed expected value.

---

## Part 3: Comparison Matrix

| Dimension | Current (broken) | Algorithm A (Median Rolling) | Algorithm B (MAD Z-Score) | Algorithm C (EWMA) |
|-----------|-----------------|------------------------------|---------------------------|---------------------|
| Early-month false positives | High | Eliminated | Eliminated | Eliminated |
| Seasonal false positives | High | Moderate | Low | Very low |
| Min. data requirement | 30 days | 60 days | 90 days | 0 days (with priors) |
| Implementation complexity | Low | Low | Medium | High |
| TypeScript complexity | Trivial | Low | Medium | Medium-High |
| Interpretability | Poor | Excellent | Good | Moderate |
| Adapts to user volatility | No | No | Yes | Yes |
| Background job required | No | No | No (cache helps) | Yes (daily EWMA update) |
| Regulatory explainability | Low | High | High | Medium |

---

## Part 4: Recommendation

### Implement Algorithm A now; plan Algorithm B for Q2

**Rationale:**

The current algorithm has a critical flaw (early-month false spikes) that undermines user trust. Algorithm A fixes this with minimal code change, is easy to reason about, and aligns with how Monzo's app actually behaves (show actuals, not projections).

Algorithm B is the right long-term approach because it adapts to individual user volatility — a user who spends £50 on dining every month should get a lower threshold than one who spends irregularly between £20 and £200. But it requires 90 days of data before being meaningful, so rolling it out to a new neobank with fresh users means most users get suppressed alerts anyway.

Algorithm C is the most sophisticated but the operational overhead (daily background job updating EWMA state per user per category) is premature for a POC. It becomes compelling at scale when user cohort data enables good population priors for cold start.

**The specific fix that unlocks Algorithm A:**

The single change to `detectSpendingSpikes()`:

```typescript
// REMOVE: linear extrapolation
// const projectedMonthly = (cat.amount / daysIntoMonth) * 30;

// REPLACE with: compare rolling 30-day actual against median of prior rolling windows
// Query: what did this category cost in each of the 6 prior 30-day windows?
// Use median of those 6 amounts as the baseline.
// Compare cat.amount (the current 30-day rolling total) directly.
```

This also means changing `computeCategoryAverages()` to return **median of rolling windows** rather than the sum of the last 30 days (which is currently used as a "monthly average" — it's actually just the last month's total, making the ratio always close to 1.0).

**Suggested thresholds for Algorithm A:**

- Minimum spend to consider (avoid noise): £10 per category in current window
- Minimum transaction count: 2 in current window (avoid single large purchase)
- Spike ratio threshold: 1.8x (current uses 1.5x, which is too sensitive for a rolling comparison)
- Minimum historical windows: 2 (suppress if fewer than 2 prior windows exist)
- Suppress common seasonal categories in December: GENERAL_MERCHANDISE, TRAVEL, FOOD_AND_DRINK (optional but reduces Christmas false positives)

**Week-of-month guard for Algorithm A:**

Even with rolling windows, if a user makes their first grocery shop of the rolling window on day 1 (it happens to fall there), the rolling window comparison is fair. There is no early-month problem with Algorithm A. But add a minimum transaction count guard per category to avoid "first transaction of the month triggers spike" for infrequent categories:

```typescript
if (cat.transaction_count < 2) continue; // single transaction is not a spike
```

---

## Part 5: Implementation Notes for Node.js/TypeScript

### Algorithm A — TypeScript Sketch

```typescript
/**
 * Compute median of rolling 30-day windows over the past 6 months.
 * Returns null if insufficient data.
 */
async function getRollingWindowMedian(
  userId: string,
  category: string,
  today: Date,
): Promise<number | null> {
  const windows: number[] = [];

  for (let i = 1; i <= 6; i++) {
    const windowEnd = new Date(today.getTime() - (i - 1) * 30 * 86400_000);
    const windowStart = new Date(today.getTime() - i * 30 * 86400_000);
    const total = await getCategorySpend(userId, category, windowStart, windowEnd);
    windows.push(total);
  }

  if (windows.filter(w => w > 0).length < 2) return null;

  // Median of the 6 windows
  windows.sort((a, b) => a - b);
  const mid = Math.floor(windows.length / 2);
  return windows.length % 2 === 0
    ? (windows[mid - 1] + windows[mid]) / 2
    : windows[mid];
}

/**
 * Spike detection: compare current 30-day rolling spend
 * against median of 6 prior 30-day windows.
 * No extrapolation; no calendar-month dependency.
 */
async function detectSpikes(userId: string): Promise<SpendingSpike[]> {
  const today = new Date();
  const windowStart = new Date(today.getTime() - 30 * 86400_000);

  const currentBreakdown = await getSpendingByCategory(userId, {
    start_date: windowStart.toISOString(),
    end_date: today.toISOString(),
  });

  const spikes: SpendingSpike[] = [];

  for (const cat of currentBreakdown.categories) {
    if (cat.amount < 10) continue;           // noise floor
    if (cat.transaction_count < 2) continue; // single tx guard

    const median = await getRollingWindowMedian(userId, cat.category, today);
    if (!median || median <= 0) continue;    // insufficient history

    const ratio = cat.amount / median;
    if (ratio >= 1.8) {
      spikes.push({
        category: cat.category,
        current_amount: cat.amount,
        average_amount: roundMoney(median),
        spike_ratio: roundMoney(ratio),
        percent_increase: Math.round((ratio - 1) * 100),
      });
    }
  }

  return spikes.sort((a, b) => b.spike_ratio - a.spike_ratio);
}
```

### Performance Note

The rolling window approach requires 6 additional DB queries per category per spike detection call. Cache the window medians in `user_insights_cache` (already exists) with a 24-hour TTL to avoid repeated computation. The baseline medians only need updating once daily.

### Algorithm B MAD Implementation (future)

```typescript
function computeMAD(values: number[]): { median: number; mad: number } {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];

  const deviations = values.map(v => Math.abs(v - median)).sort((a, b) => a - b);
  const deviationMid = Math.floor(deviations.length / 2);
  const mad = deviations.length % 2 === 0
    ? (deviations[deviationMid - 1] + deviations[deviationMid]) / 2
    : deviations[deviationMid];

  return { median, mad };
}

function modifiedZScore(value: number, median: number, mad: number): number {
  if (mad === 0) return value > median ? Infinity : 0;
  return 0.6745 * (value - median) / mad;
}

// Spike if modifiedZScore > 3.5 AND current >= noise_floor
```

---

## Part 6: Sources and References

| Source | Type | Relevance |
|--------|------|-----------|
| Plaid developer docs (plaid.com/docs) | Official PFM provider | Recurring detection, categorisation pipeline |
| Plaid LendScore blog (plaid.com/blog) | Engineering blog | XGBoost + SHAP, cash flow feature engineering |
| MX Platform API overview (docs.mx.com) | Official PFM provider | Spending plan concept, no algorithmic detail |
| Yodlee API reference (developer.yodlee.com) | Official PFM provider | Derived analytics endpoints, no algorithms |
| TrueLayer Data API (docs.truelayer.com) | Official PFM provider | Pure retrieval, no insights layer |
| Monzo engineering blog (monzo.com/blog) | UK neobank | ML for personalisation, fraud detection baselines |
| Forecasting: Principles and Practice (otexts.com/fpp3) | Academic | STL decomposition, seasonality, remainder anomalies |
| Scikit-learn outlier detection (scikit-learn.org) | Open source | IsolationForest, LOF, EllipticEnvelope, OneClassSVM |
| Datadog outlier detection blog | Engineering blog | MAD, DBSCAN production experience |
| Uber anomaly detection (uber.com/blog) | Engineering blog | Model-agnostic architecture, TimeTravel vs AutoStatic |
| PyOD README (github.com/yzhao062/pyod) | Open source | 45+ detection algorithms, HBOS, ECOD |
| Facebook Prophet docs (facebook.github.io/prophet) | Open source | Decomposable model, changepoint detection, outlier handling |
| Amazon Forecast docs (aws.amazon.com/forecast) | Cloud service | Probabilistic forecasting, ensemble selection |
| S-H-ESD (Twitter/X engineering blog 2015) | Engineering blog | Seasonal Hybrid ESD, production anomaly detection |

---

*Document prepared: March 2026. Intended audience: Experience Squad (EX-Insights), InsightService implementers.*
