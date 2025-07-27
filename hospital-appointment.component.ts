import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ComponentStore, provideComponentStore, tapResponse } from '@ngrx/component-store';
import { Observable, EMPTY, switchMap, tap, withLatestFrom } from 'rxjs';
import { FormsModule } from '@angular/forms';

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
}

export interface Appointment {
  id: string;
  patientName: string;
  doctor: Doctor;
  time: string;
  date: string;
}

const MOCK_DOCTORS: Doctor[] = [
  { id: 'doc1', name: 'Dr. Alice Smith', specialty: 'Cardiology' },
  { id: 'doc2', name: 'Dr. Bob Johnson', specialty: 'Neurology' },
  { id: 'doc3', name: 'Dr. Carol Williams', specialty: 'Pediatrics' },
];

const MOCK_TIME_SLOTS = ['09:00 AM', '10:00 AM', '11:00 AM', '02:00 PM', '03:00 PM'];

class MockApiService {
  fetchDoctors(): Observable<Doctor[]> {
    console.log('API: Fetching doctors...');
    return new Observable(subscriber => {
      setTimeout(() => {
        subscriber.next(MOCK_DOCTORS);
        subscriber.complete();
      }, 500);
    });
  }

  bookAppointment(patientName: string, doctor: Doctor, time: string, date: string): Observable<Appointment> {
    console.log(`API: Booking appointment for ${patientName} with ${doctor.name}...`);
    return new Observable(subscriber => {
      setTimeout(() => {
        if (!patientName || !doctor || !time || !date) {
          subscriber.error('Booking failed: All fields are required.');
          return;
        }
        const newAppointment: Appointment = {
          id: `apt_${Math.random().toString(36).substr(2, 9)}`,
          patientName,
          doctor,
          time,
          date,
        };
        subscriber.next(newAppointment);
        subscriber.complete();
      }, 1000);
    });
  }
}

interface AppointmentState {
  doctors: Doctor[];
  availableSlots: string[];
  bookedAppointments: Appointment[];
  selectedDoctorId: string | null;
  selectedSlot: string | null;
  patientName: string;
  bookingDate: string;
  isLoading: boolean;
  error: string | null;
}

const initialState: AppointmentState = {
  doctors: [],
  availableSlots: MOCK_TIME_SLOTS,
  bookedAppointments: [],
  selectedDoctorId: null,
  selectedSlot: null,
  patientName: '',
  bookingDate: new Date().toISOString().split('T')[0], // Default to today
  isLoading: false,
  error: null,
};

@Component({
  selector: 'hospital-appointment-store',
  template: ``,
  standalone: true,
  providers: [provideComponentStore(AppointmentStore)],
})
export class AppointmentStore extends ComponentStore<AppointmentState> {
  private readonly api = new MockApiService();

  constructor() {
    super(initialState);
  }

  readonly doctors$: Observable<Doctor[]> = this.select(state => state.doctors);
  readonly availableSlots$: Observable<string[]> = this.select(state => state.availableSlots);
  readonly bookedAppointments$: Observable<Appointment[]> = this.select(state => state.bookedAppointments);
  readonly selectedDoctorId$: Observable<string | null> = this.select(state => state.selectedDoctorId);
  readonly selectedSlot$: Observable<string | null> = this.select(state => state.selectedSlot);
  readonly patientName$: Observable<string> = this.select(state => state.patientName);
  readonly bookingDate$: Observable<string> = this.select(state => state.bookingDate);
  readonly isLoading$: Observable<boolean> = this.select(state => state.isLoading);
  readonly error$: Observable<string | null> = this.select(state => state.error);

  readonly vm$ = this.select({
    doctors: this.doctors$,
    availableSlots: this.availableSlots$,
    bookedAppointments: this.bookedAppointments$,
    selectedDoctorId: this.selectedDoctorId$,
    selectedSlot: this.selectedSlot$,
    patientName: this.patientName$,
    bookingDate: this.bookingDate$,
    isLoading: this.isLoading$,
    error: this.error$,
  }, { debounce: true });

