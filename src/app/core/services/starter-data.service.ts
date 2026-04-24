import { inject, Injectable } from '@angular/core';
import {
  collection,
  doc,
  Firestore,
  serverTimestamp,
  writeBatch
} from '@angular/fire/firestore';
import { exercisesCollectionPath, foldersCollectionPath, routinesCollectionPath } from './user-data-paths';

@Injectable({ providedIn: 'root' })
export class StarterDataService {
  private readonly firestore = inject(Firestore);

  async seedForUser(uid: string): Promise<void> {
    const foldersRef = collection(this.firestore, foldersCollectionPath(uid));
    const exercisesRef = collection(this.firestore, exercisesCollectionPath(uid));
    const routinesRef = collection(this.firestore, routinesCollectionPath(uid));

    const pechoFolderRef = doc(foldersRef);
    const espaldaFolderRef = doc(foldersRef);
    const piernaFolderRef = doc(foldersRef);

    const pressBancaRef = doc(exercisesRef);
    const pressInclinadoRef = doc(exercisesRef);
    const jalonRef = doc(exercisesRef);
    const remoRef = doc(exercisesRef);
    const sentadillaRef = doc(exercisesRef);
    const prensaRef = doc(exercisesRef);

    const rutinaRef = doc(routinesRef);

    const batch = writeBatch(this.firestore);

    batch.set(pechoFolderRef, {
      userId: uid,
      name: 'Pecho',
      description: 'Rutinas enfocadas en pecho',
      color: '#22C55E',
      icon: 'fitness_center',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    batch.set(espaldaFolderRef, {
      userId: uid,
      name: 'Espalda',
      description: 'Tirones y dorsales',
      color: '#38BDF8',
      icon: 'back_hand',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    batch.set(piernaFolderRef, {
      userId: uid,
      name: 'Pierna',
      description: 'Dia de pierna',
      color: '#F59E0B',
      icon: 'directions_run',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    batch.set(pressBancaRef, this.buildExercise(uid, 'Press banca', 'Pecho', 'Barra'));
    batch.set(
      pressInclinadoRef,
      this.buildExercise(uid, 'Press inclinado con mancuernas', 'Pecho', 'Mancuernas')
    );
    batch.set(jalonRef, this.buildExercise(uid, 'Jalon al pecho', 'Espalda', 'Polea'));
    batch.set(remoRef, this.buildExercise(uid, 'Remo en maquina', 'Espalda', 'Maquina'));
    batch.set(sentadillaRef, this.buildExercise(uid, 'Sentadilla', 'Pierna', 'Barra'));
    batch.set(prensaRef, this.buildExercise(uid, 'Prensa', 'Pierna', 'Maquina'));

    batch.set(rutinaRef, {
      userId: uid,
      folderId: pechoFolderRef.id,
      name: 'Pecho basico',
      description: 'Empuje principal',
      day: 'Lunes',
      notes: 'Entrenamiento de ejemplo',
      exercises: [
        {
          exerciseId: pressBancaRef.id,
          exerciseName: 'Press banca',
          sets: 4,
          reps: '6-10',
          restSeconds: 120,
          notes: '',
          order: 0
        },
        {
          exerciseId: pressInclinadoRef.id,
          exerciseName: 'Press inclinado con mancuernas',
          sets: 3,
          reps: '8-12',
          restSeconds: 90,
          notes: '',
          order: 1
        }
      ],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    await batch.commit();
  }

  private buildExercise(uid: string, name: string, muscleGroup: string, type: string) {
    return {
      userId: uid,
      name,
      muscleGroup,
      secondaryMuscles: [],
      type,
      description: '',
      technique: '',
      tips: '',
      commonMistakes: '',
      personalNotes: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
  }
}
