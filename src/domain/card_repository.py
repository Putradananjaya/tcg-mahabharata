import json

# Extended Database of Characters and Mantras for Mahabharata TCG

class CardRepository:
    def __init__(self):
        self.cards = {
            "Gatotkaca": {
                "id": "STW-003",
                "name": "Gatotkaca",
                "type": "Tokoh",
                "stage": "Basic",
                "hp": 160,
                "retreat_cost": 3,
                "damage_reduction": 30,
                "attacks": [
                    {
                        "name": "Otot Kawat Tulang Besi",
                        "prana_cost": {"Satwika": 2, "Universal": 1},
                        "base_damage": 40,
                        "effect": "lifesteal"
                    }
                ]
            },
            "Bhishma Pitamaha": {
                "id": "NEU-001",
                "name": "Bhishma Pitamaha",
                "type": "Tokoh",
                "stage": "Basic",
                "hp": 200,
                "retreat_cost": 4,
                "damage_reduction": 50,
                "attacks": [
                    {
                        "name": "Sthanu Invincibility",
                        "prana_cost": {"Universal": 4},
                        "base_damage": 70
                    }
                ]
            },
            "Abimanyu": {
                "id": "STW-004",
                "name": "Abimanyu",
                "type": "Tokoh",
                "stage": "Basic",
                "hp": 95,
                "retreat_cost": 1,
                "attacks": [
                    {
                        "name": "Chakravyuha Break",
                        "prana_cost": {"Satwika": 1, "Universal": 1},
                        "base_damage": 65,
                        "effect": "recoil_damage",
                        "value": 15
                    }
                ]
            },
            "Drona": {
                "id": "TMS-003",
                "name": "Drona",
                "type": "Tokoh",
                "stage": "Basic",
                "hp": 120,
                "retreat_cost": 2,
                "attacks": [
                    {
                        "name": "Brahma Astra",
                        "prana_cost": {"Tamasika": 2, "Rajasika": 1},
                        "base_damage": 80,
                        "effect": "mill_enemy_deck",
                        "value": 3
                    }
                ]
            },
            "Kresna": {
                "id": "STW-005",
                "name": "Kresna",
                "type": "Tokoh",
                "stage": "Basic",
                "hp": 110,
                "retreat_cost": 1,
                "attacks": [
                    {
                        "name": "Wujud Vishvarupa",
                        "prana_cost": {"Satwika": 1},
                        "base_damage": 20,
                        "effect": "heal_bench_card",
                        "value": 40
                    }
                ]
            }
        }
        
    def get_card(self, name):
        return self.cards.get(name)

    def export_all(self):
        return list(self.cards.values())
