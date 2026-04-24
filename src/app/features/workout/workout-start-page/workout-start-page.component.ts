import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest, map } from 'rxjs';
import { Routine, WorkoutEntry, WorkoutSet } from '../../../core/models';
import { RoutineService } from '../../../core/services/routine.service';
import { ExercisePerformance, WorkoutService } from '../../../core/services/workout.service';

type SetForm = FormGroup<{
  setNumber: FormControl<number>;
  weight: FormControl<number>;
  reps: FormControl<number>;
  rpe: FormControl<number | null>;
  rir: FormControl<number | null>;
  notes: FormControl<string>;
}>;

type EntryForm = FormGroup<{
  exerciseId: FormControl<string>;
  exerciseName: FormControl<string>;
  targetSets: FormControl<number>;
  targetReps: FormControl<string>;
  restSeconds: FormControl<number>;
  notes: FormControl<string>;
  sets: FormArray<SetForm>;
}>;

@Component({
  selector: 'app-workout-start-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './workout-start-page.component.html',
  styleUrl: './workout-start-page.component.scss'
})
export class WorkoutStartPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly routineService = inject(RoutineService);
  private readonly workoutService = inject(WorkoutService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly routineId = this.route.snapshot.paramMap.get('routineId') ?? '';
  protected readonly routine$ = this.routineService.routineById$(this.routineId);

  protected readonly vm$ = combineLatest([this.routine$, this.workoutService.workouts$]).pipe(
    map(([routine, workouts]) => ({
      routine,
      performanceMap: this.workoutService.buildPerformanceMap(workouts)
    }))
  );

  protected readonly form = this.fb.nonNullable.group({
    notes: [''],
    entries: this.fb.array<EntryForm>([])
  });

  protected currentRoutine: Routine | null = null;
  protected performanceMap = new Map<string, ExercisePerformance>();
  protected loadingRoutineId = '';
  protected isSaving = false;
  protected message = '';
  protected isError = false;

  constructor() {
    this.vm$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ routine, performanceMap }) => {
      this.performanceMap = performanceMap;
      if (!routine) {
        return;
      }
      this.currentRoutine = routine;
      if (this.loadingRoutineId !== routine.id) {
        this.loadingRoutineId = routine.id;
        this.buildEntriesFromRoutine(routine);
      }
    });
  }

  protected get entriesArray(): FormArray<EntryForm> {
    return this.form.controls.entries;
  }

  protected setsArray(entryIndex: number): FormArray<SetForm> {
    return this.entriesArray.at(entryIndex).controls.sets;
  }

  protected addSet(entryIndex: number): void {
    const sets = this.setsArray(entryIndex);
    const setNumber = sets.length + 1;
    sets.push(this.createSetForm(setNumber, null));
  }

  protected removeSet(entryIndex: number, setIndex: number): void {
    const sets = this.setsArray(entryIndex);
    if (sets.length <= 1) {
      return;
    }
    sets.removeAt(setIndex);
    sets.controls.forEach((control, index) => {
      control.controls.setNumber.setValue(index + 1);
    });
  }

  protected copyPreviousWeight(entryIndex: number, setIndex: number): void {
    if (setIndex === 0) {
      return;
    }
    const sets = this.setsArray(entryIndex);
    const previousWeight = sets.at(setIndex - 1).controls.weight.value;
    sets.at(setIndex).controls.weight.setValue(previousWeight);
  }

  protected getExercisePerformance(exerciseId: string): ExercisePerformance {
    return this.performanceMap.get(exerciseId) ?? {};
  }

  protected async saveWorkout(): Promise<void> {
    if (!this.currentRoutine || this.form.invalid || this.isSaving) {
      this.form.markAllAsTouched();
      return;
    }

    const entries: WorkoutEntry[] = this.entriesArray.controls.map((entry) => ({
      exerciseId: entry.controls.exerciseId.value,
      exerciseName: entry.controls.exerciseName.value,
      notes: entry.controls.notes.value,
      sets: entry.controls.sets.controls.map((set, index) => ({
        setNumber: index + 1,
        weight: set.controls.weight.value,
        reps: set.controls.reps.value,
        rpe: set.controls.rpe.value ?? undefined,
        rir: set.controls.rir.value ?? undefined,
        notes: set.controls.notes.value || undefined
      }))
    }));

    this.isSaving = true;
    this.setMessage('');
    try {
      const workoutId = await this.workoutService.createWorkoutFromRoutine(
        this.currentRoutine,
        entries,
        this.form.controls.notes.value
      );
      await this.router.navigate(['/app/history', workoutId]);
    } catch (error) {
      this.setMessage((error as Error).message, true);
    } finally {
      this.isSaving = false;
    }
  }

  protected async cancelWorkout(): Promise<void> {
    const confirmed = window.confirm('Quieres cancelar este entrenamiento sin guardar?');
    if (!confirmed) {
      return;
    }
    if (this.currentRoutine) {
      await this.router.navigate(['/app/routines', this.currentRoutine.id]);
      return;
    }
    await this.router.navigateByUrl('/app/workout');
  }

  private buildEntriesFromRoutine(routine: Routine): void {
    this.entriesArray.clear();
    const orderedExercises = [...routine.exercises].sort((a, b) => a.order - b.order);
    orderedExercises.forEach((routineExercise) => {
      const performance = this.performanceMap.get(routineExercise.exerciseId);
      const sets = this.fb.array<SetForm>([]);
      const initialWeight = performance?.lastWeight ?? 0;

      const totalSets = Math.max(1, routineExercise.sets);
      for (let index = 0; index < totalSets; index += 1) {
        sets.push(this.createSetForm(index + 1, initialWeight));
      }

      this.entriesArray.push(
        this.fb.nonNullable.group({
          exerciseId: [routineExercise.exerciseId, Validators.required],
          exerciseName: [routineExercise.exerciseName, Validators.required],
          targetSets: [routineExercise.sets, Validators.required],
          targetReps: [routineExercise.reps, Validators.required],
          restSeconds: [routineExercise.restSeconds ?? 0],
          notes: [routineExercise.notes ?? ''],
          sets
        })
      );
    });
  }

  private createSetForm(setNumber: number, initialWeight: number | null): SetForm {
    return this.fb.group({
      setNumber: this.fb.nonNullable.control(setNumber),
      weight: this.fb.nonNullable.control(initialWeight ?? 0, [Validators.min(0)]),
      reps: this.fb.nonNullable.control(0, [Validators.min(0)]),
      rpe: this.fb.control<number | null>(null),
      rir: this.fb.control<number | null>(null),
      notes: this.fb.nonNullable.control('')
    });
  }

  private setMessage(message: string, isError = false): void {
    this.message = message;
    this.isError = isError;
  }
}
