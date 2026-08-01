import os
import sys
import io
import random
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

from engine import Player, Card

def run_tracked_simulation(faksi_1_name, file_json_1, faksi_2_name, file_json_2, max_turns=40):
    p1 = Player(faksi_1_name)
    p2 = Player(faksi_2_name)
    
    p1.load_deck_from_json(file_json_1)
    p2.load_deck_from_json(file_json_2)
    
    p1.setup_phase()
    p2.setup_phase()
    p1.play_basic_to_active()
    p2.play_basic_to_active()
    p1.play_basic_to_bench()
    p2.play_basic_to_bench()
    
    players = [p1, p2]
    random.shuffle(players)
    first_player = players[0]
    second_player = players[1]
    
    turn = 1
    game_active = True
    winner = None
    
    sasmita_history_p1 = []
    sasmita_history_p2 = []
    
    while game_active and turn <= max_turns:
        # Turn action
        first_player.attach_prana()
        res1 = first_player.attack(opponent=second_player)
        if res1 in ["GAME_OVER", "GAME_OVER_SUICIDE"]:
            game_active = False
            winner = first_player.name if res1 == "GAME_OVER" else second_player.name
            
        if game_active:
            second_player.attach_prana()
            res2 = second_player.attack(opponent=first_player)
            if res2 in ["GAME_OVER", "GAME_OVER_SUICIDE"]:
                game_active = False
                winner = second_player.name if res2 == "GAME_OVER" else first_player.name
                
        # Record Sasmita state at the end of the turn
        sasmita_history_p1.append(p1.sasmita)
        sasmita_history_p2.append(p2.sasmita)
        
        if game_active:
            turn += 1
            
    # Pad history up to max_turns in case the game ended early
    final_p1_sasmita = p1.sasmita
    final_p2_sasmita = p2.sasmita
    while len(sasmita_history_p1) < max_turns:
        sasmita_history_p1.append(final_p1_sasmita)
        sasmita_history_p2.append(final_p2_sasmita)
        
    return winner, turn, sasmita_history_p1, sasmita_history_p2

def collect_data(n=1000, max_turns=30):
    matchups = [
        ("PANDAWA", "data/satwika.json", "KURAWA", "data/tamasika.json"),
        ("KURAWA", "data/tamasika.json", "RAJASIKA", "data/rajasika.json"),
        ("RAJASIKA", "data/rajasika.json", "PANDAWA", "data/satwika.json")
    ]
    
    duration_data = []
    sasmita_data = {} # Key: Matchup, Val: dict of faction -> list of histories
    
    original_stdout = sys.stdout
    sys.stdout = io.StringIO()
    
    try:
        for name1, json1, name2, json2 in matchups:
            matchup_key = f"{name1} vs {name2}"
            sasmita_data[matchup_key] = {name1: [], name2: []}
            
            for _ in range(n):
                winner, turn, hist1, hist2 = run_tracked_simulation(name1, json1, name2, json2, max_turns=max_turns)
                duration_data.append({
                    "Matchup": matchup_key,
                    "Winner": winner,
                    "Duration": turn
                })
                sasmita_data[matchup_key][name1].append(hist1)
                sasmita_data[matchup_key][name2].append(hist2)
    finally:
        sys.stdout = original_stdout
        
    df_duration = pd.DataFrame(duration_data)
    return df_duration, sasmita_data

