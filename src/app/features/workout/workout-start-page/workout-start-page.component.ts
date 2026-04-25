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
import { catchError, combineLatest, distinctUntilChanged, map, of, startWith, switchMap } from 'rxjs';
import { Routine, WorkoutEntry } from '../../../core/models';
import { RoutineService } from '../../../core/services/routine.service';
import { UiToastService } from '../../../core/services/ui-toast.service';
import { ExercisePerformance, WorkoutService } from '../../../core/services/workout.service';

type SetForm = FormGroup<{
  setNumber: FormControl<number>;
  weight: FormControl<number | null>;
  reps: FormControl<number | null>;
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

type WorkoutStartStatus = 'loading' | 'ready' | 'not-found' | 'invalid' | 'error' | 'no-exercises';

interface WorkoutStartViewModel {
  status: WorkoutStartStatus;
  routineId: string;
  routine: Routine | null;
  performanceMap: Map<string, ExercisePerformance>;
  errorMessage: string;
}

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
  private readonly toast = inject(UiToastService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly routeRoutineId$ = this.route.paramMap.pipe(
    map((params) => params.get('routineId')?.trim() ?? ''),
    distinctUntilChanged()
  );

  protected readonly vm$ = this.routeRoutineId$.pipe(
    switchMap((routineId) => {
      if (!routineId) {
        return of<WorkoutStartViewModel>({
          status: 'invalid',
          routineId: '',
          routine: null,
          performanceMap: new Map<string, ExercisePerformance>(),
          errorMessage: 'No se ha recibido un identificador de rutina valido.'
        });
      }
      return combineLatest([this.routineService.getRoutineById(routineId), this.workoutService.workouts$]).pipe(
        map(([routine, workouts]) => {
          const performanceMap = this.workoutService.buildPerformanceMap(workouts);
          if (!routine) {
            return {
              status: 'not-found',
              routineId,
              routine: null,
              performanceMap,
              errorMessage: 'La rutina no existe o no esta disponible.'
            } satisfies WorkoutStartViewModel;
          }
          if (!routine.exercises.length) {
            return {
              status: 'no-exercises',
              routineId,
              routine,
              performanceMap,
              errorMessage: 'Esta rutina no tiene ejercicios todavia.'
            } satisfies WorkoutStartViewModel;
          }
          return {
            status: 'ready',
            routineId,
            routine,
            performanceMap,
            errorMessage: ''
          } satisfies WorkoutStartViewModel;
        }),
        startWith({
          status: 'loading',
          routineId,
          routine: null,
          performanceMap: new Map<string, ExercisePerformance>(),
          errorMessage: ''
        } satisfies WorkoutStartViewModel),
        catchError((error) =>
          of<WorkoutStartViewModel>({
            status: 'error',
            routineId,
            routine: null,
            performanceMap: new Map<string, ExercisePerformance>(),
            errorMessage: this.getErrorMessage(error, 'No se pudo cargar la rutina.')
          })
        )
      );
    })
  );

  protected readonly form = this.fb.nonNullable.group({
    notes: [''],
    entries: this.fb.array<EntryForm>([])
  });

  protected currentRoutine: Routine | null = null;
  protected performanceMap = new Map<string, ExercisePerformance>();
  protected loadedRoutineId = '';
  protected isSaving = false;
  protected formMessage = '';

  constructor() {
    this.vm$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((vm) => {
      this.performanceMap = vm.performanceMap;
      this.currentRoutine = vm.routine;

      if (vm.status === 'ready' && vm.routine) {
        if (this.loadedRoutineId !== vm.routine.id) {
          this.loadedRoutineId = vm.routine.id;
          this.buildEntriesFromRoutine(vm.routine);
        }
        return;
      }

      this.loadedRoutineId = '';
      this.entriesArray.clear();
    });
  }

  protected get entriesArray(): FormArray<EntryForm> {
    return this.form.controls.entries;
  }

  protected setsArray(entryIndex: number): FormArray<SetForm> {
    return this.entriesArray.at(entryIndex).controls.sets;
  }

  protected addSet(entryIndex: number): void {
    this.clearFormMessage();
    const sets = this.setsArray(entryIndex);
    const setNumber = sets.length + 1;
    sets.push(this.createSetForm(setNumber, null));
  }

  protected removeSet(entryIndex: number, setIndex: number): void {
    this.clearFormMessage();
    const sets = this.setsArray(entryIndex);
    sets.removeAt(setIndex);
    sets.controls.forEach((control, index) => {
      control.controls.setNumber.setValue(index + 1);
    });
  }

  protected copyPreviousWeight(entryIndex: number, setIndex: number): void {
    this.clearFormMessage();
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
    if (!this.currentRoutine || this.entriesArray.length === 0) {
      this.showValidationError('Añade al menos una serie antes de guardar.');
      return;
    }
    if (this.isSaving) {
      return;
    }

    this.clearFormMessage();
    const entries = this.buildEntriesForSave();
    if (!entries) {
      return;
    }
    if (!entries.length) {
      this.showValidationError('Añade al menos una serie con peso y repeticiones.');
      return;
    }

    this.isSaving = true;
    try {
      const workoutId = await this.workoutService.createWorkoutFromRoutine(
        this.currentRoutine,
        entries,
        this.form.controls.notes.value
      );
      this.clearFormMessage();
      this.toast.success('Entrenamiento guardado.');
      await this.router.navigate(['/app/history', workoutId]);
    } catch (error) {
      console.error('Error al guardar entrenamiento:', error);
      this.showValidationError('No se ha podido guardar el entrenamiento. Revisa los datos.');
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
      const initialWeight = performance?.lastWeight ?? null;

      const totalSets = Math.max(1, routineExercise.sets);
      for (let index = 0; index < totalSets; index += 1) {
        const suggestedWeight = index === 0 ? initialWeight : null;
        sets.push(this.createSetForm(index + 1, suggestedWeight));
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
      weight: this.fb.control<number | null>(initialWeight, [Validators.min(0)]),
      reps: this.fb.control<number | null>(null, [Validators.min(1)]),
      rpe: this.fb.control<number | null>(null),
      rir: this.fb.control<number | null>(null),
      notes: this.fb.nonNullable.control('')
    });
  }

  private buildEntriesForSave(): WorkoutEntry[] | null {
    const validEntries: WorkoutEntry[] = [];

    for (const entry of this.entriesArray.controls) {
      const sets = entry.controls.sets;
      for (let setIndex = sets.length - 1; setIndex >= 0; setIndex -= 1) {
        const set = sets.at(setIndex);
        const weight = this.toNumberOrNull(set.controls.weight.value);
        const reps = this.toNumberOrNull(set.controls.reps.value);

        const hasWeight = weight !== null;
        const hasReps = reps !== null;

        if (!hasWeight && !hasReps) {
          sets.removeAt(setIndex);
          continue;
        }

        if (!hasWeight || !hasReps) {
          this.showValidationError('Completa peso y repeticiones o elimina la serie.');
          return null;
        }

        if (weight < 0 || reps <= 0) {
          this.showValidationError('El peso debe ser 0 o mayor y las repeticiones mayores que 0.');
          return null;
        }
      }

      sets.controls.forEach((setControl, index) => {
        setControl.controls.setNumber.setValue(index + 1);
      });

      const validSets = sets.controls.map((set, index) => {
        const weight = this.toNumberOrNull(set.controls.weight.value);
        const reps = this.toNumberOrNull(set.controls.reps.value);

        if (weight === null || reps === null) {
          return null;
        }

        return {
          setNumber: index + 1,
          weight,
          reps,
          rpe: this.toNumberOrUndefined(set.controls.rpe.value),
          rir: this.toNumberOrUndefined(set.controls.rir.value),
          notes: set.controls.notes.value.trim() || undefined
        };
      });

      const filteredSets = validSets.filter((set): set is NonNullable<typeof set> => set !== null);
      if (!filteredSets.length) {
        continue;
      }

      validEntries.push({
        exerciseId: entry.controls.exerciseId.value,
        exerciseName: entry.controls.exerciseName.value,
        notes: entry.controls.notes.value.trim() || undefined,
        sets: filteredSets
      });
    }

    return validEntries;
  }

  private toNumberOrNull(value: number | null): number | null {
    if (value === null || value === undefined) {
      return null;
    }
    return Number.isFinite(value) ? value : null;
  }

  private toNumberOrUndefined(value: number | null): number | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }
    return Number.isFinite(value) ? value : undefined;
  }

  private showValidationError(message: string): void {
    this.formMessage = message;
    this.toast.error(message);
  }

  private clearFormMessage(): void {
    this.formMessage = '';
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return fallback;
  }
}
