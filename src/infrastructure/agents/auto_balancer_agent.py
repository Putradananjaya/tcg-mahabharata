import time
import random

class AutoBalancerAgent:
    """
    An autonomous agent that periodically checks win rates from the simulator
    and auto-generates patch notes if anomalies (overpowered/underpowered) are found.
    """
    def __init__(self):
        print("[AutoBalancerAgent] Started. Monitoring TCG meta balance...")

    def monitor_meta(self, match_results):
        """
        Analyzes a batch of match results to find anomalies.
        """
        print(f"[AutoBalancerAgent] Analyzing {len(match_results)} recent matches...")
        
        # Simulating anomaly detection
        anomalies = []
        if random.random() < 0.3:
            anomalies.append({
                "faction": "Rajasika",
                "card": "Karna",
                "issue": "Overpowered",
                "metric": "Win rate 68% against Satwika (Expected 50%)",
                "suggestion": "Increase recoil damage from 10 to 15 or reduce base HP by 5."
            })
            
        if anomalies:
            self.generate_patch_notes(anomalies)
        else:
            print("[AutoBalancerAgent] Meta is healthy. No anomalies detected.")

    def generate_patch_notes(self, anomalies):
        """
        Generates automated patch notes for the game developers.
        """
        print("\n" + "="*40)
        print("🚨 AUTO-GENERATED PATCH NOTES 🚨")
        print("="*40)
        for idx, anomaly in enumerate(anomalies):
            print(f"{idx+1}. Faction: {anomaly['faction']} | Card: {anomaly['card']}")
            print(f"   Status: {anomaly['issue']} ({anomaly['metric']})")
            print(f"   AI Suggestion: {anomaly['suggestion']}")
        print("="*40 + "\n")

if __name__ == "__main__":
    agent = AutoBalancerAgent()
    agent.monitor_meta([{"winner": "Rajasika"} for _ in range(100)])
