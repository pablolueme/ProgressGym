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
  getDocs,
  orderBy,
  query,
  updateDoc
} from '@angular/fire/firestore';
import { firstValueFrom, map, Observable, of, switchMap } from 'rxjs';
import { Routine, Workout, WorkoutEntry, WorkoutSet, WorkoutStatus } from '../models';
import { sanitizeArray, toDate } from './firestore-mappers';
import { workoutsCollectionPath } from './user-data-paths';
import { AuthService } from './auth.service';

export interface ExercisePerformance {
  lastWeight?: number;
  lastReps?: number;
  lastDate?: Date;
  bestWeight?: number;
}

export type WorkoutTimeRange = '2W' | '1M' | 'ALL';

export interface WorkoutQueryOptions {
  range?: WorkoutTimeRange;
}

export interface WorkoutSaveData {
  entries: WorkoutEntry[];
  notes?: string;
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

  getInProgressWorkouts(): Observable<Workout[]> {
    return this.workouts$.pipe(
      map((workouts) =>
        workouts
          .filter((workout) => workout.status === 'IN_PROGRESS')
          .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      )
    );
  }

  getInProgressWorkoutByRoutine(routineId: string): Observable<Workout | null> {
    return this.getInProgressWorkouts().pipe(
      map((workouts) => workouts.find((workout) => workout.routineId === routineId) ?? null)
    );
  }

  getCompletedWorkouts(options: WorkoutQueryOptions = {}): Observable<Workout[]> {
    const range = options.range ?? '2W';
    return this.workouts$.pipe(
      map((workouts) => workouts.filter((workout) => workout.status === 'COMPLETED')),
      map((workouts) =>
        [...workouts].sort((a, b) => {
          const dateA = (a.completedAt ?? a.date).getTime();
          const dateB = (b.completedAt ?? b.date).getTime();
          return dateB - dateA;
        })
      ),
      map((workouts) => this.filterByRange(workouts, range))
    );
  }

  async getWorkoutById(workoutId: string): Promise<Workout | null> {
    return firstValueFrom(this.workoutById$(workoutId));
  }

  async createInProgressWorkout(routine: Routine): Promise<string> {
    const uid = this.requireUid();
    const startedAt = new Date();
    const reference = await addDoc(collection(this.firestore, workoutsCollectionPath(uid)), {
      userId: uid,
      routineId: routine.id,
      routineName: routine.name,
      folderId: routine.folderId ?? null,
      date: startedAt,
      startedAt,
      updatedAt: startedAt,
      lastSavedAt: startedAt,
      status: 'IN_PROGRESS',
      entries: [],
      notes: '',
      totalVolume: 0
    });

    return reference.id;
  }

  async updateWorkoutProgress(workoutId: string, data: WorkoutSaveData): Promise<void> {
    const uid = this.requireUid();
    const now = new Date();
    const entries = this.sanitizeProgressEntries(data.entries);
    const totalVolume = this.calculateTotalVolume(entries);
    const notes = data.notes?.trim() ?? '';

    await updateDoc(doc(this.firestore, `${workoutsCollectionPath(uid)}/${workoutId}`), {
      entries,
      notes,
      totalVolume,
      status: 'IN_PROGRESS',
      updatedAt: now,
      lastSavedAt: now
    });
  }

  async completeWorkout(workoutId: string, data: WorkoutSaveData): Promise<void> {
    const uid = this.requireUid();
    const now = new Date();
    const entries = this.sanitizeCompletedEntries(data.entries);
    if (!entries.length) {
      throw new Error('Anade al menos una serie con peso y repeticiones para finalizar.');
    }
    const totalVolume = this.calculateTotalVolume(entries);
    const notes = data.notes?.trim() ?? '';

    await updateDoc(doc(this.firestore, `${workoutsCollectionPath(uid)}/${workoutId}`), {
      entries,
      notes,
      totalVolume,
      status: 'COMPLETED',
      completedAt: now,
      updatedAt: now,
      lastSavedAt: now
    });
  }

