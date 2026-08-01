import { Routes } from '@angular/router';
import { GuideComponent } from './presentation/components/guide/guide.component';
import { SimulatorComponent } from './presentation/components/simulator/simulator.component';
import { OptimizerComponent } from './presentation/components/optimizer/optimizer.component';
import { AnalyticsComponent } from './presentation/components/analytics/analytics.component';
import { FlowComponent } from './presentation/components/flow/flow.component';

export const routes: Routes = [
  { path: '', redirectTo: 'guide', pathMatch: 'full' },
  { path: 'guide', component: GuideComponent },
  { path: 'simulator', component: SimulatorComponent },
  { path: 'balancer', component: OptimizerComponent, data: { viewMode: 'engine' } },
  { path: 'creator', component: OptimizerComponent, data: { viewMode: 'creator' } },
  { path: 'tuning', component: OptimizerComponent, data: { viewMode: 'sliders' } },
  { path: 'analytics', component: AnalyticsComponent },
  { path: 'flow', component: FlowComponent },
  { path: '**', redirectTo: 'guide' }
];
