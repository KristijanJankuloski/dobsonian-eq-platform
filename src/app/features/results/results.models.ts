/** One displayed value. */
export interface ResultRow {
  label: string;
  symbol: string;
  /** Formatted value, no unit. */
  value: string;
  unit: string;
}

export interface ResultSection {
  id: string;
  title: string;
  rows: ResultRow[];
}

/** One row of the circular-segments table: a measure of the north segment. */
export interface SegmentRow {
  label: string;
  value: string;
  unit: string;
}
