import sys
import io
import os
import math

from main import run_single_simulation

def run_stress_test(n=10000):
    matchups = [
        ("PANDAWA", "data/satwika.json", "KURAWA", "data/tamasika.json"),
        ("KURAWA", "data/tamasika.json", "RAJASIKA", "data/rajasika.json"),
        ("RAJASIKA", "data/rajasika.json", "PANDAWA", "data/satwika.json")
    ]
    
    # Save original stdout
    original_stdout = sys.stdout
    
    print(f"=== MEMULAI STRESS TEST RNG (N = {n} pertandingan per matchup) ===")
    print("Harap tunggu, proses ini akan mensimulasikan total 30.000 pertandingan...")
    
    results = {}
    
    for name1, json1, name2, json2 in matchups:
        matchup_key = f"{name1} vs {name2}"
        wins = {name1: 0, name2: 0}
        
        # Clean up CSV log to prevent it from growing too large (30k rows of CSV takes disk space and time)
        if os.path.exists("hasil_turnamen.csv"):
            os.remove("hasil_turnamen.csv")
            
        for i in range(n):
            if i % 2000 == 0 and i > 0:
                original_stdout.write(f"  [{matchup_key}] Selesai {i} pertandingan...\n")
                original_stdout.flush()
                
            # Mute stdout of the engine to speed up simulation and prevent terminal overflow
            sys.stdout = io.StringIO()
            try:
                winner = run_single_simulation(name1, json1, name2, json2)
                if winner in wins:
                    wins[winner] += 1
            finally:
                sys.stdout = original_stdout
                
        results[matchup_key] = wins
        
    print("\n=== HASIL STRESS TEST RNG (95% CONFIDENCE INTERVAL) ===")
    for matchup, wins in results.items():
        total = sum(wins.values())
        print(f"\n{matchup}:")
        for faction, count in wins.items():
            p = count / total
            se = math.sqrt((p * (1 - p)) / total)
            margin_of_error = 1.96 * se * 100
            percentage = p * 100
            
            ci_lower = max(0.0, percentage - margin_of_error)
            ci_upper = min(100.0, percentage + margin_of_error)
            
            print(f"  - {faction}: {count} menang ({percentage:.2f}%) [CI 95%: {ci_lower:.2f}% - {ci_upper:.2f}%]")

if __name__ == "__main__":
    run_stress_test(10000)
