import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.infrastructure.analysis.academic_tests import (
    run_sensitivity_analysis, 
    run_complexity_analysis, 
    run_transferability_test
)

def main():
    print("=== RUNNING ACADEMIC SENSITIVITAS, KOMPLEKSITAS & TRANSFERABILITAS ===")
    run_sensitivity_analysis()
    run_complexity_analysis()
    run_transferability_test()

if __name__ == "__main__":
    main()