def plot_duration_heatmap(df_dur):
    # Calculate summary stats for each matchup
    summary = df_dur.groupby("Matchup")["Duration"].agg(["min", "mean", "median", "max"]).round(2)
    
    # Custom colored matrix plotting
    fig, ax = plt.subplots(figsize=(10, 5))
    fig.patch.set_facecolor('#1e1e1e')
    ax.set_facecolor('#1e1e1e')
    
    # Data to display
    data_matrix = summary.values
    row_labels = summary.index.tolist()
    col_labels = ["Min Turn", "Rata-Rata Turn", "Median Turn", "Max Turn"]
    
    # Draw heatmap grid using ax.imshow
    im = ax.imshow(data_matrix, cmap="YlOrRd", aspect="auto", alpha=0.85)
    
    # Add text labels inside grid
    for i in range(len(row_labels)):
        for j in range(len(col_labels)):
            val = data_matrix[i, j]
            ax.text(j, i, f"{val}", ha="center", va="center", 
                    color="black" if val < 20 else "white", fontweight="bold", fontsize=12)
            
    # Set labels
    ax.set_xticks(np.arange(len(col_labels)))
    ax.set_yticks(np.arange(len(row_labels)))
    ax.set_xticklabels(col_labels, color='white', fontsize=11, fontweight='bold')
    ax.set_yticklabels(row_labels, color='white', fontsize=11, fontweight='bold')
    
    # Styling ticks and grid
    ax.tick_params(colors='white')
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_color('#444444')
    ax.spines['bottom'].set_color('#444444')
    
    plt.title("Heatmap Durasi Pertandingan (Turn Count sebelum Game Over)", 
              color='white', fontsize=14, fontweight='bold', pad=20)
    plt.colorbar(im, label="Durasi (Turn)", shrink=0.8).ax.yaxis.label.set_color('white')
    plt.tight_layout()
    plt.savefig("durasi_heatmap.png", facecolor=fig.get_facecolor(), edgecolor='none', bbox_inches='tight')
    print("Grafik durasi_heatmap.png berhasil disimpan.")
    plt.close()

def plot_power_spike_trend(sasmita_data, max_turns=30):
    fig, axes = plt.subplots(3, 1, figsize=(10, 15), sharex=True)
    fig.patch.set_facecolor('#1e1e1e')
    
    colors = {
        "PANDAWA": "#1f77b4",   # Blue
        "KURAWA": "#d62728",    # Red
        "RAJASIKA": "#ff7f0e"   # Orange
    }
    
    matchups = list(sasmita_data.keys())
    turns = np.arange(1, max_turns + 1)
    
    for idx, matchup in enumerate(matchups):
        ax = axes[idx]
        ax.set_facecolor('#1e1e1e')
        
        faction_data = sasmita_data[matchup]
        
        for faction, histories in faction_data.items():
            # Convert list of lists to numpy array for statistics
            arr = np.array(histories)
            avg_sasmita = np.mean(arr, axis=0)
            std_sasmita = np.std(arr, axis=0)
            
            # Line plot
            ax.plot(turns, avg_sasmita, label=f"Rata-Rata Sasmita {faction}", 
                    color=colors[faction], linewidth=2.5)
            # Fill between for standard deviation interval (shaded area)
            ax.fill_between(turns, 
                            np.clip(avg_sasmita - 0.2 * std_sasmita, 0, 3), 
                            np.clip(avg_sasmita + 0.2 * std_sasmita, 0, 3), 
                            color=colors[faction], alpha=0.15)
            
        ax.set_title(f"Tren Penurunan Sasmita: {matchup}", color='white', fontsize=12, fontweight='bold', pad=10)
        ax.set_ylabel("Rata-Rata Sasmita (Nyawa)", color='white', fontsize=10)
        ax.set_ylim(-0.1, 3.2)
        ax.tick_params(colors='white')
        ax.grid(True, color='#333333', linestyle='--', alpha=0.5)
        ax.legend(facecolor='#2d2d2d', edgecolor='#444444', labelcolor='white')
        
        # Style borders
        for spine in ax.spines.values():
            spine.set_color('#444444')
            
    axes[-1].set_xlabel("Turn (Giliran)", color='white', fontsize=11)
    plt.suptitle("Analisis Power Spike: Tren Sisa Sasmita per Turn", 
                 color='white', fontsize=16, fontweight='bold', y=0.96)
    plt.tight_layout(rect=[0, 0, 1, 0.95])
    plt.savefig("power_spike_trend.png", facecolor=fig.get_facecolor(), edgecolor='none', bbox_inches='tight')
    print("Grafik power_spike_trend.png berhasil disimpan.")
    plt.close()

if __name__ == "__main__":
    df_dur, sasmita_data = collect_data(1000, max_turns=30)
    plot_duration_heatmap(df_dur)
    plot_power_spike_trend(sasmita_data, max_turns=30)
