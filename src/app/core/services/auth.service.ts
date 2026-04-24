import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Auth, authState } from '@angular/fire/auth';
import {
  User,
  createUserWithEmailAndPassword,
  deleteUser,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateEmail,
  updateProfile
} from 'firebase/auth';
import { doc, Firestore, serverTimestamp, setDoc } from '@angular/fire/firestore';
import { map, Observable } from 'rxjs';
import { userDocPath } from './user-data-paths';

interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(Auth);
  private readonly firestore = inject(Firestore);
  private readonly router = inject(Router);

  readonly user$: Observable<User | null> = authState(this.auth);
  readonly uid$ = this.user$.pipe(map((user) => user?.uid ?? null));
  readonly isAuthenticated$ = this.user$.pipe(map((user) => !!user));

  get currentUser(): User | null {
    return this.auth.currentUser;
  }

  async register(payload: RegisterPayload): Promise<User> {
    try {
      const credentials = await createUserWithEmailAndPassword(
        this.auth,
        payload.email,
        payload.password
      );

      await updateProfile(credentials.user, { displayName: payload.name });
      await setDoc(doc(this.firestore, userDocPath(credentials.user.uid)), {
        uid: credentials.user.uid,
        name: payload.name,
        email: payload.email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      return credentials.user;
    } catch (error) {
      throw new Error(this.mapAuthError(error));
    }
  }

  async login(email: string, password: string): Promise<void> {
    try {
      await signInWithEmailAndPassword(this.auth, email, password);
    } catch (error) {
      throw new Error(this.mapAuthError(error));
    }
  }

  async logout(): Promise<void> {
    await signOut(this.auth);
    await this.router.navigateByUrl('/welcome');
  }

  async sendPasswordReset(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(this.auth, email);
    } catch (error) {
      throw new Error(this.mapAuthError(error));
    }
  }

  async updateCurrentUserEmail(email: string): Promise<void> {
    if (!this.auth.currentUser) {
      throw new Error('No hay una sesion activa.');
    }
    try {
      await updateEmail(this.auth.currentUser, email);
    } catch (error) {
      throw new Error(this.mapAuthError(error));
    }
  }

  async deleteCurrentAccount(): Promise<void> {
    if (!this.auth.currentUser) {
      return;
    }
    try {
      await deleteUser(this.auth.currentUser);
    } catch (error) {
      throw new Error(this.mapAuthError(error));
    }
  }

  private mapAuthError(error: unknown): string {
    const errorCode = (error as { code?: string })?.code;
    switch (errorCode) {
      case 'auth/invalid-email':
        return 'Email no valido.';
      case 'auth/email-already-in-use':
        return 'Este email ya esta registrado.';
      case 'auth/weak-password':
        return 'La contrasena es demasiado debil.';
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Credenciales incorrectas.';
      case 'auth/too-many-requests':
        return 'Demasiados intentos. Intentalo mas tarde.';
      case 'auth/requires-recent-login':
        return 'Vuelve a iniciar sesion para completar esta accion.';
      default:
        return 'No se pudo completar la accion de autenticacion.';
    }
  }
}
