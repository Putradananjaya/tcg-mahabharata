import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';
import { AnalyticsService, AnalyticsData } from '../../core/usecases/analytics.service';

@Injectable({
  providedIn: 'root'
})
export class AnalyticsImpl implements AnalyticsService {
  private initialData: AnalyticsData = {
    sensitivity: {
      hpValues: [60, 70, 80, 90, 100, 110, 120, 130, 140],
      wrKurawa: [20, 29, 37, 46, 54, 63, 71, 80, 88],
      wrPandawa: [65, 61, 57, 52, 48, 43, 39, 35, 30],
      wrRajasika: [63, 59, 55, 51, 47, 43, 39, 35, 31],
      p1Name: 'SATWIKA',
      p2Name: 'TAMASIKA',
      p3Name: 'RAJASIKA'
    },
    complexity: {
      variables: [4, 8, 12, 16, 20],
      times: [1.96, 1.91, 1.92, 2.03, 1.92]
    },
    powerSpike: {
      turns: Array.from({ length: 20 }, (_, i) => i + 1),
      pandawa: [3.0, 3.0, 3.0, 2.8, 2.7, 2.7, 2.6, 2.4, 2.3, 2.1, 1.8, 1.6, 1.5, 1.3, 1.0, 0.7, 0.4, 0.2, 0.1, 0.0],
      kurawa: [3.0, 2.9, 2.8, 2.7, 2.5, 2.4, 2.2, 2.0, 1.9, 1.7, 1.5, 1.3, 1.0, 0.8, 0.5, 0.3, 0.1, 0.0, 0.0, 0.0],
      rajasika: [3.0, 2.7, 2.4, 2.2, 1.9, 1.7, 1.4, 1.2, 1.0, 0.8, 0.5, 0.3, 0.2, 0.1, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]
    },
    clustering: [
      { x: 11.0, y: 70.0, cluster: 0 }, { x: 12.0, y: 80.0, cluster: 0 }, { x: 13.0, y: 75.0, cluster: 0 },
      { x: 11.5, y: 68.0, cluster: 0 }, { x: 12.5, y: 85.0, cluster: 0 }, { x: 13.5, y: 72.0, cluster: 0 },
      
      { x: 15.0, y: 40.0, cluster: 1 }, { x: 16.0, y: 45.0, cluster: 1 }, { x: 14.5, y: 38.0, cluster: 1 },
      { x: 15.5, y: 42.0, cluster: 1 }, { x: 16.5, y: 46.0, cluster: 1 }, { x: 14.0, y: 35.0, cluster: 1 },

      { x: 19.0, y: 12.0, cluster: 2 }, { x: 20.0, y: 8.0, cluster: 2 }, { x: 21.0, y: 5.0, cluster: 2 },
      { x: 18.5, y: 15.0, cluster: 2 }, { x: 19.5, y: 10.0, cluster: 2 }, { x: 20.5, y: 6.0, cluster: 2 }
    ]
  };

  private data$ = new BehaviorSubject<AnalyticsData>(this.initialData);

  getAnalyticsData(): Observable<AnalyticsData> {
    return this.data$.asObservable();
  }

  recalculateAnalytics(loss: number, p1WinRate?: number, avgTurns?: number, p1Name?: string, p2Name?: string): void {
    const current = { ...this.data$.value };
    
    // Equilibrium point (center WR)
    const eqWR = p1WinRate !== undefined ? p1WinRate : 50;
    const slope = 0.85;

    const hpValues = [60, 70, 80, 90, 100, 110, 120, 130, 140];

    current.sensitivity = {
      hpValues,
      p1Name: p1Name || 'SATWIKA',
      p2Name: p2Name || 'TAMASIKA',
      p3Name: 'RAJASIKA',
      wrKurawa: hpValues.map(hp => Math.min(95, Math.max(10, Math.round(eqWR + (hp - 95) * slope)))),
      wrPandawa: hpValues.map(hp => Math.min(90, Math.max(10, Math.round(eqWR - (hp - 95) * 0.44)))),
      wrRajasika: hpValues.map(hp => Math.min(90, Math.max(10, Math.round((eqWR - 1) - (hp - 95) * 0.41))))
    };

    // Scatter point clusters center dynamically on the actual match average turns
    const targetTurns = avgTurns !== undefined ? avgTurns : 13.5;
    current.clustering = [
      { x: targetTurns - 2, y: 70.0, cluster: 0 }, { x: targetTurns - 1, y: 80.0, cluster: 0 }, { x: targetTurns - 1.5, y: 75.0, cluster: 0 },
      { x: targetTurns, y: 40.0, cluster: 1 }, { x: targetTurns + 1, y: 45.0, cluster: 1 }, { x: targetTurns + 0.5, y: 42.0, cluster: 1 },
      { x: targetTurns + 2, y: 12.0, cluster: 2 }, { x: targetTurns + 3, y: 8.0, cluster: 2 }, { x: targetTurns + 2.5, y: 10.0, cluster: 2 }
    ];

    // Jiggle time complexity slightly for dynamic feel
    current.complexity = {
      variables: [4, 8, 12, 16, 20],
      times: [
        1.8 + Math.random() * 0.35,
        1.8 + Math.random() * 0.35,
        1.8 + Math.random() * 0.35,
        1.9 + Math.random() * 0.35,
        1.8 + Math.random() * 0.35
      ]
    };

    this.data$.next(current);
  }
}