  async deleteWorkout(workoutId: string): Promise<void> {
    const uid = this.requireUid();
    await deleteDoc(doc(this.firestore, `${workoutsCollectionPath(uid)}/${workoutId}`));
  }

  async cleanupOldWorkoutHistory(days = 14): Promise<number> {
    const safeDays = Number.isFinite(days) && days > 0 ? Math.floor(days) : 14;

    try {
      const uid = this.requireUid();
      const cutoffMs = Date.now() - safeDays * 24 * 60 * 60 * 1000;
      const workoutsRef = collection(this.firestore, workoutsCollectionPath(uid));
      const snapshot = await getDocs(workoutsRef);

      if (snapshot.empty) {
        return 0;
      }

      let deletedCount = 0;

      for (const workoutDoc of snapshot.docs) {
        const raw = workoutDoc.data() as Record<string, unknown>;

        if (!this.shouldDeleteOldWorkout(raw, cutoffMs)) {
          continue;
        }

        try {
          await deleteDoc(doc(this.firestore, `${workoutsCollectionPath(uid)}/${workoutDoc.id}`));
          deletedCount += 1;
        } catch (error) {
          console.error(`No se pudo eliminar el workout ${workoutDoc.id}:`, error);
        }
      }

      return deletedCount;
    } catch (error) {
      console.error('Error al limpiar historial antiguo de workouts:', error);
      return 0;
    }
  }

  getPerformanceByExercise$(exerciseId: string): Observable<ExercisePerformance> {
    return this.getCompletedWorkouts({ range: 'ALL' }).pipe(
      map((workouts) => this.buildPerformanceMap(workouts).get(exerciseId) ?? {})
    );
  }