  readonly setDoctors = this.updater((state, doctors: Doctor[]) => ({
    ...state,
    doctors,
    isLoading: false,
  }));

  readonly addAppointment = this.updater((state, appointment: Appointment) => ({
    ...state,
    bookedAppointments: [...state.bookedAppointments, appointment],
    isLoading: false,
    error: null,
    // Reset form fields
    patientName: '',
    selectedDoctorId: null,
    selectedSlot: null,
  }));

  readonly setLoading = this.updater((state, isLoading: boolean) => ({
    ...state,
    isLoading,
    error: null,
  }));

  readonly setError = this.updater((state, error: string) => ({
    ...state,
    isLoading: false,
    error,
  }));

  readonly updatePatientName = this.updater((state, patientName: string) => ({
    ...state,
    patientName,
  }));

  readonly updateSelectedDoctor = this.updater((state, doctorId: string | null) => ({
    ...state,
    selectedDoctorId: doctorId
  }));

  readonly updateSelectedSlot = this.updater((state, slot: string | null) => ({
    ...state,
    selectedSlot: slot
  }));

  readonly updateBookingDate = this.updater((state, date: string) => ({
    ...state,
    bookingDate: date
  }));


  readonly fetchDoctorsEffect = this.effect<void>(trigger$ =>
    trigger$.pipe(
      tap(() => this.setLoading(true)),
      switchMap(() =>
        this.api.fetchDoctors().pipe(
          tapResponse(
            (doctors) => this.setDoctors(doctors),
            (error: string) => this.setError(error)
          )
        )
      )
    )
  );

  readonly bookAppointmentEffect = this.effect<void>(trigger$ =>
    trigger$.pipe(
      withLatestFrom(this.state$),
      tap(() => this.setLoading(true)),
      switchMap(([_, state]) => {
        const selectedDoctor = state.doctors.find(d => d.id === state.selectedDoctorId);
        if (!selectedDoctor || !state.selectedSlot || !state.patientName || !state.bookingDate) {
          this.setError('Please fill in all fields to book an appointment.');
          return EMPTY;
        }
        return this.api.bookAppointment(state.patientName, selectedDoctor, state.selectedSlot, state.bookingDate).pipe(
          tapResponse(
            (appointment) => this.addAppointment(appointment),
            (error: string) => this.setError(error)
          )
        );
      })
    )
  );
}


