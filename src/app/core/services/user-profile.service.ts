import { inject, Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import {
  collection,
  deleteDoc,
  doc,
  docData,
  Firestore,
  getDocs,
  serverTimestamp,
  updateDoc,
  writeBatch
} from '@angular/fire/firestore';
import { combineLatest, map, Observable, of, switchMap } from 'rxjs';
import { UserProfile } from '../models';
import {
  exercisesCollectionPath,
  foldersCollectionPath,
  routinesCollectionPath,
  userDocPath,
  workoutsCollectionPath
} from './user-data-paths';
import { toDate } from './firestore-mappers';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class UserProfileService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(Auth);
  private readonly authService = inject(AuthService);

  readonly profile$: Observable<UserProfile | null> = this.authService.uid$.pipe(
    switchMap((uid) => {
      if (!uid) {
        return of(null);
      }
      return docData(doc(this.firestore, userDocPath(uid)), { idField: 'uid' }).pipe(
        map((raw) => this.mapProfile(uid, raw as Record<string, unknown> | undefined))
      );
    })
  );

  async updateProfile(payload: Partial<UserProfile>): Promise<void> {
    const uid = this.requireUid();
    await updateDoc(doc(this.firestore, userDocPath(uid)), {
      ...payload,
      updatedAt: serverTimestamp()
    });
  }

  async deleteAllUserData(): Promise<void> {
    const uid = this.requireUid();
    await this.deleteCollection(foldersCollectionPath(uid));
    await this.deleteCollection(exercisesCollectionPath(uid));
    await this.deleteCollection(routinesCollectionPath(uid));
    await this.deleteCollection(workoutsCollectionPath(uid));
    await deleteDoc(doc(this.firestore, userDocPath(uid)));
  }

  async deleteAllUserDataByUid(uid: string): Promise<void> {
    await this.deleteCollection(foldersCollectionPath(uid));
    await this.deleteCollection(exercisesCollectionPath(uid));
    await this.deleteCollection(routinesCollectionPath(uid));
    await this.deleteCollection(workoutsCollectionPath(uid));
    await deleteDoc(doc(this.firestore, userDocPath(uid)));
  }

  readonly profileAndUid$ = combineLatest([this.profile$, this.authService.uid$]).pipe(
    map(([profile, uid]) => ({ profile, uid }))
  );

  private async deleteCollection(path: string): Promise<void> {
    const snapshot = await getDocs(collection(this.firestore, path));
    if (snapshot.empty) {
      return;
    }
    const batch = writeBatch(this.firestore);
    snapshot.docs.forEach((document) => {
      batch.delete(document.ref);
    });
    await batch.commit();
  }

  private mapProfile(uid: string, raw: Record<string, unknown> | undefined): UserProfile | null {
    if (!raw) {
      return null;
    }
    return {
      uid,
      name: String(raw['name'] ?? ''),
      email: String(raw['email'] ?? ''),
      weight: raw['weight'] as number | undefined,
      height: raw['height'] as number | undefined,
      goal: raw['goal'] as UserProfile['goal'],
      experienceLevel: raw['experienceLevel'] as UserProfile['experienceLevel'],
      trainingDaysPerWeek: raw['trainingDaysPerWeek'] as number | undefined,
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
