/* ============================================================
 * 愈合之树 — 常量 & 成长阶段定义
 * 无依赖模块
 * ============================================================ */
export const DAY = 86400000;
export const KEY = 'healingTree.state.v1';
export const BASE_PER_DAY = 0.020;
export const WATER_MULT = 3.0;
export const CARE_GROWTH = BASE_PER_DAY * WATER_MULT;
export const MAX_FILL = 3;
export const FILL_WINDOW = DAY;
export const WATER_CD = 4 * 3600 * 1000;
export const MAX_LOOKBACK = 30 * DAY;

export const STAGES = [
  { at: 0.00, key: 'seed',    label: '种子' },
  { at: 0.03, key: 'sprout',  label: '发芽' },
  { at: 0.12, key: 'sapling', label: '小苗' },
  { at: 0.25, key: 'small',   label: '小树' },
  { at: 0.45, key: 'bud',     label: '花苞' },
  { at: 0.60, key: 'bloom',   label: '开花' },
  { at: 0.80, key: 'fruit',   label: '结果' },
  { at: 1.00, key: 'canopy',  label: '树荫' },
];

export const BETTER_NEED = 7;
