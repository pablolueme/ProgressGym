# GymTrack / ProgresoGym

Aplicacion web fitness mobile-first con Angular + Firebase Auth + Cloud Firestore, desplegada en GitHub Pages.

## Arquitectura
- `GitHub`: repositorio del codigo.
- `GitHub Pages`: hosting de la SPA Angular.
- `Firebase Authentication`: registro/login con email y contrasena.
- `Cloud Firestore`: datos por usuario bajo `users/{uid}/...`.

## Stack
- Angular 20 (standalone components, Angular Router, Reactive Forms, SCSS)
- TypeScript
- AngularFire (`@angular/fire`) + Firebase SDK
- Hash routing (`/#/app/...`) para evitar problemas de refresh en GitHub Pages

## Estructura principal
- `src/app/core/models`: contratos TypeScript (UserProfile, GymFolder, Exercise, Routine, Workout)
- `src/app/core/services`: AuthService, UserProfileService, FolderService, ExerciseService, RoutineService, WorkoutService, ProgressService
- `src/app/core/guards`: `authGuard` y `guestGuard`
- `src/app/layout`: shell privado y bottom nav
- `src/app/features`: auth, home, folders, routines, exercises, workout, history, progress, profile

## Firestore (multiusuario)
Colecciones por usuario:

```text
users/{uid}
users/{uid}/folders/{folderId}
users/{uid}/exercises/{exerciseId}
users/{uid}/routines/{routineId}
users/{uid}/workouts/{workoutId}
```

Reglas en [firestore.rules](/firestore.rules).

## Configuracion Firebase
1. Crea proyecto en Firebase.
2. Activa Authentication -> Email/Password.
3. Crea Firestore (modo produccion recomendado).
4. Crea app web y copia `firebaseConfig`.
5. Reemplaza placeholders en:
   - [src/environments/environment.ts](/src/environments/environment.ts)
   - [src/environments/environment.development.ts](/src/environments/environment.development.ts)
6. Publica reglas:

```bash
firebase deploy --only firestore:rules
```

## Desarrollo local
```bash
npm install
npm run start
```

## Build produccion
```bash
npm run build
```

## GitHub Pages
El proyecto esta preparado para hash routing y scripts de Pages:

```bash
npm run build:gh-pages
npm run deploy:gh-pages
```

Notas:
- `build:gh-pages` usa `--base-href /ProyectoGymProgress/`.
- Si tu repo tiene otro nombre, ajusta ese valor en `package.json`.
- `deploy:gh-pages` publica `dist/gymtrack/browser`.

## Pantallas implementadas (Fase 1)
- `/welcome`
- `/login`
- `/register`
- `/app/home`
- `/app/folders`
- `/app/folders/:folderId`
- `/app/routines/:routineId`
- `/app/exercises`
- `/app/exercises/:exerciseId`
- `/app/workout`
- `/app/workout/start/:routineId`
- `/app/history`
- `/app/history/:workoutId`
- `/app/progress`
- `/app/profile`

## Datos de ejemplo opcionales
En registro puedes activar "Cargar carpetas y ejercicios de ejemplo". Se crean:
- Carpetas: Pecho, Espalda, Pierna
- Ejercicios base (press banca, jalon, sentadilla, etc.)
- Rutina inicial "Pecho basico"

Todos los datos son editables y eliminables.
