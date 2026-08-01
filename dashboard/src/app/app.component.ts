import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

// Inject implementations into abstract tokens for Clean Architecture
import { BattleSimulatorService } from './core/usecases/battle-simulator.service';
import { BattleSimulatorImpl } from './data/repositories/battle-simulator.impl';
import { BalanceOptimizerService } from './core/usecases/balance-optimizer.service';
import { BalanceOptimizerImpl } from './data/repositories/balance-optimizer.impl';
import { AnalyticsService } from './core/usecases/analytics.service';
import { AnalyticsImpl } from './data/repositories/analytics.impl';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule
  ],
  providers: [
    { provide: BattleSimulatorService, useClass: BattleSimulatorImpl },
    { provide: BalanceOptimizerService, useClass: BalanceOptimizerImpl },
    { provide: AnalyticsService, useClass: AnalyticsImpl }
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
}