@Component({
  selector: 'app-hospital-appointment',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [AppointmentStore],
  template: `
    <div class="host-container">
      <div class="container">
        <header>
          <h1>Hospital Appointments</h1>
          <p>Book and manage your appointments with ease.</p>
        </header>

        <div class="content-grid">
          <!-- Booking Form Card -->
          <div class="card">
            <h2>Book a New Appointment</h2>

            <ng-container *ngIf="store.vm$ | async as vm">
              <form (ngSubmit)="bookAppointment()">
                <!-- Patient Name -->
                <div class="form-group">
                  <label for="patientName">Patient Name</label>
                  <input id="patientName" type="text" [ngModel]="vm.patientName" (ngModelChange)="store.updatePatientName($event)" name="patientName" required>
                </div>

                <!-- Booking Date -->
                <div class="form-group">
                  <label for="bookingDate">Date</label>
                  <input id="bookingDate" type="date" [ngModel]="vm.bookingDate" (ngModelChange)="store.updateBookingDate($event)" name="bookingDate" required>
                </div>

                <!-- Doctor Selection -->
                <div class="form-group">
                  <label for="doctor">Select Doctor</label>
                  <select id="doctor" [ngModel]="vm.selectedDoctorId" (ngModelChange)="store.updateSelectedDoctor($event)" name="selectedDoctorId" required>
                    <option [ngValue]="null" disabled>Choose a doctor...</option>
                    <option *ngFor="let doctor of vm.doctors" [ngValue]="doctor.id">
                      {{ doctor.name }} ({{ doctor.specialty }})
                    </option>
                  </select>
                </div>

                <!-- Time Slot Selection -->
                <div class="time-slots">
                  <label>Select Time Slot</label>
                  <div class="slots-grid">
                    <button type="button" *ngFor="let slot of vm.availableSlots"
                            (click)="store.updateSelectedSlot(slot)"
                            [class.selected]="vm.selectedSlot === slot">
                      {{ slot }}
                    </button>
                  </div>
                </div>

                <!-- Error Message -->
                <div *ngIf="vm.error" class="error-message">
                  <p class="font-bold">Error</p>
                  <p>{{ vm.error }}</p>
                </div>

                <!-- Submit Button -->
                <button type="submit" [disabled]="vm.isLoading" class="submit-button">
                  <ng-container *ngIf="!vm.isLoading; else loadingSpinner">
                    Book Appointment
                  </ng-container>
                  <ng-template #loadingSpinner>
                    <svg class="spinner" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Booking...
                  </ng-template>
                </button>
              </form>
            </ng-container>
          </div>

          <!-- Appointments List Card -->
          <div class="card appointments-list">
            <h2>Upcoming Appointments</h2>
            <ng-container *ngIf="store.vm$ | async as vm">
              <div *ngIf="vm.bookedAppointments.length === 0; else appointmentList" class="empty-state">
                <svg class="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3>No appointments</h3>
                <p>Get started by booking a new appointment.</p>
              </div>

              <ng-template #appointmentList>
                <ul>
                  <li *ngFor="let appt of vm.bookedAppointments">
                    <div class="details">
                      <p class="patient-name">{{ appt.patientName }}</p>
                      <p class="doctor-name">with {{ appt.doctor.name }}</p>
                      <p class="doctor-specialty">{{ appt.doctor.specialty }}</p>
                    </div>
                    <div class="time-info">
                      <p class="time">{{ appt.time }}</p>
                      <p class="date">{{ appt.date | date:'longDate' }}</p>
                    </div>
                  </li>
                </ul>
              </ng-template>
            </ng-container>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      --slate-50: #f8fafc;
      --slate-100: #f1f5f9;
      --slate-200: #e2e8f0;
      --slate-300: #cbd5e1;
      --slate-400: #94a3b8;
      --slate-500: #64748b;
      --slate-600: #475569;
      --slate-700: #334152;
      --slate-800: #1e293b;
      --slate-900: #0f172a;
      --blue-200: #bfdbfe;
      --blue-500: #3b82f6;
      --blue-600: #2563eb;
      --red-100: #fee2e2;
      --red-500: #ef4444;
      --red-700: #b91c1c;
      --white: #ffffff;
      --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
      --border-radius-lg: 0.5rem;
      --border-radius-xl: 0.75rem;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .host-container {
      display: block;
      background-color: var(--slate-50);
      min-height: 100vh;
      font-family: var(--font-sans);
      padding: 1.5rem;
    }

    @media (min-width: 1024px) {
      .host-container {
        padding: 2rem;
      }
    }

    .container {
      max-width: 56rem;
      margin: 0 auto;
    }

    header {
      margin-bottom: 2rem;
    }

    header h1 {
      font-size: 2.25rem;
      font-weight: 700;
      color: var(--slate-800);
    }

    header p {
      color: var(--slate-500);
      margin-top: 0.5rem;
    }

    .content-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 2rem;
    }

    @media (min-width: 1024px) {
      .content-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    .card {
      background-color: var(--white);
      padding: 1.5rem;
      border-radius: var(--border-radius-xl);
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
    }

    .card h2 {
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--slate-700);
      border-bottom: 1px solid var(--slate-200);
      padding-bottom: 0.75rem;
      margin-bottom: 1.5rem;
    }

    .form-group {
      margin-bottom: 1rem;
    }

    form label {
      display: block;
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--slate-600);
      margin-bottom: 0.25rem;
    }

    form input, form select {
      width: 100%;
      padding: 0.5rem 1rem;
      border: 1px solid var(--slate-300);
      border-radius: var(--border-radius-lg);
      transition: all 0.2s ease-in-out;
      background-color: var(--white);
    }

    form input:focus, form select:focus {
      outline: none;
      border-color: var(--blue-500);
      box-shadow: 0 0 0 2px var(--blue-200);
    }

    form select {
      appearance: none;
      background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
      background-position: right 0.5rem center;
      background-repeat: no-repeat;
      background-size: 1.5em 1.5em;
      padding-right: 2.5rem;
    }

    .time-slots {
      margin-bottom: 1.5rem;
    }

    .time-slots label {
      margin-bottom: 0.5rem;
    }

    .slots-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0.5rem;
    }

    @media (min-width: 640px) {
      .slots-grid {
        grid-template-columns: repeat(3, 1fr);
      }
    }

    .slots-grid button {
      padding: 0.5rem 0.75rem;
      font-size: 0.875rem;
      border-radius: var(--border-radius-lg);
      font-weight: 600;
      transition: all 0.2s ease-in-out;
      text-align: center;
      border: 1px solid var(--slate-200);
      cursor: pointer;
      background-color: var(--slate-100);
    }

    .slots-grid button:hover {
      background-color: var(--blue-200);
      border-color: var(--blue-200);
    }

    .slots-grid button.selected {
      background-color: var(--blue-600);
      color: var(--white);
      border-color: var(--blue-600);
    }

    .error-message {
      background-color: var(--red-100);
      border-left: 4px solid var(--red-500);
      color: var(--red-700);
      padding: 1rem;
      margin-bottom: 1rem;
      border-radius: var(--border-radius-lg);
    }

    .error-message p {
      margin: 0;
    }

    .error-message .font-bold {
      font-weight: 700;
    }

    .submit-button {
      width: 100%;
      background-color: var(--blue-500);
      color: var(--white);
      font-weight: 700;
      padding: 0.75rem 1rem;
      border-radius: var(--border-radius-lg);
      border: none;
      cursor: pointer;
      transition: all 0.3s ease-in-out;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .submit-button:hover {
      background-color: var(--blue-600);
    }

    .submit-button:disabled {
      background-color: var(--slate-400);
      cursor: not-allowed;
    }

    .submit-button .spinner {
      animation: spin 1s linear infinite;
      margin-right: 0.75rem;
      width: 1.25rem;
      height: 1.25rem;
    }

    .appointments-list .empty-state {
      text-align: center;
      padding: 2.5rem 1rem;
    }

    .empty-state .icon {
      margin: 0 auto;
      height: 3rem;
      width: 3rem;
      color: var(--slate-400);
    }

    .empty-state h3 {
      margin-top: 0.5rem;
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--slate-900);
    }

    .empty-state p {
      margin-top: 0.25rem;
      font-size: 0.875rem;
      color: var(--slate-500);
    }

    .appointments-list ul {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .appointments-list li {
      padding: 1rem;
      background-color: var(--slate-50);
      border-radius: var(--border-radius-lg);
      border: 1px solid var(--slate-200);
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }

    .appointments-list li p {
      margin: 0;
    }

    .details .patient-name {
      font-weight: 700;
      color: var(--blue-600);
    }
    .details .doctor-name {
      font-size: 0.875rem;
      color: var(--slate-600);
    }
    .details .doctor-specialty {
      font-size: 0.875rem;
      color: var(--slate-500);
    }

    .time-info {
      text-align: right;
      flex-shrink: 0;
      margin-left: 1rem;
    }

    .time-info .time {
      font-weight: 600;
      color: var(--slate-800);
    }
    .time-info .date {
      font-size: 0.875rem;
      color: var(--slate-500);
    }
  `]
})
export class HospitalAppointmentComponent implements OnInit {

  constructor(public readonly store: AppointmentStore) {}

  ngOnInit(): void {
    this.store.fetchDoctorsEffect();
  }

  bookAppointment(): void {
    this.store.bookAppointmentEffect();
  }
}
