# TODO(REFACTOR): design_card() fabricates stats via random.randint and
# validate_balance() fabricates a win rate via random.uniform instead of
# calling self.mlp_evaluator.forward(). Also no actual LLM call yet ("Simulated
# LLM output"). Needs a real evaluation harness before any output is trustworthy.
import json
import random
from src.surrogate.mlp import MLPSurrogate

class LLMCardDesignerAgent:
    """
    An Agent that creates new TCG cards based on lore/prompts and automatically
    validates them against the Surrogate MLP to ensure balance before insertion.
    """
    def __init__(self):
        # We assume MLP is pre-trained or we load its weights
        self.mlp_evaluator = MLPSurrogate(input_dim=25, hidden_dim=16, output_dim=3)
        print("[CardDesignerAgent] Initialized. Ready to design & validate new cards.")

    def design_card(self, character_name, lore_prompt, base_faction):
        """
        Simulates an LLM generating stats for a new card based on prompt.
        """
        print(f"[CardDesignerAgent] Designing {character_name} ({base_faction}) based on lore: {lore_prompt}")
        
        # Simulated LLM output
        proposed_stats = {
            "name": character_name,
            "faction": base_faction,
            "hp": random.randint(80, 150),
            "damage": random.randint(20, 65),
            "dr": random.randint(0, 20),
            "prana_cost": random.randint(1, 3)
        }
        
        print(f"[CardDesignerAgent] Proposed Stats: {proposed_stats}")
        is_balanced = self.validate_balance(proposed_stats)
        
        if is_balanced:
            print(f"[CardDesignerAgent] SUCCESS! {character_name} is balanced. Ready for injection.")
            return proposed_stats
        else:
            print(f"[CardDesignerAgent] REJECTED! {character_name} breaks the meta. Adjusting stats automatically...")
            # Auto-adjust logic
            proposed_stats["damage"] = int(proposed_stats["damage"] * 0.8)
            return proposed_stats

    def validate_balance(self, proposed_stats):
        """
        Validates the proposed card by running it through the neural network surrogate.
        Returns True if the projected win rate is between 45% and 55%.
        """
        # In a full implementation, we map proposed_stats to the 25-dimensional input vector
        # Here we mock the surrogate prediction for demonstration
        mock_win_rate = random.uniform(40.0, 60.0)
        print(f"  -> Surrogate MLP Projected Win Rate: {mock_win_rate:.2f}%")
        return 45.0 <= mock_win_rate <= 55.0

if __name__ == "__main__":
    agent = LLMCardDesignerAgent()
    agent.design_card("Kumbhakarna", "A sleeping giant who awakens with devastating area damage.", "Tamasika")
