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
  serverTimestamp
} from '@angular/fire/firestore';
import { map, Observable, of, switchMap } from 'rxjs';
import { Routine, Workout, WorkoutEntry } from '../models';
import { sanitizeArray, toDate } from './firestore-mappers';
import { workoutsCollectionPath } from './user-data-paths';
import { AuthService } from './auth.service';

export interface ExercisePerformance {
  lastWeight?: number;
  lastReps?: number;
  lastDate?: Date;
  bestWeight?: number;
}

@Injectable({ providedIn: 'root' })
export class WorkoutService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(Auth);
  private readonly authService = inject(AuthService);

  readonly workouts$ = this.authService.uid$.pipe(
    switchMap((uid) => {
      if (!uid) {
        return of([] as Workout[]);
      }
      const workoutsQuery = query(
        collection(this.firestore, workoutsCollectionPath(uid)),
        orderBy('date', 'desc')
      );
      return collectionData(workoutsQuery, { idField: 'id' }).pipe(
        map((items) => items.map((item) => this.mapWorkout(item)))
      );
    })
  );

  workoutById$(workoutId: string): Observable<Workout | null> {
    return this.authService.uid$.pipe(
      switchMap((uid) => {
        if (!uid || !workoutId) {
          return of(null);
        }
        return docData(doc(this.firestore, `${workoutsCollectionPath(uid)}/${workoutId}`), {
          idField: 'id'
        }).pipe(map((raw) => (raw ? this.mapWorkout(raw as Record<string, unknown>) : null)));
      })
    );
  }

  async createWorkoutFromRoutine(
    routine: Routine,
    entries: WorkoutEntry[],
    notes: string
  ): Promise<string> {
    const uid = this.requireUid();
    const totalVolume = entries.reduce((sum, entry) => {
      const entryVolume = entry.sets.reduce((entrySum, set) => entrySum + set.weight * set.reps, 0);
      return sum + entryVolume;
    }, 0);

    const reference = await addDoc(collection(this.firestore, workoutsCollectionPath(uid)), {
      userId: uid,
      routineId: routine.id,
      routineName: routine.name,
      folderId: routine.folderId,
      date: new Date(),
      entries,
      notes: notes.trim(),
      totalVolume,
      createdAt: serverTimestamp()
    });

    return reference.id;
  }

  async deleteWorkout(workoutId: string): Promise<void> {
    const uid = this.requireUid();
    await deleteDoc(doc(this.firestore, `${workoutsCollectionPath(uid)}/${workoutId}`));
  }

  getPerformanceByExercise$(exerciseId: string): Observable<ExercisePerformance> {
    return this.workouts$.pipe(
      map((workouts) => this.buildPerformanceMap(workouts).get(exerciseId) ?? {})
    );
  }

  buildPerformanceMap(workouts: Workout[]): Map<string, ExercisePerformance> {
    const mapByExercise = new Map<string, ExercisePerformance>();

    workouts.forEach((workout) => {
      workout.entries.forEach((entry) => {
        const sets = entry.sets.filter((set) => Number.isFinite(set.weight) && Number.isFinite(set.reps));
        if (!sets.length) {
          return;
        }
        const topSet = sets.reduce((best, current) => (current.weight > best.weight ? current : best));
        const current = mapByExercise.get(entry.exerciseId) ?? {};

        if (!current.lastDate || workout.date > current.lastDate) {
          current.lastDate = workout.date;
          current.lastWeight = sets[0]?.weight;
          current.lastReps = sets[0]?.reps;
        }

        if (!current.bestWeight || topSet.weight > current.bestWeight) {
          current.bestWeight = topSet.weight;
        }
        mapByExercise.set(entry.exerciseId, current);
      });
    });

    return mapByExercise;
  }

  private mapWorkout(raw: Record<string, unknown>): Workout {
    const entries = sanitizeArray<Record<string, unknown>>(raw['entries']).map((entry) => ({
      exerciseId: String(entry['exerciseId'] ?? ''),
      exerciseName: String(entry['exerciseName'] ?? ''),
      notes: String(entry['notes'] ?? ''),
      sets: sanitizeArray<Record<string, unknown>>(entry['sets']).map((set) => ({
        setNumber: Number(set['setNumber'] ?? 1),
        weight: Number(set['weight'] ?? 0),
        reps: Number(set['reps'] ?? 0),
        rpe: Number(set['rpe'] ?? 0) || undefined,
        rir: Number(set['rir'] ?? 0) || undefined,
        notes: String(set['notes'] ?? '')
      }))
    }));

    return {
      id: String(raw['id']),
      userId: String(raw['userId'] ?? ''),
      routineId: String(raw['routineId'] ?? ''),
      routineName: String(raw['routineName'] ?? ''),
      folderId: String(raw['folderId'] ?? ''),
      date: toDate(raw['date']),
      entries,
      notes: String(raw['notes'] ?? ''),
      totalVolume: Number(raw['totalVolume'] ?? 0),
      createdAt: toDate(raw['createdAt'])
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
