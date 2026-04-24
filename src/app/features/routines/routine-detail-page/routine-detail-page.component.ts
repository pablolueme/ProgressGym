import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { combineLatest, map } from 'rxjs';
import { Exercise, ExerciseType, Routine, RoutineExercise } from '../../../core/models';
import { ExerciseService } from '../../../core/services/exercise.service';
import { RoutineService } from '../../../core/services/routine.service';

@Component({
  selector: 'app-routine-detail-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './routine-detail-page.component.html',
  styleUrl: './routine-detail-page.component.scss'
})
export class RoutineDetailPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly routineService = inject(RoutineService);
  private readonly exerciseService = inject(ExerciseService);

  protected readonly routineId = this.route.snapshot.paramMap.get('routineId') ?? '';
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

  protected readonly routine$ = this.routineService.routineById$(this.routineId);
  protected readonly exercises$ = this.exerciseService.exercises$;
  protected readonly vm$ = combineLatest([this.routine$, this.exercises$]).pipe(
    map(([routine, exercises]) => ({ routine, exercises }))
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

  protected showQuickExercise = false;
  protected message = '';
  protected isError = false;

  protected setRoutineForm(routine: Routine): void {
    this.routineForm.patchValue({
      name: routine.name,
      description: routine.description ?? '',
      day: routine.day ?? '',
      notes: routine.notes ?? ''
    });
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
      this.setMessage('Rutina actualizada.');
    } catch (error) {
      this.setMessage((error as Error).message, true);
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
      this.setMessage('Selecciona un ejercicio valido.', true);
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
      this.setMessage('Ejercicio creado y anadido a la rutina.');
    } catch (error) {
      this.setMessage((error as Error).message, true);
    }
  }

  private async saveRoutineExercises(
    routine: Routine,
    exercises: RoutineExercise[]
  ): Promise<void> {
    try {
      await this.routineService.saveRoutineExercises(routine.id, exercises);
      this.setMessage('Ejercicios de rutina actualizados.');
    } catch (error) {
      this.setMessage((error as Error).message, true);
    }
  }

  private setMessage(message: string, isError = false): void {
    this.message = message;
    this.isError = isError;
  }
}
