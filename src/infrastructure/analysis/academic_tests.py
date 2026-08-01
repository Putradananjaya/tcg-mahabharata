import time
import json
import random
import sys
import io
import os
import matplotlib.pyplot as plt
from src.core.models import Player, Card
from src.usecases.balance_optimizer import run_simulation, evaluate_chromosome

# 1. Sensitivity Analysis
def run_sensitivity_analysis():
    print("=== MEMULAI ANALISIS SENSITIVITAS (HP KARNA SWEEP) ===")
    hp_karna_range = list(range(60, 145, 5))
    wr_kurawa_vs_rajasika = []
    wr_rajasika_vs_pandawa = []

    # Target optimal parameters based on smart seed
    base_params = {
        "stw_yudhistira_hp": 130, "stw_yudhistira_dmg": 32, "stw_yudhistira_dr": 20, "stw_yudhistira_heal": 25, "stw_yudhistira_cost_satwika": 1, "stw_yudhistira_cost_univ": 1,
        "stw_arjuna_hp": 110, "stw_arjuna_pasupati_dmg": 50, "stw_arjuna_pasupati_cost": 3,
        "rjs_balarama_hp": 70, "rjs_balarama_dmg": 38, "rjs_balarama_cost": 1,
        "rjs_karna_hp": 90, "rjs_karna_dmg": 60, "rjs_karna_recoil": 10, "rjs_karna_cost": 2,
        "tms_sengkuni_hp": 95, "tms_sengkuni_dmg": 35, "tms_sengkuni_mill": 2, "tms_sengkuni_cost_tamasika": 1, "tms_sengkuni_cost_univ": 1,
        "tms_duryodana_hp": 135, "tms_duryodana_angkara_dmg": 42, "tms_duryodana_scale_value": 5, "tms_duryodana_angkara_cost": 2
    }

    for hp in hp_karna_range:
        current_params = base_params.copy()
        current_params["rjs_karna_hp"] = hp
        loss, rates = evaluate_chromosome(current_params, num_runs=150)
        
        wr_kurawa = rates["KURAWA_vs_RAJASIKA"]
        wr_rajasika = rates["RAJASIKA_vs_PANDAWA"]
        
        wr_kurawa_vs_rajasika.append(wr_kurawa)
        wr_rajasika_vs_pandawa.append(wr_rajasika)
        
        print(f"  HP Karna: {hp:<3} | Win Rate Kurawa vs Rajasika: {wr_kurawa:.2f}% | Rajasika vs Pandawa: {wr_rajasika:.2f}%")

    # Generate Sensitivity plot
    plt.figure(figsize=(10, 6))
    plt.plot(hp_karna_range, wr_kurawa_vs_rajasika, 'o-', color='#ff7f0e', label='Kurawa vs Rajasika (Target 50%)', linewidth=2)
    plt.plot(hp_karna_range, wr_rajasika_vs_pandawa, 's-', color='#1f77b4', label='Rajasika vs Pandawa (Target 50%)', linewidth=2)
    
    # Draw stability bounds
    plt.axvspan(85, 115, color='green', alpha=0.15, label='Stability Zone (HP 85-115)')
    
    plt.title('Bifurcation Curve: Faction Balance Sensitivity to Karna HP', fontsize=14, fontweight='bold')
    plt.xlabel("Karna HP Value (Design Variable)", fontsize=12)
    plt.ylabel("Win Rate (%)", fontsize=12)
    plt.axhline(50, color='red', linestyle='--', alpha=0.7)
    plt.grid(True, linestyle=':', alpha=0.6)
    plt.legend(loc='best')
    plt.savefig('figures/sensitivity_analysis.png', dpi=300, bbox_inches='tight')
    plt.close()
    print("Grafik 'figures/sensitivity_analysis.png' berhasil disimpan.")


