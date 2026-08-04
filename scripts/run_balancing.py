import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.optim.ga import run_ga_balancing
from src.optim.pso import run_pso_balancing

def main():
    print("=== MAHAYUDHA TCG BALANCING ENGINE ===")
    print("Pilih Algoritma Optimasi:")
    print("  1. Genetic Algorithm (GA)")
    print("  2. Particle Swarm Optimization (PSO)")
    
    # If a choice is passed via argv, use it; otherwise default to PSO (faster)
    choice = "2"
    if len(sys.argv) > 1:
        choice = sys.argv[1]
        
    if choice == "1":
        run_ga_balancing(pop_size=6, generations=10, num_runs=100)
    else:
        run_pso_balancing(pop_size=6, iterations=10, num_runs=100)

if __name__ == "__main__":
    main()
