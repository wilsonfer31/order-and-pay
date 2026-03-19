import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface TableInfo {
  id: string;
  label: string;
  qrToken?: string;
  status: string;
}

@Injectable({ providedIn: 'root' })
export class TableService {
  constructor(private http: HttpClient) {}

  findByToken(token: string): Observable<TableInfo> {
    return this.http.get<TableInfo>(`/public/tables/by-token`, { params: { t: token } });
  }
}
