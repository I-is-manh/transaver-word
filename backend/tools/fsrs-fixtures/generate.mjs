// Sinh dữ liệu chuẩn từ ts-fsrs để test bản PHP (app/Fsrs). Chạy: npm install && npm run generate
// Kết quả ghi vào tests/Fixtures/fsrs.json. Không cần chạy lại trừ khi đổi phiên bản ts-fsrs.
import { writeFileSync } from 'node:fs';
import { createEmptyCard, fsrs, generatorParameters, Rating } from 'ts-fsrs';

const START = new Date('2026-01-05T08:00:00Z');
const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;

// Mỗi bước: [rating, độ lệch so với due của thẻ (phút, có thể âm = ôn sớm, có thể lớn = ôn trễ)]
const SEQUENCES = {
  good_path: [[3, 0], [3, 0], [3, 0], [3, 0], [3, 0], [3, 0]],
  easy_path: [[4, 0], [4, 0], [4, 0], [4, 0]],
  hard_and_again: [[2, 0], [2, 0], [1, 0], [3, 0], [3, 0], [2, 0], [3, 0]],
  lapse_in_review: [[3, 0], [3, 0], [3, 0], [1, 0], [1, 0], [3, 0], [3, 0], [4, 0]],
  late_reviews: [[3, 0], [3, 0], [3, 3 * 1440], [3, 20 * 1440], [2, 45 * 1440], [3, 0]],
  early_reviews: [[3, 0], [3, 0], [3, -1440], [4, -2 * 1440], [3, 0]],
  mixed_long: [[1, 0], [1, 0], [3, 0], [3, 0], [4, 0], [2, 0], [1, 0], [3, 0], [3, 0], [3, 0], [4, 0], [1, 0], [2, 0], [3, 0]],
  same_day_again: [[3, 0], [3, 0], [3, 0], [1, 0], [3, 5], [3, 0]],
};

const RETENTIONS = [0.9, 0.85, 0.95];

const iso = (d) => (d ? new Date(d).toISOString() : null);
const cardOut = (c) => ({
  due: iso(c.due),
  stability: c.stability,
  difficulty: c.difficulty,
  elapsed_days: c.elapsed_days,
  scheduled_days: c.scheduled_days,
  reps: c.reps,
  lapses: c.lapses,
  learning_steps: c.learning_steps,
  state: c.state,
  last_review: iso(c.last_review),
});

const cases = [];
for (const retention of RETENTIONS) {
  const f = fsrs(generatorParameters({ request_retention: retention, enable_fuzz: false }));
  for (const [name, steps] of Object.entries(SEQUENCES)) {
    let card = createEmptyCard(START);
    let now = START;
    const out = [];
    for (const [rating, offsetMin] of steps) {
      now = new Date(Math.max(now.getTime(), new Date(card.due).getTime() + offsetMin * MIN));
      const preview = f.repeat(card, now);
      const intervals = {};
      for (const g of [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy]) {
        intervals[g] = Math.round((new Date(preview[g].card.due).getTime() - now.getTime()) / 1000);
      }
      card = preview[rating].card;
      out.push({ now: iso(now), rating, intervals, card: cardOut(card) });
    }
    cases.push({ name, retention, steps: out });
  }
}

const target = new URL('../../tests/Fixtures/fsrs.json', import.meta.url);
writeFileSync(target, JSON.stringify({ generator: 'ts-fsrs 5.2.3', start: iso(START), cases }, null, 2) + '\n');
console.log(`Đã ghi ${cases.length} chuỗi vào ${target.pathname}`);
void DAY;
