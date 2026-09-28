import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

// Inject implementations into abstract tokens for Clean Architecture
import { BattleSimulatorService } from './core/usecases/battle-simulator.service';
import { BattleSimulatorImpl } from './data/repositories/battle-simulator.impl';
import { SandboxService } from './core/usecases/sandbox.service';
import { SandboxImpl } from './data/repositories/sandbox.impl';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule
  ],
  providers: [
    { provide: BattleSimulatorService, useClass: BattleSimulatorImpl },
    { provide: SandboxService, useClass: SandboxImpl },
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
}
