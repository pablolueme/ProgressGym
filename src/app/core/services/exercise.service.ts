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
  updateDoc
} from '@angular/fire/firestore';
import { map, Observable, of, switchMap } from 'rxjs';
import { Exercise, ExerciseType } from '../models';
import { sanitizeArray, toDate } from './firestore-mappers';
import { exercisesCollectionPath } from './user-data-paths';
import { AuthService } from './auth.service';

export interface ExerciseInput {
  name: string;
  muscleGroup: string;
  secondaryMuscles?: string[];
  type: ExerciseType;
  description?: string;
  technique?: string;
  tips?: string;
  commonMistakes?: string;
  personalNotes?: string;
}

@Injectable({ providedIn: 'root' })
export class ExerciseService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(Auth);
  private readonly authService = inject(AuthService);

  readonly exercises$ = this.authService.uid$.pipe(
    switchMap((uid) => {
      if (!uid) {
        return of([] as Exercise[]);
      }
      const exercisesQuery = query(
        collection(this.firestore, exercisesCollectionPath(uid)),
        orderBy('name', 'asc')
      );
      return collectionData(exercisesQuery, { idField: 'id' }).pipe(
        map((items) => items.map((item) => this.mapExercise(item)))
      );
    })
  );

  exerciseById$(exerciseId: string): Observable<Exercise | null> {
    return this.authService.uid$.pipe(
      switchMap((uid) => {
        if (!uid || !exerciseId) {
          return of(null);
        }
        return docData(doc(this.firestore, `${exercisesCollectionPath(uid)}/${exerciseId}`), {
          idField: 'id'
        }).pipe(map((item) => (item ? this.mapExercise(item as Record<string, unknown>) : null)));
      })
    );
  }

  async createExercise(input: ExerciseInput): Promise<Exercise> {
    const uid = this.requireUid();
    const payload = {
      userId: uid,
      name: input.name.trim(),
      muscleGroup: input.muscleGroup.trim(),
      secondaryMuscles: input.secondaryMuscles?.filter(Boolean) ?? [],
      type: input.type,
      description: input.description?.trim() || '',
      technique: input.technique?.trim() || '',
      tips: input.tips?.trim() || '',
      commonMistakes: input.commonMistakes?.trim() || '',
      personalNotes: input.personalNotes?.trim() || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    const reference = await addDoc(collection(this.firestore, exercisesCollectionPath(uid)), payload);
    return {
      id: reference.id,
      ...payload,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  async updateExercise(exerciseId: string, input: Partial<ExerciseInput>): Promise<void> {
    const uid = this.requireUid();
    await updateDoc(doc(this.firestore, `${exercisesCollectionPath(uid)}/${exerciseId}`), {
      ...input,
      updatedAt: serverTimestamp()
    });
  }

  async deleteExercise(exerciseId: string): Promise<void> {
    const uid = this.requireUid();
    await deleteDoc(doc(this.firestore, `${exercisesCollectionPath(uid)}/${exerciseId}`));
  }

  private mapExercise(raw: Record<string, unknown>): Exercise {
    return {
      id: String(raw['id']),
      userId: String(raw['userId'] ?? ''),
      name: String(raw['name'] ?? ''),
      muscleGroup: String(raw['muscleGroup'] ?? ''),
      secondaryMuscles: sanitizeArray<string>(raw['secondaryMuscles']),
      type: String(raw['type'] ?? 'Otro') as ExerciseType,
      description: String(raw['description'] ?? ''),
      technique: String(raw['technique'] ?? ''),
      tips: String(raw['tips'] ?? ''),
      commonMistakes: String(raw['commonMistakes'] ?? ''),
      personalNotes: String(raw['personalNotes'] ?? ''),
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
