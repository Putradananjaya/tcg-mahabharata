import { Injectable } from '@angular/core';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  limit, 
  Firestore,
  serverTimestamp
} from 'firebase/firestore';
import { environment } from '../../../environments/environment';
import { ParamUpdate } from '../usecases/balance-optimizer.service';
import { Card } from '../domain/card.model';

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  private db: Firestore;

  constructor() {
    const app = getApps().length === 0 
      ? initializeApp(environment.firebaseConfig) 
      : getApp();
    this.db = getFirestore(app);
  }

  /**
   * Save optimizer/manual parameter state into Firestore 'parameter_history' collection
   */
  async saveParameterState(params: ParamUpdate, loss: number, source: string): Promise<void> {
    try {
      const colRef = collection(this.db, 'parameter_history');
      await addDoc(colRef, {
        params,
        loss,
        source,
        timestamp: serverTimestamp()
      });
      console.log(`[FirebaseService] Parameter state saved successfully from source: ${source}`);
    } catch (err) {
      console.error('[FirebaseService] Error saving parameter state:', err);
    }
  }

  /**
   * Fetch parameter history ordered by latest timestamp
   */
  async getParameterHistory(limitCount: number = 30): Promise<any[]> {
    try {
      const colRef = collection(this.db, 'parameter_history');
      const q = query(colRef, orderBy('timestamp', 'desc'), limit(limitCount));
      const snapshot = await getDocs(q);
      
      const history: any[] = [];
      snapshot.forEach(docSnapshot => {
        const data = docSnapshot.data();
        history.push({
          id: docSnapshot.id,
          params: data['params'],
          loss: data['loss'],
          source: data['source'],
          timestamp: data['timestamp']?.toDate() || new Date()
        });
      });
      return history;
    } catch (err) {
      console.error('[FirebaseService] Error fetching parameter history:', err);
      return [];
    }
  }

  /**
   * Save newly created custom card/character into Firestore 'custom_cards' collection
   */
  async saveCustomCard(faction: 'PANDAWA' | 'KURAWA', card: Card): Promise<void> {
    try {
      const colRef = collection(this.db, 'custom_cards');
      await addDoc(colRef, {
        faction,
        card,
        timestamp: serverTimestamp()
      });
      console.log(`[FirebaseService] Custom card '${card.name}' saved to database.`);
    } catch (err) {
      console.error('[FirebaseService] Error saving custom card:', err);
    }
  }

  /**
   * Fetch all custom cards injected
   */
  async getCustomCards(): Promise<any[]> {
    try {
      const colRef = collection(this.db, 'custom_cards');
      const q = query(colRef, orderBy('timestamp', 'asc'));
      const snapshot = await getDocs(q);
      
      const cards: any[] = [];
      snapshot.forEach(docSnapshot => {
        const data = docSnapshot.data();
        cards.push({
          id: docSnapshot.id,
          faction: data['faction'],
          card: data['card']
        });
      });
      return cards;
    } catch (err) {
      console.error('[FirebaseService] Error fetching custom cards:', err);
      return [];
    }
  }
}
