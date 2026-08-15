export function dot(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`vector dimension mismatch: ${a.length} vs ${b.length}`);
  }
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

export function norm(a: number[]): number {
  return Math.sqrt(dot(a, a));
}

/** Cosine similarity; 0 when either vector is all-zero. */
export function cosine(a: number[], b: number[]): number {
  const denom = norm(a) * norm(b);
  return denom === 0 ? 0 : dot(a, b) / denom;
}

/** Component-wise mean of a non-empty vector set; null when the set is empty. */
export function centroid(vectors: number[][]): number[] | null {
  if (vectors.length === 0) return null;
  const dim = vectors[0].length;
  const out = new Array<number>(dim).fill(0);
  for (const v of vectors) {
    if (v.length !== dim) throw new Error("centroid: vectors have mixed dimensions");
    for (let i = 0; i < dim; i++) out[i] += v[i];
  }
  return out.map((x) => x / vectors.length);
}
