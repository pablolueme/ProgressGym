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
  serverTimestamp,
  updateDoc
} from '@angular/fire/firestore';
import { map, Observable, of, switchMap } from 'rxjs';
import { GymFolder } from '../models';
import { toDate } from './firestore-mappers';
import { foldersCollectionPath } from './user-data-paths';
import { AuthService } from './auth.service';

export interface FolderInput {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

@Injectable({ providedIn: 'root' })
export class FolderService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(Auth);
  private readonly authService = inject(AuthService);

  readonly folders$: Observable<GymFolder[]> = this.getFolders();

  getFolders(): Observable<GymFolder[]> {
    return this.authService.uid$.pipe(
      switchMap((uid) => {
        if (!uid) {
          return of([]);
        }
        const ref = collection(this.firestore, foldersCollectionPath(uid));
        const foldersQuery = query(ref, orderBy('updatedAt', 'desc'));
        return collectionData(foldersQuery, { idField: 'id' }).pipe(
          map((items) => items.map((item) => this.mapFolder(item)))
        );
      })
    );
  }

  getFolderById(folderId: string): Observable<GymFolder | null> {
    return this.authService.uid$.pipe(
      switchMap((uid) => {
        if (!uid || !folderId) {
          return of(null);
        }
        return docData(doc(this.firestore, `${foldersCollectionPath(uid)}/${folderId}`), {
          idField: 'id'
        }).pipe(map((item) => (item ? this.mapFolder(item as Record<string, unknown>) : null)));
      })
    );
  }

  folderById$(folderId: string): Observable<GymFolder | null> {
    return this.getFolderById(folderId);
  }

  async createFolder(input: FolderInput): Promise<string> {
    const uid = this.requireUid();
    const name = input.name.trim();
    if (!name) {
      throw new Error('El nombre de la carpeta es obligatorio.');
    }

    const reference = await addDoc(collection(this.firestore, foldersCollectionPath(uid)), {
      userId: uid,
      name,
      description: input.description?.trim() || '',
      color: input.color?.trim() || '',
      icon: input.icon?.trim() || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return reference.id;
  }

  async updateFolder(folderId: string, input: Partial<FolderInput>): Promise<void> {
    const uid = this.requireUid();
    const updates: Partial<FolderInput> = {
      ...input
    };

    if (typeof updates.name === 'string') {
      const normalizedName = updates.name.trim();
      if (!normalizedName) {
        throw new Error('El nombre de la carpeta es obligatorio.');
      }
      updates.name = normalizedName;
    }

    if (typeof updates.description === 'string') {
      updates.description = updates.description.trim();
    }
    if (typeof updates.color === 'string') {
      updates.color = updates.color.trim();
    }
    if (typeof updates.icon === 'string') {
      updates.icon = updates.icon.trim();
    }

    await updateDoc(doc(this.firestore, `${foldersCollectionPath(uid)}/${folderId}`), {
      ...updates,
      updatedAt: serverTimestamp()
    });
  }

  async deleteFolder(folderId: string): Promise<void> {
    const uid = this.requireUid();
    await deleteDoc(doc(this.firestore, `${foldersCollectionPath(uid)}/${folderId}`));
  }

  private mapFolder(raw: Record<string, unknown>): GymFolder {
    return {
      id: String(raw['id']),
      userId: String(raw['userId'] ?? ''),
      name: String(raw['name'] ?? ''),
      description: String(raw['description'] ?? ''),
      color: String(raw['color'] ?? ''),
      icon: String(raw['icon'] ?? ''),
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