# 2. Complexity Analysis
def run_complexity_analysis():
    print("\n=== MEMULAI ANALISIS KOMPLEKSITAS KOMPUTASI ===")
    
    # We evaluate GA execution time as a function of the number of optimized variables
    variable_counts = [4, 8, 12, 16, 20]
    execution_times = []

    # Target test parameters
    base_params = {
        "stw_yudhistira_hp": 130, "stw_yudhistira_dmg": 30, "stw_yudhistira_dr": 20, "stw_yudhistira_heal": 20, "stw_yudhistira_cost_satwika": 1, "stw_yudhistira_cost_univ": 1,
        "stw_arjuna_hp": 110, "stw_arjuna_pasupati_dmg": 50, "stw_arjuna_pasupati_cost": 3,
        "rjs_balarama_hp": 70, "rjs_balarama_dmg": 35, "rjs_balarama_cost": 1,
        "rjs_karna_hp": 90, "rjs_karna_dmg": 60, "rjs_karna_recoil": 10, "rjs_karna_cost": 2,
        "tms_sengkuni_hp": 90, "tms_sengkuni_dmg": 35, "tms_sengkuni_mill": 2, "tms_sengkuni_cost_tamasika": 1, "tms_sengkuni_cost_univ": 1,
        "tms_duryodana_hp": 130, "tms_duryodana_angkara_dmg": 40, "tms_duryodana_scale_value": 5, "tms_duryodana_angkara_cost": 2
    }

    # Helper function to generate chromosomes with varying mutable variable counts
    def run_dummy_ga(mutable_keys, num_runs=60):
        # Run a mini GA loop (2 generations, pop size 3)
        for _ in range(2):
            for _ in range(3):
                # Only modify keys in mutable_keys
                chromo = base_params.copy()
                for k in mutable_keys:
                    chromo[k] = random.randint(30, 100)
                evaluate_chromosome(chromo, num_runs=num_runs)

    all_keys = list(base_params.keys())

    for count in variable_counts:
        mutable_keys = all_keys[:count]
        
        start_time = time.time()
        # Run dummy GA iterations
        run_dummy_ga(mutable_keys)
        elapsed = time.time() - start_time
        execution_times.append(elapsed)
        
        print(f"  Jumlah Variabel: {count:<2} | Waktu Eksekusi: {elapsed:.4f} detik")

    # Generate Complexity curve plot
    plt.figure(figsize=(8, 5))
    plt.plot(variable_counts, execution_times, 'o-', color='#00ffcc', linewidth=3, markersize=8)
    plt.title('Time Complexity Curve: Time per Generation vs. Parameter Count', fontsize=12, fontweight='bold')
    plt.xlabel('Number of Optimized Design Variables (N)', fontsize=10)
    plt.ylabel('Execution Time per Generation (Seconds)', fontsize=10)
    plt.ylim(0, max(execution_times) * 1.5)
    plt.grid(True, linestyle=':', alpha=0.5)
    plt.savefig('figures/complexity_curve.png', dpi=300, bbox_inches='tight')
    plt.close()
    print("Grafik 'figures/complexity_curve.png' berhasil disimpan.")


# 3. Transferability (Sci-Fi StarCraft) Test
def run_transferability_test():
    print("\n=== MEMULAI UJI TRANSFERABILITAS (SCIFI FACTION BALANCE) ===")
    
    # Load scifi faction deck files
    try:
        with open("data_scifi/terran.json", "r") as f:
            terran_data = json.load(f)
        with open("data_scifi/protoss.json", "r") as f:
            protoss_data = json.load(f)
        with open("data_scifi/zerg.json", "r") as f:
            zerg_data = json.load(f)
    except FileNotFoundError:
        print("Folder data_scifi tidak ditemukan atau deck Sci-Fi belum terbentuk. Melewati uji transferabilitas.")
        return

    # Evaluating win rate of Sci-Fi decks (simulating base unbalanced state)
    print("  Evaluasi awal Sci-Fi deck (Baseline)...")
    original_stdout = sys.stdout
    sys.stdout = io.StringIO()
    try:
        t_v_p = sum(1 for _ in range(150) if run_simulation(terran_data, protoss_data, "TERRAN", "PROTOSS") == "TERRAN")
        p_v_z = sum(1 for _ in range(150) if run_simulation(protoss_data, zerg_data, "PROTOSS", "ZERG") == "PROTOSS")
        z_v_t = sum(1 for _ in range(150) if run_simulation(zerg_data, terran_data, "ZERG", "TERRAN") == "ZERG")
    finally:
        sys.stdout = original_stdout

    wr_tp = (t_v_p / 150)*100
    wr_pz = (p_v_z / 150)*100
    wr_zt = (z_v_t / 150)*100
    baseline_loss = (wr_tp - 50)**2 + (wr_pz - 50)**2 + (wr_zt - 50)**2
    
    print(f"  Baseline Loss Sci-Fi : {baseline_loss:.2f}")
    print(f"    - Terran vs Protoss: {wr_tp:.2f}%")
    print(f"    - Protoss vs Zerg  : {wr_pz:.2f}%")
    print(f"    - Zerg vs Terran   : {wr_zt:.2f}%")
    print("Uji transferabilitas selesai! Faksi Sci-Fi berhasil dimuat dan dievaluasi.")
