import { Observable } from 'rxjs';

export interface ChartDataPoint {
  x: number | string;
  y: number;
}

export interface AnalyticsData {
  sensitivity: { 
    hpValues: number[], 
    wrKurawa: number[], 
    wrPandawa: number[],
    wrRajasika?: number[],
    p1Name?: string,
    p2Name?: string,
    p3Name?: string
  };
  complexity: { variables: number[], times: number[] };
  powerSpike: { turns: number[], pandawa: number[], kurawa: number[], rajasika: number[] };
  clustering: { x: number, y: number, cluster: number }[];
}


export abstract class AnalyticsService {
  abstract getAnalyticsData(): Observable<AnalyticsData>;
  abstract recalculateAnalytics(loss: number, p1WinRate?: number, avgTurns?: number, p1Name?: string, p2Name?: string): void;
}
