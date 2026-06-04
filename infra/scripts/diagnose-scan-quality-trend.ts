#!/usr/bin/env ts-node
/**
 * diagnose-scan-quality-trend.ts — READ-ONLY analysis (no writes).
 *
 * Answers: did menu-scan quality measurably change recently, and if so which
 * lever moved? Pulls every job in the last N days and computes per-day proxies:
 *   - image resolution (median + min long-side, % of images under 600px)
 *   - retry rate (attempts >= 2 → ran on gpt-4o-mini)
 *   - dishes/job, model confidence
 * Then contrasts an "older" baseline window vs the "recent" window and shows
 * which restaurants the low-resolution jobs cluster in (selection vs systemic).
 *
 * Hits live prod via infra/scripts/.env service-role creds. Downloads each
 * image to measure dimensions (small JPEGs); pass --no-dims to skip that.
 *
 * Usage:
 *   pnpm --filter @eatme/infra-scripts ts-node diagnose-scan-quality-trend.ts [--days 30] [--recent 3] [--no-dims] [--max-jobs 200]
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const supa = createClient(SUPABASE_URL, SERVICE_ROLE);

const argv = process.argv.slice(2);
const numArg = (flag: string, def: number) => {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? Number(argv[i + 1]) : def;
};
const DAYS = numArg('--days', 30);
const RECENT_DAYS = numArg('--recent', 3);
const MAX_JOBS = numArg('--max-jobs', 250);
const DO_DIMS = !argv.includes('--no-dims');

// NOTE: Date.now() is fine in a plain ts-node script (only the Workflow runtime
// forbids it). We need a "now" to bucket by age.
const NOW = Date.now();
const DAY_MS = 86_400_000;

interface ImageRef {
  bucket: string;
  path: string;
}
interface JobRow {
  id: string;
  restaurant_id: string;
  created_at: string;
  status: string;
  attempts: number;
  input: { images?: ImageRef[] } | null;
  result_json: { dishes?: Array<{ confidence?: number }> } | null;
}

function jpegLongSide(buf: Buffer): number | null {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) {
      i++;
      continue;
    }
    const m = buf[i + 1];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      const h = buf.readUInt16BE(i + 5);
      const w = buf.readUInt16BE(i + 7);
      return Math.max(w, h);
    }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

const median = (xs: number[]): number => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const avg = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const pct = (n: number, d: number): number => (d ? Math.round((100 * n) / d) : 0);

async function measureJobImages(images: ImageRef[]): Promise<number[]> {
  const out = await Promise.all(
    images.map(async img => {
      try {
        const { data, error } = await supa.storage.from(img.bucket).download(img.path);
        if (error || !data) return null;
        return jpegLongSide(Buffer.from(await data.arrayBuffer()));
      } catch {
        return null;
      }
    })
  );
  return out.filter((x): x is number => typeof x === 'number');
}

interface JobMetrics {
  date: string;
  ageDays: number;
  restaurant_id: string;
  status: string;
  retried: boolean;
  nDishes: number;
  avgConf: number;
  imgLongSides: number[]; // per-image long side
}

async function main() {
  const sinceIso = new Date(NOW - DAYS * DAY_MS).toISOString();
  const { data, error } = await supa
    .from('menu_scan_jobs')
    .select('id, restaurant_id, created_at, status, attempts, input, result_json')
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(MAX_JOBS);
  if (error) throw error;
  const jobs = (data ?? []) as JobRow[];

  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`  MENU-SCAN QUALITY TREND  (last ${DAYS}d, ${jobs.length} jobs, dims=${DO_DIMS})`);
  console.log('═══════════════════════════════════════════════════════════════════');

  const metrics: JobMetrics[] = [];
  for (const j of jobs) {
    const dishes = j.result_json?.dishes ?? [];
    const confs = dishes
      .map(d => (typeof d.confidence === 'number' ? d.confidence : NaN))
      .filter(n => !isNaN(n));
    const images = j.input?.images ?? [];
    const imgLongSides = DO_DIMS && images.length ? await measureJobImages(images) : [];
    metrics.push({
      date: j.created_at.slice(0, 10),
      ageDays: (NOW - new Date(j.created_at).getTime()) / DAY_MS,
      restaurant_id: j.restaurant_id,
      status: j.status,
      retried: (j.attempts ?? 0) >= 2,
      nDishes: dishes.length,
      avgConf: avg(confs),
      imgLongSides,
    });
  }

  // ── per-day table ──
  const byDate = new Map<string, JobMetrics[]>();
  for (const m of metrics) (byDate.get(m.date) ?? byDate.set(m.date, []).get(m.date)!).push(m);
  const dates = [...byDate.keys()].sort().reverse();

  console.log('\n date        jobs  medLong  minLong  %<600px  retry%  dishes/job  avgConf');
  console.log(' ' + '─'.repeat(78));
  for (const d of dates) {
    const ms = byDate.get(d)!;
    const allImgs = ms.flatMap(m => m.imgLongSides);
    const medLong = DO_DIMS ? median(allImgs) : NaN;
    const minLong = DO_DIMS && allImgs.length ? Math.min(...allImgs) : NaN;
    const under600 = DO_DIMS ? pct(allImgs.filter(x => x < 600).length, allImgs.length) : NaN;
    const retry = pct(ms.filter(m => m.retried).length, ms.length);
    const dishesPer = avg(ms.map(m => m.nDishes));
    const conf = avg(ms.map(m => m.avgConf).filter(n => !isNaN(n)));
    const f = (n: number, w: number, dp = 0) => (isNaN(n) ? '—' : n.toFixed(dp)).padStart(w);
    console.log(
      ` ${d}  ${String(ms.length).padStart(4)}  ${f(medLong, 7)}  ${f(minLong, 7)}  ${f(under600, 6)}%  ${f(retry, 5)}%  ${f(dishesPer, 10, 1)}  ${f(conf, 7, 3)}`
    );
  }

  // ── older baseline vs recent window ──
  const recent = metrics.filter(m => m.ageDays <= RECENT_DAYS);
  const older = metrics.filter(m => m.ageDays > RECENT_DAYS);
  const summarize = (label: string, ms: JobMetrics[]) => {
    const imgs = ms.flatMap(m => m.imgLongSides);
    console.log(`\n  ${label}  (${ms.length} jobs, ${imgs.length} images)`);
    if (DO_DIMS) {
      console.log(
        `    image long-side:  median ${median(imgs).toFixed(0)}  min ${imgs.length ? Math.min(...imgs) : '—'}  | % under 600px: ${pct(imgs.filter(x => x < 600).length, imgs.length)}%  | % under 400px: ${pct(imgs.filter(x => x < 400).length, imgs.length)}%`
      );
    }
    console.log(
      `    retry rate (→mini): ${pct(ms.filter(m => m.retried).length, ms.length)}%   dishes/job: ${avg(ms.map(m => m.nDishes)).toFixed(1)}   avgConf: ${avg(ms.map(m => m.avgConf).filter(n => !isNaN(n))).toFixed(3)}`
    );
  };
  console.log('\n══════════ BASELINE vs RECENT ══════════');
  summarize(`OLDER (>${RECENT_DAYS}d ago)`, older);
  summarize(`RECENT (<=${RECENT_DAYS}d)`, recent);

  // ── low-res clustering by restaurant (selection vs systemic) ──
  if (DO_DIMS) {
    const lowResByRest = new Map<string, { lowImgs: number; totalImgs: number; jobs: number }>();
    for (const m of metrics) {
      const rec = lowResByRest.get(m.restaurant_id) ?? { lowImgs: 0, totalImgs: 0, jobs: 0 };
      rec.lowImgs += m.imgLongSides.filter(x => x < 600).length;
      rec.totalImgs += m.imgLongSides.length;
      rec.jobs += 1;
      lowResByRest.set(m.restaurant_id, rec);
    }
    const ranked = [...lowResByRest.entries()]
      .filter(([, r]) => r.totalImgs > 0)
      .sort((a, b) => b[1].lowImgs - a[1].lowImgs)
      .slice(0, 10);
    console.log('\n══════════ LOW-RES (<600px) IMAGES BY RESTAURANT (top 10) ══════════');
    for (const [rid, r] of ranked) {
      console.log(
        `  ${rid.slice(0, 8)}  ${r.lowImgs}/${r.totalImgs} imgs <600px (${pct(r.lowImgs, r.totalImgs)}%)  across ${r.jobs} job(s)`
      );
    }
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
