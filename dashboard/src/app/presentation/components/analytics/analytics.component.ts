import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AnalyticsService } from '../../../core/usecases/analytics.service';
import { Chart, registerables } from 'chart.js';
import { Subscription } from 'rxjs';

Chart.register(...registerables);

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div style="display: flex; flex-direction: column; gap: 20px;">
      <!-- Controls Panel for Paper Export -->
      <div style="display: flex; justify-content: space-between; align-items: center; background: #ffffff; padding: 16px 20px; border-radius: 12px; border: 1px solid var(--border-color, #e0e0e0); box-shadow: 0 2px 6px rgba(0,0,0,0.03);">
        <div>
          <h2 style="margin: 0; font-size: 18px; font-weight: 700; color: #1a1a1a;">Visual Analytics (Publication Ready)</h2>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: #666;">All chart titles, axis labels, descriptions, and legend markers are formatted in English and styled for academic papers.</p>
        </div>
        <div style="display: flex; gap: 10px;">
          <button (click)="setColumns(1)" [style.background]="columns === 1 ? '#1e88e5' : '#f0f0f0'" [style.color]="columns === 1 ? '#fff' : '#333'" style="border: none; padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 13px; transition: all 0.2s;">
            1 Column (Large / Full Width)
          </button>
          <button (click)="setColumns(2)" [style.background]="columns === 2 ? '#1e88e5' : '#f0f0f0'" [style.color]="columns === 2 ? '#fff' : '#333'" style="border: none; padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 13px; transition: all 0.2s;">
            2 Columns (Grid Mode)
          </button>
        </div>
      </div>

      <!-- Grid Layout -->
      <div class="analytics-grid" [style.grid-template-columns]="columns === 1 ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))'" style="display: grid; gap: 32px;">
        <!-- Sensitivity Chart -->
        <div class="chart-card md-card" style="display: flex; flex-direction: column; gap: 12px; min-height: 500px; padding: 24px; background: #fff; border-radius: 12px; border: 1px solid var(--border-color, #e0e0e0);">
          <h3 style="margin: 0; font-size: 18px; font-weight: 700; color: #111;">Bifurcation Curve: Sensitivity Analysis</h3>
          <p class="chart-desc" style="font-size: 13.5px; color: #555; margin: 0; line-height: 1.4;">Displays all 3 faction win rate shifts (TAMASIKA, SATWIKA, RAJASIKA) as Karna's HP parameter is manipulated from 60 to 140.</p>
          <div class="canvas-container" style="height: 420px; position: relative; width: 100%; background: #fafafa; border-radius: 8px; padding: 16px; border: 1px solid #e5e5e5; box-sizing: border-box;">
            <canvas #sensitivityCanvas style="width: 100% !important; height: 100% !important;"></canvas>
          </div>
        </div>

        <!-- Time Complexity Chart -->
        <div class="chart-card md-card" style="display: flex; flex-direction: column; gap: 12px; min-height: 500px; padding: 24px; background: #fff; border-radius: 12px; border: 1px solid var(--border-color, #e0e0e0);">
          <h3 style="margin: 0; font-size: 18px; font-weight: 700; color: #111;">Time Complexity: GA Execution Time</h3>
          <p class="chart-desc" style="font-size: 13.5px; color: #555; margin: 0; line-height: 1.4;">Demonstrates constant O(1) execution time per generation relative to parameter size N.</p>
          <div class="canvas-container" style="height: 420px; position: relative; width: 100%; background: #fafafa; border-radius: 8px; padding: 16px; border: 1px solid #e5e5e5; box-sizing: border-box;">
            <canvas #complexityCanvas style="width: 100% !important; height: 100% !important;"></canvas>
          </div>
        </div>

        <!-- Power Spike Trend Chart -->
        <div class="chart-card md-card" style="display: flex; flex-direction: column; gap: 12px; min-height: 500px; padding: 24px; background: #fff; border-radius: 12px; border: 1px solid var(--border-color, #e0e0e0);">
          <h3 style="margin: 0; font-size: 18px; font-weight: 700; color: #111;">Power Spike Trend Curve</h3>
          <p class="chart-desc" style="font-size: 13.5px; color: #555; margin: 0; line-height: 1.4;">Illustrates asymmetric faction dominance over match turns (Early Rajasika, Mid Tamasika, Late Satwika).</p>
          <div class="canvas-container" style="height: 420px; position: relative; width: 100%; background: #fafafa; border-radius: 8px; padding: 16px; border: 1px solid #e5e5e5; box-sizing: border-box;">
            <canvas #powerSpikeCanvas style="width: 100% !important; height: 100% !important;"></canvas>
          </div>
        </div>

        <!-- Scatter Clustering Chart -->
        <div class="chart-card md-card" style="display: flex; flex-direction: column; gap: 12px; min-height: 500px; padding: 24px; background: #fff; border-radius: 12px; border: 1px solid var(--border-color, #e0e0e0);">
          <h3 style="margin: 0; font-size: 18px; font-weight: 700; color: #111;">K-Means Emergent Playstyle Clusters</h3>
          <p class="chart-desc" style="font-size: 13.5px; color: #555; margin: 0; line-height: 1.4;">Automated battle archetype classification (Aggro, Midrange, Control) based on match duration & remaining HP.</p>
          <div class="canvas-container" style="height: 420px; position: relative; width: 100%; background: #fafafa; border-radius: 8px; padding: 16px; border: 1px solid #e5e5e5; box-sizing: border-box;">
            <canvas #clusteringCanvas style="width: 100% !important; height: 100% !important;"></canvas>
          </div>
        </div>
      </div>
    </div>
  `
})
export class AnalyticsComponent implements AfterViewInit, OnDestroy {
  @ViewChild('sensitivityCanvas') private sensitivityCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('complexityCanvas') private complexityCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('powerSpikeCanvas') private powerSpikeCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('clusteringCanvas') private clusteringCanvas!: ElementRef<HTMLCanvasElement>;

  public columns: number = 1;
  private charts: Chart[] = [];
  private sub!: Subscription;

  constructor(private analytics: AnalyticsService) {}

  setColumns(cols: number) {
    this.columns = cols;
    setTimeout(() => {
      this.charts.forEach(c => c.resize());
    }, 50);
  }

  ngAfterViewInit(): void {
    this.sub = this.analytics.getAnalyticsData().subscribe((data: any) => {
      this.destroyCharts();
      this.initSensitivityChart(data.sensitivity);
      this.initComplexityChart(data.complexity);
      this.initPowerSpikeChart(data.powerSpike);
      this.initClusteringChart(data.clustering);
    });
  }

  ngOnDestroy(): void {
    if (this.sub) this.sub.unsubscribe();
    this.destroyCharts();
  }

  private destroyCharts() {
    this.charts.forEach(c => c.destroy());
    this.charts = [];
  }

  private initSensitivityChart(data: any) {
    const ctx = this.sensitivityCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const p1Label = `Win Rate ${data.p1Name || 'SATWIKA'}`;
    const p2Label = `Win Rate ${data.p2Name || 'TAMASIKA'}`;
    const p3Label = `Win Rate ${data.p3Name || 'RAJASIKA'}`;

    const datasets: any[] = [
      {
        label: p2Label,
        data: data.wrTamasika,
        borderColor: '#f4511e',
        backgroundColor: 'rgba(244, 81, 30, 0.05)',
        borderWidth: 3,
        pointRadius: 6,
        pointStyle: 'circle',
        tension: 0.3,
        fill: true
      },
      {
        label: p1Label,
        data: data.wrSatwika,
        borderColor: '#1e88e5',
        backgroundColor: 'rgba(30, 136, 229, 0.05)',
        borderWidth: 3,
        pointRadius: 6,
        pointStyle: 'circle',
        tension: 0.3,
        fill: true
      }
    ];

    if (data.wrRajasika) {
      datasets.push({
        label: p3Label,
        data: data.wrRajasika,
        borderColor: '#d81b60',
        backgroundColor: 'rgba(216, 27, 96, 0.05)',
        borderWidth: 3,
        pointRadius: 6,
        pointStyle: 'circle',
        tension: 0.3,
        fill: true
      });
    }

    this.charts.push(new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.hpValues,
        datasets
      },
      options: this.getChartOptions(`Karna HP (${data.p2Name || 'TAMASIKA'})`, 'Win Rate (%)', {
        y: { min: 0, max: 100 }
      })
    }));
  }


  private initComplexityChart(data: any) {
    const ctx = this.complexityCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    this.charts.push(new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.variables,
        datasets: [{
          label: 'GA Execution Time (s)',
          data: data.times,
          borderColor: '#3f51b5',
          backgroundColor: 'rgba(63, 81, 181, 0.05)',
          borderWidth: 3,
          pointRadius: 7,
          pointStyle: 'circle',
          pointBackgroundColor: '#3f51b5'
        }]
      },
      options: this.getChartOptions('Number of Optimization Variables (N)', 'Execution Time for 5 Generations (s)', {
        y: { min: 0, max: 4 }
      })
    }));
  }

  private initPowerSpikeChart(data: any) {
    const ctx = this.powerSpikeCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    this.charts.push(new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.turns,
        datasets: [
          {
            label: 'Satwika (Late-game)',
            data: data.satwika,
            borderColor: '#1e88e5',
            borderWidth: 3,
            pointRadius: 6,
            pointStyle: 'circle',
            tension: 0.2
          },
          {
            label: 'Tamasika (Mid-game)',
            data: data.tamasika,
            borderColor: '#d81b60',
            borderWidth: 3,
            pointRadius: 6,
            pointStyle: 'circle',
            tension: 0.2
          },
          {
            label: 'Rajasika (Early-game)',
            data: data.rajasika,
            borderColor: '#f4511e',
            borderWidth: 3,
            pointRadius: 6,
            pointStyle: 'circle',
            tension: 0.2
          }
        ]
      },
      options: this.getChartOptions('Turn Number', 'Remaining Sasmita (Prize Cards, 0-3)', {
        y: { min: 0, max: 3.5 }
      })
    }));
  }

  private initClusteringChart(data: any[]) {
    const ctx = this.clusteringCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const colors = ['#f4511e', '#3f51b5', '#009688'];
    const names = ['Aggro Cluster', 'Midrange Cluster', 'Attrition / Control Cluster'];
    const datasets = [0, 1, 2].map(cId => ({
      label: names[cId],
      data: data.filter(pt => pt.cluster === cId).map(pt => ({ x: pt.x, y: pt.y })),
      backgroundColor: colors[cId],
      pointRadius: 8,
      pointHoverRadius: 11,
      pointStyle: 'circle'
    }));

    this.charts.push(new Chart(ctx, {
      type: 'scatter',
      data: { datasets },
      options: this.getChartOptions('Total Match Turns', 'Winner Remaining HP', {
        y: { min: 0, max: 120 }
      })
    }));
  }

  private getChartOptions(xTitle: string, yTitle: string, extraScales: any = {}): any {
    const createScaleOption = (title: string, isX: boolean) => ({
      border: {
        display: true,
        color: '#000000',
        width: 2
      },
      title: {
        display: true,
        text: title,
        color: '#000000',
        padding: isX ? { top: 10, bottom: 2 } : { top: 0, bottom: 10 },
        font: { family: 'Outfit, sans-serif', size: 15, weight: 'bold' }
      },
      ticks: {
        color: '#000000',
        padding: 6,
        font: { family: 'Outfit, sans-serif', size: 13, weight: 'bold' }
      },
      grid: {
        color: 'rgba(0, 0, 0, 0.08)',
        tickColor: '#000000',
        tickLength: 6,
        tickWidth: 2
      }
    });

    const xConfig = { ...createScaleOption(xTitle, true), ...(extraScales.x || {}) };
    const yConfig = { ...createScaleOption(yTitle, false), ...(extraScales.y || {}) };

    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            usePointStyle: true,
            pointStyle: 'circle',
            color: '#000000',
            font: { family: 'Outfit, sans-serif', size: 14, weight: 'bold' },
            boxWidth: 10,
            padding: 16
          }
        }
      },
      scales: {
        x: xConfig,
        y: yConfig
      }
    };
  }
}



