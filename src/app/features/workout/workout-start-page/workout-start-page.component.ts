import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Component, DestroyRef, inject } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest, distinctUntilChanged, firstValueFrom, map } from 'rxjs';
import { Routine, RoutineExercise, Workout, WorkoutEntry } from '../../../core/models';
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

interface WorkoutRouteContext {
  routineId: string;
  workoutId: string;
  forceNew: boolean;
}

interface PreparedSet {
  setNumber: number;
  weight?: number;
  reps?: number;
  rpe?: number;
  rir?: number;
  notes?: string;
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

  protected readonly form = this.fb.nonNullable.group({
    notes: [''],
    entries: this.fb.array<EntryForm>([])
  });

  protected status: WorkoutStartStatus = 'loading';
  protected formMessage = '';
  protected errorMessage = '';
  protected isSavingProgress = false;
  protected isFinishing = false;
  protected currentRoutine: Routine | null = null;
  protected activeWorkout: Workout | null = null;
  protected performanceMap = new Map<string, ExercisePerformance>();

  private loadToken = 0;

  constructor() {
    combineLatest([this.route.paramMap, this.route.queryParamMap])
      .pipe(
        map(([params, query]) => ({
          routineId: params.get('routineId')?.trim() ?? '',
          workoutId: (params.get('workoutId') ?? query.get('workoutId') ?? '').trim(),
          forceNew: (query.get('mode') ?? '').trim().toLowerCase() === 'new'
        })),
        distinctUntilChanged(
          (a, b) =>
            a.routineId === b.routineId && a.workoutId === b.workoutId && a.forceNew === b.forceNew
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((context) => void this.loadContext(context));
  }

  protected get entriesArray(): FormArray<EntryForm> {
    return this.form.controls.entries;
  }

  protected setsArray(entryIndex: number): FormArray<SetForm> {
    return this.entriesArray.at(entryIndex).controls.sets;
  }

  protected get workoutTitle(): string {
    if (!this.currentRoutine?.name) {
      return 'Entrenamiento';
    }
    if (this.activeWorkout?.status === 'COMPLETED') {
      return `${this.currentRoutine.name} (completado)`;
    }
    return this.currentRoutine.name;
  }

  protected addSet(entryIndex: number): void {
    this.clearFormMessage();
    const sets = this.setsArray(entryIndex);
    const setNumber = sets.length + 1;
    sets.push(this.createSetForm(setNumber, null, null));
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

  protected async saveProgress(): Promise<void> {
    if (!this.activeWorkout || this.activeWorkout.status === 'COMPLETED') {
      this.showValidationError('No hay un entrenamiento en curso para guardar.');
      return;
    }
    if (this.isSavingProgress || this.isFinishing) {
      return;
    }

    this.clearFormMessage();
    const entries = this.buildEntriesForProgressSave();

    this.isSavingProgress = true;
    try {
      await this.workoutService.updateWorkoutProgress(this.activeWorkout.id, {
        entries,
        notes: this.form.controls.notes.value
      });
      const refreshed = await this.workoutService.getWorkoutById(this.activeWorkout.id);
      if (refreshed) {
        this.activeWorkout = refreshed;
      }
      this.toast.success('Progreso guardado.');
    } catch (error) {
      console.error('Error al guardar progreso:', error);
      this.showValidationError('No se ha podido guardar el progreso.');
    } finally {
      this.isSavingProgress = false;
    }
  }

  protected async finishWorkout(): Promise<void> {
    if (!this.activeWorkout || this.activeWorkout.status === 'COMPLETED') {
      this.showValidationError('No hay un entrenamiento en curso para finalizar.');
      return;
    }
    if (this.isSavingProgress || this.isFinishing) {
      return;
    }

    this.clearFormMessage();
    const prepareResult = this.buildEntriesForFinish();
    if (!prepareResult.ok) {
      this.showValidationError(prepareResult.errorMessage);
      return;
    }
    if (!prepareResult.entries.length) {
      this.showValidationError('Anade al menos una serie con peso y repeticiones para finalizar.');
      return;
    }

    this.isFinishing = true;
    try {
      await this.workoutService.completeWorkout(this.activeWorkout.id, {
        entries: prepareResult.entries,
        notes: this.form.controls.notes.value
      });
      this.toast.success('Entrenamiento finalizado.');
      await this.router.navigate(['/app/history', this.activeWorkout.id]);
    } catch (error) {
      console.error('Error al finalizar entrenamiento:', error);
      this.showValidationError('No se ha podido finalizar el entrenamiento.');
    } finally {
      this.isFinishing = false;
    }
  }

  protected async exitWorkout(): Promise<void> {
    const confirmed = window.confirm(
      'Quieres salir? El entrenamiento seguira en curso y podras continuarlo despues.'
    );
    if (!confirmed) {
      return;
    }
    await this.router.navigateByUrl('/app/workout');
  }

  private async loadContext(context: WorkoutRouteContext): Promise<void> {
    const token = ++this.loadToken;
    this.status = 'loading';
    this.errorMessage = '';
    this.formMessage = '';
    this.currentRoutine = null;
    this.activeWorkout = null;
    this.entriesArray.clear();
    this.form.controls.notes.setValue('');

    try {
      const completedWorkouts = await firstValueFrom(
        this.workoutService.getCompletedWorkouts({ range: 'ALL' })
      );
      this.performanceMap = this.workoutService.buildPerformanceMap(completedWorkouts);

      if (context.workoutId) {
        await this.loadFromWorkoutId(context.workoutId, token);
        return;
      }
      if (context.routineId) {
        await this.loadFromRoutineId(context.routineId, context.forceNew, token);
        return;
      }
      if (!this.isCurrentLoad(token)) {
        return;
      }
      this.status = 'invalid';
      this.errorMessage = 'No se ha recibido un identificador valido.';
    } catch (error) {
      if (!this.isCurrentLoad(token)) {
        return;
      }
      this.status = 'error';
      this.errorMessage = this.getErrorMessage(error, 'No se pudo cargar el entrenamiento.');
    }
  }

  private async loadFromWorkoutId(workoutId: string, token: number): Promise<void> {
    const workout = await this.workoutService.getWorkoutById(workoutId);
    if (!this.isCurrentLoad(token)) {
      return;
    }
    if (!workout) {
      this.status = 'not-found';
      this.errorMessage = 'El entrenamiento no existe o no esta disponible.';
      return;
    }

    const routine = await firstValueFrom(this.routineService.getRoutineById(workout.routineId));
    if (!this.isCurrentLoad(token)) {
      return;
    }
    if (!routine) {
      this.status = 'not-found';
      this.errorMessage = 'La rutina asociada no esta disponible.';
      return;
    }

    this.activateWorkout(routine, workout);
    if (workout.status === 'IN_PROGRESS') {
      this.toast.info('Tienes un entrenamiento en curso.');
    }
  }

  private async loadFromRoutineId(routineId: string, forceNew: boolean, token: number): Promise<void> {
    const routine = await firstValueFrom(this.routineService.getRoutineById(routineId));
    if (!this.isCurrentLoad(token)) {
      return;
    }
    if (!routine) {
      this.status = 'not-found';
      this.errorMessage = 'La rutina no existe o no esta disponible.';
      return;
    }
    if (!routine.exercises.length) {
      this.status = 'no-exercises';
      this.errorMessage = 'Esta rutina no tiene ejercicios todavia.';
      this.currentRoutine = routine;
      return;
    }

    const existingWorkout = await firstValueFrom(this.workoutService.getInProgressWorkoutByRoutine(routine.id));
    if (!this.isCurrentLoad(token)) {
      return;
    }

    if (existingWorkout && !forceNew) {
      const continueExisting = window.confirm(
        'Ya tienes un entrenamiento en curso para esta rutina.\n\nAceptar: Continuar entrenamiento\nCancelar: Empezar nuevo entrenamiento'
      );
      if (continueExisting) {
        this.activateWorkout(routine, existingWorkout);
        this.toast.info('Tienes un entrenamiento en curso.');
        return;
      }
      const newWorkoutId = await this.workoutService.createInProgressWorkout(routine);
      if (!this.isCurrentLoad(token)) {
        return;
      }
      const newWorkout = await this.workoutService.getWorkoutById(newWorkoutId);
      if (!this.isCurrentLoad(token)) {
        return;
      }
      if (!newWorkout) {
        this.status = 'error';
        this.errorMessage = 'No se pudo preparar el entrenamiento en curso.';
        return;
      }
      this.activateWorkout(routine, newWorkout);
      return;
    }

    const workoutId = await this.workoutService.createInProgressWorkout(routine);
    if (!this.isCurrentLoad(token)) {
      return;
    }
    const createdWorkout = await this.workoutService.getWorkoutById(workoutId);
    if (!this.isCurrentLoad(token)) {
      return;
    }
    if (!createdWorkout) {
      this.status = 'error';
      this.errorMessage = 'No se pudo preparar el entrenamiento en curso.';
      return;
    }

    this.activateWorkout(routine, createdWorkout);
  }

  private activateWorkout(routine: Routine, workout: Workout): void {
    this.currentRoutine = routine;
    this.activeWorkout = workout;
    this.form.controls.notes.setValue(workout.notes ?? '');
    this.buildEntries(routine, workout);
    this.status = 'ready';
  }

  private buildEntries(routine: Routine, workout: Workout): void {
    this.entriesArray.clear();

    const routineExercises = [...routine.exercises].sort((a, b) => a.order - b.order);
    const workoutEntryMap = new Map(workout.entries.map((entry) => [entry.exerciseId, entry]));
    const orderedEntries: Array<{ routineExercise: RoutineExercise; workoutEntry?: WorkoutEntry }> = [];

    routineExercises.forEach((routineExercise) => {
      orderedEntries.push({
        routineExercise,
        workoutEntry: workoutEntryMap.get(routineExercise.exerciseId)
      });
      workoutEntryMap.delete(routineExercise.exerciseId);
    });

    workoutEntryMap.forEach((workoutEntry) => {
      orderedEntries.push({
        routineExercise: {
          exerciseId: workoutEntry.exerciseId,
          exerciseName: workoutEntry.exerciseName,
          sets: Math.max(1, workoutEntry.sets.length),
          reps: '-',
          restSeconds: 0,
          notes: workoutEntry.notes,
          order: orderedEntries.length
        },
        workoutEntry
      });
    });

    orderedEntries.forEach(({ routineExercise, workoutEntry }) => {
      const sets = this.fb.array<SetForm>([]);

      if (workoutEntry?.sets.length) {
        workoutEntry.sets.forEach((set, index) => {
          sets.push(
            this.createSetForm(index + 1, this.toNumberOrNull(set.weight ?? null), this.toNumberOrNull(set.reps ?? null), {
              rpe: this.toNumberOrNull(set.rpe ?? null),
              rir: this.toNumberOrNull(set.rir ?? null),
              notes: set.notes ?? ''
            })
          );
        });
      } else {
        const totalSets = Math.max(1, routineExercise.sets);
        for (let index = 0; index < totalSets; index += 1) {
          sets.push(this.createSetForm(index + 1, null, null));
        }
      }

      this.entriesArray.push(
        this.fb.nonNullable.group({
          exerciseId: [routineExercise.exerciseId, Validators.required],
          exerciseName: [routineExercise.exerciseName, Validators.required],
          targetSets: [routineExercise.sets, Validators.required],
          targetReps: [routineExercise.reps, Validators.required],
          restSeconds: [routineExercise.restSeconds ?? 0],
          notes: [workoutEntry?.notes ?? routineExercise.notes ?? ''],
          sets
        })
      );
    });
  }

  private createSetForm(
    setNumber: number,
    initialWeight: number | null,
    initialReps: number | null,
    options?: { rpe?: number | null; rir?: number | null; notes?: string }
  ): SetForm {
    return this.fb.group({
      setNumber: this.fb.nonNullable.control(setNumber),
      weight: this.fb.control<number | null>(initialWeight, [Validators.min(0)]),
      reps: this.fb.control<number | null>(initialReps, [Validators.min(1)]),
      rpe: this.fb.control<number | null>(options?.rpe ?? null),
      rir: this.fb.control<number | null>(options?.rir ?? null),
      notes: this.fb.nonNullable.control(options?.notes ?? '')
    });
  }

  private buildEntriesForProgressSave(): WorkoutEntry[] {
    const entries: WorkoutEntry[] = [];

    for (const entry of this.entriesArray.controls) {
      const sets = entry.controls.sets;
      const preparedSets = sets.controls
        .map((setControl, index) => this.readSetForProgress(setControl, index + 1))
        .filter((set): set is PreparedSet => set !== null);

      const entryNotes = entry.controls.notes.value.trim() || undefined;
      if (!preparedSets.length && !entryNotes) {
        continue;
      }

      entries.push({
        exerciseId: entry.controls.exerciseId.value,
        exerciseName: entry.controls.exerciseName.value,
        notes: entryNotes,
        sets: preparedSets
      });
    }

    return entries;
  }

  private buildEntriesForFinish():
    | { ok: true; entries: WorkoutEntry[] }
    | { ok: false; errorMessage: string } {
    const entries: WorkoutEntry[] = [];
    let hasIncompleteSeries = false;

    for (const entry of this.entriesArray.controls) {
      const sets = entry.controls.sets;

      for (let setIndex = sets.length - 1; setIndex >= 0; setIndex -= 1) {
        const set = sets.at(setIndex);
        const preparedSet = this.readSetForFinish(set, setIndex + 1);

        if (preparedSet.kind === 'empty') {
          sets.removeAt(setIndex);
          continue;
        }

        if (preparedSet.kind === 'invalid') {
          hasIncompleteSeries = true;
        }
      }

      sets.controls.forEach((setControl, index) => {
        setControl.controls.setNumber.setValue(index + 1);
      });

      const completeSets: PreparedSet[] = [];
      for (let setIndex = 0; setIndex < sets.length; setIndex += 1) {
        const parsed = this.readSetForFinish(sets.at(setIndex), setIndex + 1);
        if (parsed.kind === 'complete') {
          completeSets.push(parsed.set);
        }
        if (parsed.kind === 'invalid') {
          hasIncompleteSeries = true;
        }
      }

      if (!completeSets.length) {
        continue;
      }

      entries.push({
        exerciseId: entry.controls.exerciseId.value,
        exerciseName: entry.controls.exerciseName.value,
        notes: entry.controls.notes.value.trim() || undefined,
        sets: completeSets
      });
    }

    if (hasIncompleteSeries) {
      return {
        ok: false,
        errorMessage:
          'Para finalizar, completa peso y repeticiones en todas las series o elimina las series incompletas.'
      };
    }

    return { ok: true, entries };
  }

  private readSetForProgress(set: SetForm, setNumber: number): PreparedSet | null {
    const weight = this.toNumberOrNull(set.controls.weight.value);
    const reps = this.toNumberOrNull(set.controls.reps.value);
    const rpe = this.toNumberOrUndefined(set.controls.rpe.value);
    const rir = this.toNumberOrUndefined(set.controls.rir.value);
    const notes = set.controls.notes.value.trim() || undefined;

    const prepared: PreparedSet = { setNumber };

    if (weight !== null && weight >= 0) {
      prepared.weight = weight;
    }
    if (reps !== null && reps > 0) {
      prepared.reps = reps;
    }
    if (rpe !== undefined) {
      prepared.rpe = rpe;
    }
    if (rir !== undefined) {
      prepared.rir = rir;
    }
    if (notes) {
      prepared.notes = notes;
    }

    const hasAnyData =
      prepared.weight !== undefined ||
      prepared.reps !== undefined ||
      prepared.rpe !== undefined ||
      prepared.rir !== undefined ||
      prepared.notes !== undefined;

    return hasAnyData ? prepared : null;
  }

  private readSetForFinish(
    set: SetForm,
    setNumber: number
  ):
    | { kind: 'empty' }
    | { kind: 'invalid' }
    | { kind: 'complete'; set: PreparedSet } {
    const weight = this.toNumberOrNull(set.controls.weight.value);
    const reps = this.toNumberOrNull(set.controls.reps.value);
    const rpe = this.toNumberOrUndefined(set.controls.rpe.value);
    const rir = this.toNumberOrUndefined(set.controls.rir.value);
    const notes = set.controls.notes.value.trim() || undefined;

    const hasWeight = weight !== null;
    const hasReps = reps !== null;
    const hasOtherData = rpe !== undefined || rir !== undefined || !!notes;

    if (!hasWeight && !hasReps && !hasOtherData) {
      return { kind: 'empty' };
    }

    if (!hasWeight || !hasReps) {
      return { kind: 'invalid' };
    }
    if (weight < 0 || reps <= 0) {
      return { kind: 'invalid' };
    }

    const completeSet: PreparedSet = {
      setNumber,
      weight,
      reps
    };
    if (rpe !== undefined) {
      completeSet.rpe = rpe;
    }
    if (rir !== undefined) {
      completeSet.rir = rir;
    }
    if (notes) {
      completeSet.notes = notes;
    }
    return { kind: 'complete', set: completeSet };
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

  private isCurrentLoad(token: number): boolean {
    return token === this.loadToken;
  }
}
