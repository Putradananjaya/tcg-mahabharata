from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any

from src.core.models import Player
from src.usecases.battle_simulator import run_logged_simulation
from src.infrastructure.ml.rl_agent import QLearningAgent
from src.usecases.balance_optimizer import BOUNDS, evaluate_chromosome

app = FastAPI(title="Mahabharata TCG API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SimulationRequest(BaseModel):
    p1_faction: str
    p2_faction: str
    p1_deck: Dict[str, Any]
    p2_deck: Dict[str, Any]

class RecommendActionRequest(BaseModel):
    player_state: Dict[str, Any]
    opponent_state: Dict[str, Any]

@app.get("/")
def read_root():
    return {"message": "Welcome to Mahabharata TCG Engine API"}

@app.post("/api/simulate")
def run_simulation(req: SimulationRequest):
    # This is a stub for the actual simulation endpoint.
    # In a full implementation, this would translate the JSON decks back to Python objects
    # and run `battle_simulator.py` logic, returning the detailed combat log.
    return {"status": "success", "message": f"Simulating {req.p1_faction} vs {req.p2_faction}"}

@app.post("/api/rl/recommend")
def recommend_action(req: RecommendActionRequest):
    # Extract state vector
    hp_bucket = 2
    if req.player_state.get('activeCharacter'):
        hp = req.player_state['activeCharacter']['currentHp']
        if hp <= 35: hp_bucket = 0
        elif hp <= 80: hp_bucket = 1
        
    prana_total = sum(req.player_state.get('prana', {}).values())
    prana_bucket = 0 if prana_total < 2 else 1
    
    bench_wounded = 0
    for b in req.player_state.get('bench', []):
        if b['currentHp'] < b['maxHp']:
            bench_wounded = 1
            break
            
    state = (hp_bucket, prana_bucket, bench_wounded)
    
    # Dummy Q-values for illustration (in a real scenario, we'd load the trained DQN/Q-Table)
    # 0: Attack, 1: Heal, 2: Switch
    q_values = [0.8, 0.1, -0.5] if hp_bucket > 0 else [0.2, 0.9, 0.5]
    
    action = 0 if q_values[0] > q_values[1] else 1
    action_str = "Serang Target Aktif" if action == 0 else "Gunakan Skill Healing (Sabda Rahayu)"
    win_prob = max(q_values) * 100
    
    return {
        "recommended_action": action_str,
        "win_probability": round(win_prob, 2),
        "q_values": q_values
    }

@app.post("/api/optimize/ga")
def run_ga_optimization():
    # Stub for triggering GA optimization.
    # Would stream back generational progress in a real implementation.
    return {"status": "started", "message": "GA Optimization started"}
