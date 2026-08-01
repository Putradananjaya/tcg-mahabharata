import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.infrastructure.ml.rl_agent import run_rl_self_play

def main():
    print("=== RUNNING REINFORCEMENT LEARNING COMBAT STRATEGY ===")
    run_rl_self_play(num_train_games=1500, num_eval_games=250)

if __name__ == "__main__":
    main()
