import { inject, Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import {
  addDoc,
  collection,
  collectionData,
  deleteDoc,
  doc,
  docData,
  Firestore,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where
} from '@angular/fire/firestore';
import { map, Observable, of, switchMap } from 'rxjs';
import { Routine, RoutineExercise } from '../models';
import { sanitizeArray, toDate } from './firestore-mappers';
import { routinesCollectionPath } from './user-data-paths';
import { AuthService } from './auth.service';

export interface RoutineInput {
  folderId: string;
  name: string;
  description?: string;
  day?: string;
  notes?: string;
}

@Injectable({ providedIn: 'root' })
export class RoutineService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(Auth);
  private readonly authService = inject(AuthService);

  readonly routines$ = this.authService.uid$.pipe(
    switchMap((uid) => {
      if (!uid) {
        return of([] as Routine[]);
      }
      const routinesQuery = query(
        collection(this.firestore, routinesCollectionPath(uid)),
        orderBy('updatedAt', 'desc')
      );
      return collectionData(routinesQuery, { idField: 'id' }).pipe(
        map((items) => items.map((item) => this.mapRoutine(item)))
      );
    })
  );

  routinesByFolder$(folderId: string): Observable<Routine[]> {
    return this.authService.uid$.pipe(
      switchMap((uid) => {
        if (!uid || !folderId) {
          return of([] as Routine[]);
        }
        const routinesQuery = query(
          collection(this.firestore, routinesCollectionPath(uid)),
          where('folderId', '==', folderId),
          orderBy('updatedAt', 'desc')
        );
        return collectionData(routinesQuery, { idField: 'id' }).pipe(
          map((items) => items.map((item) => this.mapRoutine(item)))
        );
      })
    );
  }

  routineById$(routineId: string): Observable<Routine | null> {
    return this.authService.uid$.pipe(
      switchMap((uid) => {
        if (!uid || !routineId) {
          return of(null);
        }
        return docData(doc(this.firestore, `${routinesCollectionPath(uid)}/${routineId}`), {
          idField: 'id'
        }).pipe(map((item) => (item ? this.mapRoutine(item as Record<string, unknown>) : null)));
      })
    );
  }

  async createRoutine(input: RoutineInput): Promise<string> {
    const uid = this.requireUid();
    const reference = await addDoc(collection(this.firestore, routinesCollectionPath(uid)), {
      userId: uid,
      folderId: input.folderId,
      name: input.name.trim(),
      description: input.description?.trim() || '',
      day: input.day?.trim() || '',
      notes: input.notes?.trim() || '',
      exercises: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return reference.id;
  }

  async updateRoutine(routineId: string, input: Partial<RoutineInput>): Promise<void> {
    const uid = this.requireUid();
    await updateDoc(doc(this.firestore, `${routinesCollectionPath(uid)}/${routineId}`), {
      ...input,
      updatedAt: serverTimestamp()
    });
  }

  async saveRoutineExercises(routineId: string, exercises: RoutineExercise[]): Promise<void> {
    const uid = this.requireUid();
    const orderedExercises = [...exercises].sort((a, b) => a.order - b.order);
    await updateDoc(doc(this.firestore, `${routinesCollectionPath(uid)}/${routineId}`), {
      exercises: orderedExercises,
      updatedAt: serverTimestamp()
    });
  }

  async deleteRoutine(routineId: string): Promise<void> {
    const uid = this.requireUid();
    await deleteDoc(doc(this.firestore, `${routinesCollectionPath(uid)}/${routineId}`));
  }

  private mapRoutine(raw: Record<string, unknown>): Routine {
    const exercises = sanitizeArray<Record<string, unknown>>(raw['exercises']).map((item, index) => ({
      exerciseId: String(item['exerciseId'] ?? ''),
      exerciseName: String(item['exerciseName'] ?? ''),
      sets: Number(item['sets'] ?? 0),
      reps: String(item['reps'] ?? ''),
      restSeconds: Number(item['restSeconds'] ?? 0) || undefined,
      notes: String(item['notes'] ?? ''),
      order: Number(item['order'] ?? index)
    }));

    return {
      id: String(raw['id']),
      userId: String(raw['userId'] ?? ''),
      folderId: String(raw['folderId'] ?? ''),
      name: String(raw['name'] ?? ''),
      description: String(raw['description'] ?? ''),
      day: String(raw['day'] ?? ''),
      notes: String(raw['notes'] ?? ''),
      exercises,
      createdAt: toDate(raw['createdAt']),
      updatedAt: toDate(raw['updatedAt'])
    };
  }

  private requireUid(): string {
    const uid = this.auth.currentUser?.uid;
    if (!uid) {
      throw new Error('No hay una sesion activa.');
    }
    return uid;
  }
}
