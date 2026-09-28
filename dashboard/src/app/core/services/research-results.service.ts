import { Injectable } from '@angular/core';

/**
 * The only path by which research numbers reach the dashboard: the Python
 * pipeline's own artifacts (results/*.json, data/ga_balanced_params.json),
 * served as static files by angular.json's `assets` config -- never copied
 * into, recomputed in, or hardcoded in TypeScript. A failed load rejects;
 * callers must show the error, not substitute placeholder numbers.
 */
@Injectable({ providedIn: 'root' })
export class ResearchResultsService {
  private cache = new Map<string, Promise<any>>();

  loadResult<T = any>(name: string): Promise<T> {
    return this.load(`research/results/${name}.json`);
  }

  loadData<T = any>(name: string): Promise<T> {
    return this.load(`research/data/${name}.json`);
  }

  private load(path: string): Promise<any> {
    const cached = this.cache.get(path);
    if (cached) return cached;

    const request = fetch(path).then((res) => {
      if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
      return res.json();
    }).catch((err) => {
      this.cache.delete(path);
      throw err;
    });
    this.cache.set(path, request);
    return request;
  }
}
