import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { combineLatest, map, startWith } from 'rxjs';
import { Exercise, ExerciseType } from '../../../core/models';
import { ExerciseService } from '../../../core/services/exercise.service';
import { WorkoutService } from '../../../core/services/workout.service';

@Component({
  selector: 'app-exercises-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './exercises-page.component.html',
  styleUrl: './exercises-page.component.scss'
})
export class ExercisesPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly exerciseService = inject(ExerciseService);
  private readonly workoutService = inject(WorkoutService);

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

  protected readonly filterForm = this.fb.nonNullable.group({
    search: [''],
    muscleGroup: ['']
  });

  protected readonly exerciseForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    muscleGroup: ['', Validators.required],
    secondaryMusclesText: [''],
    type: ['Otro' as ExerciseType, Validators.required],
    description: [''],
    technique: [''],
    tips: [''],
    commonMistakes: [''],
    personalNotes: ['']
  });

  protected editingExerciseId: string | null = null;
  protected message = '';
  protected isError = false;

  protected readonly vm$ = combineLatest([
    this.exerciseService.exercises$,
    this.workoutService.workouts$,
    this.filterForm.valueChanges.pipe(startWith(this.filterForm.getRawValue()))
  ]).pipe(
    map(([exercises, workouts, filters]) => {
      const performanceMap = this.workoutService.buildPerformanceMap(workouts);
      const search = (filters.search ?? '').toLowerCase().trim();
      const muscleGroup = (filters.muscleGroup ?? '').toLowerCase().trim();

      const filtered = exercises.filter((exercise) => {
        const matchesSearch = !search || exercise.name.toLowerCase().includes(search);
        const matchesGroup = !muscleGroup || exercise.muscleGroup.toLowerCase().includes(muscleGroup);
        return matchesSearch && matchesGroup;
      });

      return filtered.map((exercise) => ({
        exercise,
        stats: performanceMap.get(exercise.id)
      }));
    })
  );

  protected async submitExercise(): Promise<void> {
    if (this.exerciseForm.invalid) {
      this.exerciseForm.markAllAsTouched();
      return;
    }
    const value = this.exerciseForm.getRawValue();
    const payload = {
      name: value.name,
      muscleGroup: value.muscleGroup,
      secondaryMuscles: value.secondaryMusclesText
        .split(',')
        .map((muscle) => muscle.trim())
        .filter(Boolean),
      type: value.type,
      description: value.description,
      technique: value.technique,
      tips: value.tips,
      commonMistakes: value.commonMistakes,
      personalNotes: value.personalNotes
    };

    try {
      if (this.editingExerciseId) {
        await this.exerciseService.updateExercise(this.editingExerciseId, payload);
        this.setMessage('Ejercicio actualizado.');
      } else {
        await this.exerciseService.createExercise(payload);
        this.setMessage('Ejercicio creado.');
      }
      this.resetExerciseForm();
    } catch (error) {
      this.setMessage((error as Error).message, true);
    }
  }

  protected editExercise(exercise: Exercise): void {
    this.editingExerciseId = exercise.id;
    this.exerciseForm.patchValue({
      name: exercise.name,
      muscleGroup: exercise.muscleGroup,
      secondaryMusclesText: (exercise.secondaryMuscles ?? []).join(', '),
      type: exercise.type,
      description: exercise.description ?? '',
      technique: exercise.technique ?? '',
      tips: exercise.tips ?? '',
      commonMistakes: exercise.commonMistakes ?? '',
      personalNotes: exercise.personalNotes ?? ''
    });
  }

  protected async removeExercise(exercise: Exercise): Promise<void> {
    const confirmed = window.confirm(`Eliminar ejercicio "${exercise.name}"?`);
    if (!confirmed) {
      return;
    }
    try {
      await this.exerciseService.deleteExercise(exercise.id);
      this.setMessage('Ejercicio eliminado.');
      if (this.editingExerciseId === exercise.id) {
        this.resetExerciseForm();
      }
    } catch (error) {
      this.setMessage((error as Error).message, true);
    }
  }

  protected cancelEdit(): void {
    this.resetExerciseForm();
  }

  private resetExerciseForm(): void {
    this.editingExerciseId = null;
    this.exerciseForm.reset({
      name: '',
      muscleGroup: '',
      secondaryMusclesText: '',
      type: 'Otro',
      description: '',
      technique: '',
      tips: '',
      commonMistakes: '',
      personalNotes: ''
    });
  }

  private setMessage(message: string, isError = false): void {
    this.message = message;
    this.isError = isError;
  }
}