  buildPerformanceMap(workouts: Workout[]): Map<string, ExercisePerformance> {
    const mapByExercise = new Map<string, ExercisePerformance>();

    workouts.forEach((workout) => {
      if (workout.status !== 'COMPLETED') {
        return;
      }
      workout.entries.forEach((entry) => {
        const sets = entry.sets.filter(
          (set): set is WorkoutSet & { weight: number; reps: number } =>
            typeof set.weight === 'number' &&
            Number.isFinite(set.weight) &&
            typeof set.reps === 'number' &&
            Number.isFinite(set.reps)
        );
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

  private sanitizeProgressEntries(entries: WorkoutEntry[]): WorkoutEntry[] {
    return entries
      .map((entry) => {
        const trimmedEntryNotes = entry.notes?.trim();
        const setPayloads = entry.sets
          .map((set) => this.sanitizeProgressSet(set))
          .filter((set): set is WorkoutSet => set !== null);

        if (!setPayloads.length && !trimmedEntryNotes) {
          return null;
        }

        const payload: WorkoutEntry = {
          exerciseId: entry.exerciseId,
          exerciseName: entry.exerciseName,
          sets: setPayloads
        };

        if (trimmedEntryNotes) {
          payload.notes = trimmedEntryNotes;
        }
        return payload;
      })
      .filter((entry): entry is WorkoutEntry => entry !== null);
  }

  private sanitizeCompletedEntries(entries: WorkoutEntry[]): WorkoutEntry[] {
    return entries
      .map((entry) => {
        const setPayloads = entry.sets
          .map((set) => this.sanitizeCompletedSet(set))
          .filter((set): set is WorkoutSet => set !== null);

        if (!setPayloads.length) {
          return null;
        }

        const payload: WorkoutEntry = {
          exerciseId: entry.exerciseId,
          exerciseName: entry.exerciseName,
          sets: setPayloads
        };

        const trimmedEntryNotes = entry.notes?.trim();
        if (trimmedEntryNotes) {
          payload.notes = trimmedEntryNotes;
        }
        return payload;
      })
      .filter((entry): entry is WorkoutEntry => entry !== null);
  }

  private sanitizeProgressSet(set: WorkoutSet): WorkoutSet | null {
    const payload: WorkoutSet = {
      setNumber: Number.isFinite(set.setNumber) && set.setNumber > 0 ? Math.round(set.setNumber) : 1
    };

    if (typeof set.weight === 'number' && Number.isFinite(set.weight) && set.weight >= 0) {
      payload.weight = set.weight;
    }
    if (typeof set.reps === 'number' && Number.isFinite(set.reps) && set.reps > 0) {
      payload.reps = set.reps;
    }

    if (typeof set.rpe === 'number' && Number.isFinite(set.rpe)) {
      payload.rpe = set.rpe;
    }
    if (typeof set.rir === 'number' && Number.isFinite(set.rir)) {
      payload.rir = set.rir;
    }

    const trimmedNotes = set.notes?.trim();
    if (trimmedNotes) {
      payload.notes = trimmedNotes;
    }

    const hasAnyField =
      payload.weight !== undefined ||
      payload.reps !== undefined ||
      payload.rpe !== undefined ||
      payload.rir !== undefined ||
      payload.notes !== undefined;
    return hasAnyField ? payload : null;
  }

  private sanitizeCompletedSet(set: WorkoutSet): WorkoutSet | null {
    if (
      typeof set.weight !== 'number' ||
      !Number.isFinite(set.weight) ||
      set.weight < 0 ||
      typeof set.reps !== 'number' ||
      !Number.isFinite(set.reps) ||
      set.reps <= 0
    ) {
      return null;
    }

    const payload: WorkoutSet = {
      setNumber: Number.isFinite(set.setNumber) && set.setNumber > 0 ? Math.round(set.setNumber) : 1,
      weight: set.weight,
      reps: set.reps
    };

    if (typeof set.rpe === 'number' && Number.isFinite(set.rpe)) {
      payload.rpe = set.rpe;
    }
    if (typeof set.rir === 'number' && Number.isFinite(set.rir)) {
      payload.rir = set.rir;
    }

    const trimmedNotes = set.notes?.trim();
    if (trimmedNotes) {
      payload.notes = trimmedNotes;
    }
    return payload;
  }

  private calculateTotalVolume(entries: WorkoutEntry[]): number {
    return entries.reduce((sum, entry) => {
      const entryVolume = entry.sets.reduce((entrySum, set) => {
        if (
          typeof set.weight !== 'number' ||
          !Number.isFinite(set.weight) ||
          typeof set.reps !== 'number' ||
          !Number.isFinite(set.reps)
        ) {
          return entrySum;
        }
        return entrySum + set.weight * set.reps;
      }, 0);
      return sum + entryVolume;
    }, 0);
  }

  private shouldDeleteOldWorkout(raw: Record<string, unknown>, cutoffMs: number): boolean {
    const rawStatus = typeof raw['status'] === 'string' ? raw['status'].trim() : '';
    const hasStatus = rawStatus.length > 0;

    if (rawStatus === 'IN_PROGRESS') {
      return false;
    }
    if (hasStatus && rawStatus !== 'COMPLETED') {
      return false;
    }

    const referenceDate = this.resolveOptionalDate(raw['completedAt'], raw['date']);
    if (!referenceDate) {
      return false;
    }
    if (referenceDate.getTime() >= cutoffMs) {
      return false;
    }

    if (!hasStatus && this.looksLikeInProgressWithoutStatus(raw)) {
      return false;
    }

    return true;
  }

  private looksLikeInProgressWithoutStatus(raw: Record<string, unknown>): boolean {
    const hasCompletedAt = !!this.resolveOptionalDate(raw['completedAt']);
    if (hasCompletedAt) {
      return false;
    }

    const hasStartedAt = !!this.resolveOptionalDate(raw['startedAt']);
    const entries = sanitizeArray<unknown>(raw['entries']);
    const hasEntries = entries.length > 0;

    if (hasStartedAt && !hasCompletedAt) {
      return true;
    }

    if (!hasEntries) {
      return true;
    }

    return false;
  }

  private mapWorkout(raw: Record<string, unknown>): Workout {
    const entries = sanitizeArray<Record<string, unknown>>(raw['entries']).map((entry) => ({
      exerciseId: String(entry['exerciseId'] ?? ''),
      exerciseName: String(entry['exerciseName'] ?? ''),
      notes: String(entry['notes'] ?? ''),
      sets: sanitizeArray<Record<string, unknown>>(entry['sets'])
        .map((set) => {
          const mappedSet: WorkoutSet = {
            setNumber: Number(set['setNumber'] ?? 1)
          };

          const weight = Number(set['weight']);
          if (Number.isFinite(weight) && weight >= 0) {
            mappedSet.weight = weight;
          }

          const reps = Number(set['reps']);
          if (Number.isFinite(reps) && reps > 0) {
            mappedSet.reps = reps;
          }

          const rpe = Number(set['rpe']);
          if (Number.isFinite(rpe) && rpe > 0) {
            mappedSet.rpe = rpe;
          }

          const rir = Number(set['rir']);
          if (Number.isFinite(rir) || rir === 0) {
            mappedSet.rir = rir;
          }

          const notes = String(set['notes'] ?? '').trim();
          if (notes) {
            mappedSet.notes = notes;
          }

          const hasAnyData =
            mappedSet.weight !== undefined ||
            mappedSet.reps !== undefined ||
            mappedSet.rpe !== undefined ||
            mappedSet.rir !== undefined ||
            mappedSet.notes !== undefined;
          return hasAnyData ? mappedSet : null;
        })
        .filter((set): set is WorkoutSet => set !== null)
    }));

    const status = this.normalizeStatus(raw['status']);
    const startedAt = this.resolveDate(raw['startedAt'], raw['date'], raw['createdAt']);
    const date = this.resolveDate(raw['date'], raw['startedAt'], raw['createdAt']);
    const updatedAt = this.resolveDate(raw['updatedAt'], raw['lastSavedAt'], raw['date'], raw['startedAt']);
    const completedAt =
      status === 'COMPLETED'
        ? this.resolveOptionalDate(raw['completedAt'], raw['updatedAt'], raw['date'], raw['createdAt'])
        : undefined;
    const lastSavedAt = this.resolveOptionalDate(raw['lastSavedAt'], raw['updatedAt']);
    const folderIdRaw = String(raw['folderId'] ?? '').trim();
    const notes = String(raw['notes'] ?? '').trim();
    const totalVolume = Number(raw['totalVolume'] ?? 0);

    return {
      id: String(raw['id']),
      userId: String(raw['userId'] ?? ''),
      routineId: String(raw['routineId'] ?? ''),
      routineName: String(raw['routineName'] ?? ''),
      folderId: folderIdRaw || undefined,
      date,
      startedAt,
      updatedAt,
      completedAt,
      lastSavedAt,
      status,
      entries,
      notes: notes || undefined,
      totalVolume: Number.isFinite(totalVolume) ? totalVolume : 0
    };
  }

  private normalizeStatus(value: unknown): WorkoutStatus {
    return value === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'COMPLETED';
  }

  private resolveDate(...candidates: unknown[]): Date {
    const date = this.resolveOptionalDate(...candidates);
    return date ?? new Date(0);
  }

  private resolveOptionalDate(...candidates: unknown[]): Date | undefined {
    for (const candidate of candidates) {
      if (candidate === null || candidate === undefined || candidate === '') {
        continue;
      }
      const date = toDate(candidate);
      if (Number.isFinite(date.getTime()) && date.getTime() > 0) {
        return date;
      }
    }
    return undefined;
  }

  private filterByRange(workouts: Workout[], range: WorkoutTimeRange): Workout[] {
    if (range === 'ALL') {
      return workouts;
    }
    const now = new Date();
    const from = new Date(now);
    if (range === '1M') {
      from.setDate(from.getDate() - 30);
    } else {
      from.setDate(from.getDate() - 14);
    }
    from.setHours(0, 0, 0, 0);
    return workouts.filter((workout) => {
      const referenceDate = workout.completedAt ?? workout.date;
      return referenceDate >= from;
    });
  }

  private requireUid(): string {
    const uid = this.auth.currentUser?.uid;
    if (!uid) {
      throw new Error('No hay una sesion activa.');
    }
    return uid;
  }
}
