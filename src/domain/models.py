import json
import random

class Card:
    def __init__(self, card_data):
        self.id = card_data.get("id")
        self.name = card_data.get("name")
        self.type = card_data.get("type")
        self.hp = card_data.get("hp", 0)
        self.current_hp = self.hp
        self.raw_data = card_data 
        
        # তামেন পাসিফ (Damage Reduction)
        self.damage_reduction = card_data.get("damage_reduction", 0)

    def __repr__(self):
        return f"[{self.type}] {self.name}"

class Player:
    def __init__(self, name):
        self.name = name
        self.deck = []
        self.hand = []
        self.active_character = None
        self.bench = []
        self.discard_pile = []
        
        self.prana_pool = {"Satwika": 0, "Tamasika": 0, "Rajasika": 0, "Universal": 0}
        self.sasmita = 3
        self.attack_log = []
        
    def load_deck_from_json(self, filepath, copies=20):
        with open(filepath, 'r') as file:
            data = json.load(file)
        for _ in range(copies):
            for card_data in data["cards"]:
                self.deck.append(Card(card_data))
        random.shuffle(self.deck)

    def draw_card(self, count=1):
        drawn_cards = []
        for _ in range(count):
            if len(self.deck) > 0:
                card = self.deck.pop(0)
                self.hand.append(card)
                drawn_cards.append(card)
            else:
                break
        return drawn_cards

    def setup_phase(self):
        self.draw_card(7)

    def play_basic_to_active(self):
        priority_leads = ["Yudhistira", "Patih Sengkuni", "Karna"]
        
        for card in self.hand:
            if card.type == "Tokoh" and card.raw_data.get("stage") == "Basic" and card.name in priority_leads:
                self.active_character = card
                self.hand.remove(card)
                return True
                
        for card in self.hand:
            if card.type == "Tokoh" and card.raw_data.get("stage") == "Basic":
                self.active_character = card
                self.hand.remove(card)
                return True
                
        return False

    def play_basic_to_bench(self):
        cards_to_bench = []
        for card in self.hand:
            if card.type == "Tokoh" and card.raw_data.get("stage") == "Basic":
                if len(self.bench) < 5:
                    cards_to_bench.append(card)
                    self.bench.append(card)
                    
        for card in cards_to_bench:
            self.hand.remove(card)

    def attach_prana(self):
        if not self.active_character:
            return
            
        target_prana = "Universal"
        attacks = self.active_character.raw_data.get("attacks", [])
        for attack in attacks:
            cost_dict = attack.get("prana_cost", {})
            found = False
            for element in cost_dict.keys():
                if element != "Universal":
                    target_prana = element
                    found = True
                    break
            if found:
                break
                    
        if target_prana not in self.prana_pool:
            self.prana_pool[target_prana] = 0
        self.prana_pool[target_prana] += 1

    def check_knockout(self, opponent):
        if opponent.active_character.current_hp <= 0:
            opponent.active_character = None
            self.sasmita -= 1
            
            if self.sasmita <= 0:
                return True 
            
            if len(opponent.bench) > 0:
                next_char = opponent.bench.pop(0)
                opponent.active_character = next_char
            else:
                return True 
        return False

    def trigger_attack_effect(self, attack_data, opponent):
        effect_name = attack_data.get("effect")
        value = attack_data.get("value", 0)
        if not effect_name: return 
            
        if effect_name == "mill_enemy_deck":
            for _ in range(value):
                if len(opponent.deck) > 0:
                    milled_card = opponent.deck.pop(0)
                    opponent.discard_pile.append(milled_card)
        elif effect_name == "heal_bench_card":
            if len(self.bench) > 0:
                target = random.choice(self.bench) 
                heal_amount = min(value, target.hp - target.current_hp)
                target.current_hp += heal_amount
        elif effect_name == "recoil_damage":
            self.active_character.current_hp -= value

    def can_afford(self, cost_dict):
        temp_pool = self.prana_pool.copy()
        
        for p_type, amount in cost_dict.items():
            if p_type == "Universal": continue
            if temp_pool.get(p_type, 0) >= amount:
                temp_pool[p_type] -= amount
            else:
                return False 
                
        universal_needed = cost_dict.get("Universal", 0)
        total_left = sum(temp_pool.values())
        return total_left >= universal_needed

    def pay_prana(self, cost_dict):
        for p_type, amount in cost_dict.items():
            if p_type != "Universal":
                if p_type not in self.prana_pool:
                    self.prana_pool[p_type] = 0
                self.prana_pool[p_type] -= amount
                
        universal_needed = cost_dict.get("Universal", 0)
        for _ in range(universal_needed):
            for p_type in self.prana_pool:
                if self.prana_pool[p_type] > 0:
                    self.prana_pool[p_type] -= 1
                    break

    def attack(self, opponent, forced_attack=None):
        """forced_attack: optional, an entry from self.active_character's own
        `attacks` list to use instead of the automatic best-damage/panic
        selection below. Lets an external decision-maker (src.agents, via
        src.simulator.agent_env) choose which attack to use, while every
        existing caller (unaffected, forced_attack defaults to None) keeps
        the original automatic behavior byte-for-byte. Returns False if
        forced_attack isn't affordable -- the caller is expected to only
        pass attacks that passed can_afford (e.g. from legal_actions())."""
        if not self.active_character: return False

        attacks = self.active_character.raw_data.get("attacks", [])
        if not attacks: return False

        if forced_attack is not None:
            if not self.can_afford(forced_attack.get("prana_cost", {})):
                return False
            chosen_attack = forced_attack
        else:
            sorted_attacks = sorted(attacks, key=lambda x: x.get("base_damage", 0), reverse=True)
            best_attack = sorted_attacks[0]
            best_cost_dict = best_attack.get("prana_cost", {})

            is_panic = self.active_character.current_hp <= (self.active_character.hp * 0.4)
            chosen_attack = None

            if self.can_afford(best_cost_dict):
                chosen_attack = best_attack
            elif is_panic:
                for atk in sorted_attacks:
                    if self.can_afford(atk.get("prana_cost", {})):
                        chosen_attack = atk
                        break
            else:
                return False

            if not chosen_attack:
                return False
        
        self.pay_prana(chosen_attack.get("prana_cost", {}))
        self.attack_log.append(chosen_attack.get("name"))

        base_damage = chosen_attack.get("base_damage", 0)
        bonus_damage = 0
        
        bench_scaling = chosen_attack.get("bench_scaling")
        if bench_scaling:
            calculated_bonus = min(len(self.bench) * 5, 15)
            bonus_damage += calculated_bonus
            
        if chosen_attack.get("effect") == "scaled_damage_per_discard_tamasika":
            scale_value = chosen_attack.get("scale_value", 0)
            bonus_damage += len(opponent.discard_pile) * scale_value
            
        total_raw_damage = base_damage + bonus_damage
        reduction = getattr(opponent.active_character, 'damage_reduction', 0)
        
        final_damage = max(0, total_raw_damage - reduction)
        
        if opponent.active_character:
            opponent.active_character.current_hp -= final_damage
            
            self.trigger_attack_effect(chosen_attack, opponent)
            
            is_game_over = self.check_knockout(opponent)
            if is_game_over: return "GAME_OVER"
            
            if self.active_character and self.active_character.current_hp <= 0:
                is_suicide_game_over = opponent.check_knockout(self)
                if is_suicide_game_over: return "GAME_OVER_SUICIDE"
                
        return False
