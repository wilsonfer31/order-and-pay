import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { Router } from '@angular/router';

interface AuthResponse {
  token: string;
  restaurantId: string;
  role: string;
  firstName: string;
  lastName: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY      = 'oap_token';
  private readonly RESTAURANT_KEY = 'oap_restaurant_id';
  private readonly ROLE_KEY       = 'oap_role';

  constructor(private http: HttpClient, private router: Router) {}

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/auth/login', { email, password }).pipe(
      tap(res => {
        localStorage.setItem(this.TOKEN_KEY,      res.token);
        localStorage.setItem(this.RESTAURANT_KEY, res.restaurantId);
        localStorage.setItem(this.ROLE_KEY,       res.role);
      })
    );
  }

  getRole(): string {
    return localStorage.getItem(this.ROLE_KEY) ?? '';
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.RESTAURANT_KEY);
    localStorage.removeItem(this.ROLE_KEY);
    this.router.navigate(['/login']);
  }

  getToken(): string {
    return localStorage.getItem(this.TOKEN_KEY) ?? '';
  }

  getRestaurantId(): string {
    return localStorage.getItem(this.RESTAURANT_KEY) ?? '';
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }
}
