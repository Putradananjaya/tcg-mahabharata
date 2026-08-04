import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.optim.nsga2 import run_nsga2_balancing

def main():
    print("=== MAHAYUDHA TCG MULTI-OBJECTIVE BALANCING (NSGA-II) ===")
    run_nsga2_balancing(pop_size=10, generations=10, num_runs=80)

if __name__ == "__main__":
    main()
