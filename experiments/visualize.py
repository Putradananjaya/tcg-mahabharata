import pandas as pd
import matplotlib.pyplot as plt

def plot_tournament_results():
    df = pd.read_csv('hasil_turnamen.csv')
    
    # Menyiapkan 3 kanvas grafik berdampingan
    fig, axes = plt.subplots(1, 3, figsize=(15, 6))
    fig.suptitle('Turnamen 3 Faksi: Uji Keseimbangan Triangular', fontsize=16, fontweight='bold', y=1.05)

    matchups = df['Matchup'].unique()
    # Kodifikasi warna faksi
    colors = {'PANDAWA': '#1f77b4', 'KURAWA': '#d62728', 'RAJASIKA': '#ff7f0e'}

    for i, match in enumerate(matchups):
        subset = df[df['Matchup'] == match]
        win_counts = subset['Winner'].value_counts()
        
        # Memastikan kedua faksi tetap tampil di X-axis meskipun 0 kemenangan
        factions = match.split(' vs ')
        for f in factions:
            if f not in win_counts:
                win_counts[f] = 0
                
        # Mengurutkan urutan batang agar konsisten
        win_counts = win_counts[factions]
        
        ax = axes[i]
        bars = ax.bar(win_counts.index, win_counts.values, color=[colors[x] for x in win_counts.index])
        ax.set_title(match, fontsize=12, pad=15)
        ax.set_ylim(0, 100)
        ax.set_ylabel('Jumlah Kemenangan')
        
        # Label angka di atas batang
        for bar in bars:
            height = bar.get_height()
            ax.text(bar.get_x() + bar.get_width()/2., height + 2,
                    f'{int(height)}', ha='center', va='bottom', fontweight='bold')

    plt.tight_layout()
    plt.savefig('turnamen_3_faksi.png', bbox_inches='tight')
    print("Grafik berhasil disimpan sebagai 'turnamen_3_faksi.png'")
    # plt.show()  # Dinonaktifkan agar tidak menghambat terminal (hang)

if __name__ == "__main__":
    plot_tournament_results()