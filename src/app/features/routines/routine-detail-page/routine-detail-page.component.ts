import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Component, DestroyRef, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, combineLatest, distinctUntilChanged, map, of, startWith, switchMap } from 'rxjs';
import { Exercise, ExerciseType, Routine, RoutineExercise } from '../../../core/models';
import { ExerciseService } from '../../../core/services/exercise.service';
import { FolderService } from '../../../core/services/folder.service';
import { RoutineService } from '../../../core/services/routine.service';
import { UiToastService } from '../../../core/services/ui-toast.service';

type RoutineDetailStatus = 'loading' | 'ready' | 'not-found' | 'invalid' | 'error';

interface RoutineDetailViewModel {
  status: RoutineDetailStatus;
  routineId: string;
  routine: Routine | null;
  exercises: Exercise[];
  folderName: string;
  errorMessage: string;
}

@Component({
  selector: 'app-routine-detail-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './routine-detail-page.component.html',
  styleUrl: './routine-detail-page.component.scss'
})
export class RoutineDetailPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly routineService = inject(RoutineService);
  private readonly exerciseService = inject(ExerciseService);
  private readonly folderService = inject(FolderService);
  private readonly toast = inject(UiToastService);

  private readonly routeRoutineId$ = this.route.paramMap.pipe(
    map((params) => params.get('routineId')?.trim() ?? ''),
    distinctUntilChanged()
  );

  protected readonly exerciseTypes: ExerciseType[] = [
    'Maquina',
    'Polea',
    'Peso libre',
    'Mancuernas',
    'Barra',
    'Multipower',
    'Corporal',
    'Cardio',
    'Otro'
  ];

  protected showEditRoutineForm = false;
  protected showAddExerciseForm = false;
  protected showQuickExercise = false;
  protected activeRoutineId = '';

  protected readonly vm$ = this.routeRoutineId$.pipe(
    switchMap((routineId) => {
      if (!routineId) {
        return of<RoutineDetailViewModel>({
          status: 'invalid',
          routineId: '',
          routine: null,
          exercises: [],
          folderName: '',
          errorMessage: 'No se ha recibido un identificador de rutina valido.'
        });
      }

      return combineLatest([
        this.routineService.getRoutineById(routineId),
        this.exerciseService.exercises$,
        this.folderService.folders$
      ]).pipe(
        map(([routine, exercises, folders]) => {
          if (!routine) {
            return {
              status: 'not-found',
              routineId,
              routine: null,
              exercises: [],
              folderName: '',
              errorMessage: 'La rutina no existe o no tienes permisos para verla.'
            } satisfies RoutineDetailViewModel;
          }
          const folderName =
            folders.find((folder) => folder.id === routine.folderId)?.name ?? 'Sin carpeta';
          return {
            status: 'ready',
            routineId,
            routine,
            exercises,
            folderName,
            errorMessage: ''
          } satisfies RoutineDetailViewModel;
        }),
        startWith({
          status: 'loading',
          routineId,
          routine: null,
          exercises: [],
          folderName: '',
          errorMessage: ''
        } satisfies RoutineDetailViewModel),
        catchError((error) =>
          of<RoutineDetailViewModel>({
            status: 'error',
            routineId,
            routine: null,
            exercises: [],
            folderName: '',
            errorMessage: this.getErrorMessage(error, 'No se pudo cargar la rutina.')
          })
        )
      );
    })
  );

  protected readonly routineForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
    day: [''],
    notes: ['']
  });

  protected readonly addExerciseForm = this.fb.nonNullable.group({
    exerciseId: ['', Validators.required],
    sets: [3, [Validators.required, Validators.min(1), Validators.max(12)]],
    reps: ['8-12', Validators.required],
    restSeconds: [90, [Validators.min(0), Validators.max(600)]],
    notes: ['']
  });

  protected readonly quickExerciseForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    muscleGroup: ['', Validators.required],
    type: ['Otro' as ExerciseType, Validators.required],
    description: ['']
  });

  constructor() {
    this.vm$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((vm) => {
      if (vm.status !== 'ready' || !vm.routine) {
        return;
      }
      if (this.activeRoutineId !== vm.routine.id) {
        this.resetPanels();
        this.activeRoutineId = vm.routine.id;
      }
      this.setRoutineForm(vm.routine);
    });
  }

  protected toggleEditRoutineForm(routine: Routine): void {
    this.setRoutineForm(routine);
    this.showEditRoutineForm = !this.showEditRoutineForm;
    if (this.showEditRoutineForm) {
      this.showAddExerciseForm = false;
      this.showQuickExercise = false;
    }
  }

  protected toggleAddExerciseForm(): void {
    this.showAddExerciseForm = !this.showAddExerciseForm;
    if (this.showAddExerciseForm) {
      this.showEditRoutineForm = false;
    } else {
      this.showQuickExercise = false;
    }
  }

  protected async saveRoutineInfo(routine: Routine): Promise<void> {
    if (this.routineForm.invalid) {
      this.routineForm.markAllAsTouched();
      return;
    }
    try {
      await this.routineService.updateRoutine(routine.id, {
        folderId: routine.folderId,
        ...this.routineForm.getRawValue()
      });
      this.toast.success('Rutina actualizada.');
      this.showEditRoutineForm = false;
    } catch (error) {
      this.toast.error(this.getErrorMessage(error, 'No se pudo actualizar la rutina.'));
    }
  }

  protected async addExercise(routine: Routine, exercises: Exercise[]): Promise<void> {
    if (this.addExerciseForm.invalid) {
      this.addExerciseForm.markAllAsTouched();
      return;
    }
    const selectedExercise = exercises.find(
      (exercise) => exercise.id === this.addExerciseForm.controls.exerciseId.value
    );
    if (!selectedExercise) {
      this.toast.error('No se ha seleccionado un ejercicio valido.');
      return;
    }

    const value = this.addExerciseForm.getRawValue();
    const newExercise: RoutineExercise = {
      exerciseId: selectedExercise.id,
      exerciseName: selectedExercise.name,
      sets: value.sets,
      reps: value.reps,
      restSeconds: value.restSeconds || undefined,
      notes: value.notes,
      order: routine.exercises.length
    };

    await this.saveRoutineExercises(routine, [...routine.exercises, newExercise]);
    this.addExerciseForm.patchValue({
      exerciseId: '',
      sets: 3,
      reps: '8-12',
      restSeconds: 90,
      notes: ''
    });
  }

  protected async removeExercise(routine: Routine, index: number): Promise<void> {
    const updatedExercises = routine.exercises
      .filter((_, currentIndex) => currentIndex !== index)
      .map((exercise, currentIndex) => ({ ...exercise, order: currentIndex }));

    await this.saveRoutineExercises(routine, updatedExercises);
  }

  protected async moveExercise(routine: Routine, index: number, direction: -1 | 1): Promise<void> {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= routine.exercises.length) {
      return;
    }
    const reordered = [...routine.exercises];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);
    await this.saveRoutineExercises(
      routine,
      reordered.map((exercise, position) => ({ ...exercise, order: position }))
    );
  }

  protected async createQuickExerciseAndAttach(routine: Routine): Promise<void> {
    if (this.quickExerciseForm.invalid) {
      this.quickExerciseForm.markAllAsTouched();
      return;
    }
    try {
      const quickExercise = await this.exerciseService.createExercise({
        ...this.quickExerciseForm.getRawValue(),
        secondaryMuscles: []
      });

      const value = this.addExerciseForm.getRawValue();
      const newRoutineExercise: RoutineExercise = {
        exerciseId: quickExercise.id,
        exerciseName: quickExercise.name,
        sets: value.sets,
        reps: value.reps,
        restSeconds: value.restSeconds || undefined,
        notes: value.notes,
        order: routine.exercises.length
      };

      await this.saveRoutineExercises(routine, [...routine.exercises, newRoutineExercise]);
      this.quickExerciseForm.reset({
        name: '',
        muscleGroup: '',
        type: 'Otro',
        description: ''
      });
      this.showQuickExercise = false;
      this.toast.success('Ejercicio creado y anadido a la rutina.');
    } catch (error) {
      this.toast.error(this.getErrorMessage(error, 'No se pudo crear el ejercicio rapido.'));
    }
  }

  private setRoutineForm(routine: Routine): void {
    this.routineForm.patchValue({
      name: routine.name,
      description: routine.description ?? '',
      day: routine.day ?? '',
      notes: routine.notes ?? ''
    });
  }

  private resetPanels(): void {
    this.showEditRoutineForm = false;
    this.showAddExerciseForm = false;
    this.showQuickExercise = false;
  }

  private async saveRoutineExercises(routine: Routine, exercises: RoutineExercise[]): Promise<void> {
    try {
      await this.routineService.saveRoutineExercises(routine.id, exercises);
      this.toast.success('Rutina actualizada.');
    } catch (error) {
      this.toast.error(this.getErrorMessage(error, 'No se pudieron guardar los ejercicios.'));
    }
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return fallback;
  }
}
