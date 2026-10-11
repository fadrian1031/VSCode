import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  CatalogResponse,
  ConfigurationSnapshot,
  CustomerPayload,
  LeadRequest,
  PublicLeadView,
  Quote,
  QuotePhoto
} from '../models/domain';

declare global {
  interface Window {
    __KASAC_CONFIG__?: { apiBaseUrl?: string };
  }
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly base = window.__KASAC_CONFIG__?.apiBaseUrl || 'http://localhost:3000/api';
  constructor(private http: HttpClient) {}

  // Público
  getCatalog(): Observable<CatalogResponse> {
    return this.http.get<CatalogResponse>(`${this.base}/catalog`);
  }
  submitLead(payload: {
    customer: CustomerPayload;
    configuration: ConfigurationSnapshot;
  }): Observable<{ lead: Pick<LeadRequest, 'code'>; publicUrl: string }> {
    return this.http.post<{ lead: Pick<LeadRequest, 'code'>; publicUrl: string }>(
      `${this.base}/leads`,
      payload
    );
  }
  getPublicLead(token: string): Observable<PublicLeadView> {
    return this.http.get<PublicLeadView>(`${this.base}/public/requests/${token}`);
  }

  // Área Comercial
  login(
    email: string,
    password: string
  ): Observable<{ token: string; user: { email: string; name: string } }> {
    return this.http.post<{ token: string; user: { email: string; name: string } }>(
      `${this.base}/auth/login`,
      { email, password }
    );
  }
  system(
    token: string
  ): Observable<{
    storage: string;
    persistent: boolean;
    retentionDays: number;
    email: { enabled: boolean; provider: string; to: string[] };
  }> {
    return this.http.get<any>(`${this.base}/commercial/system`, { headers: this.auth(token) });
  }
  listLeads(token: string): Observable<LeadRequest[]> {
    return this.http.get<LeadRequest[]>(`${this.base}/commercial/requests`, { headers: this.auth(token) });
  }
  getLead(id: string, token: string): Observable<LeadRequest> {
    return this.http.get<LeadRequest>(`${this.base}/commercial/requests/${id}`, {
      headers: this.auth(token)
    });
  }
  updateLead(
    id: string,
    token: string,
    payload: Partial<Pick<LeadRequest, 'status' | 'commercialNotes'>>
  ): Observable<LeadRequest> {
    return this.http.patch<LeadRequest>(`${this.base}/commercial/requests/${id}`, payload, {
      headers: this.auth(token)
    });
  }
  saveQuote(id: string, token: string, quote: Quote): Observable<LeadRequest> {
    return this.http.put<LeadRequest>(`${this.base}/commercial/requests/${id}/quote`, quote, {
      headers: this.auth(token)
    });
  }
  approveQuote(id: string, token: string): Observable<LeadRequest> {
    return this.http.post<LeadRequest>(
      `${this.base}/commercial/requests/${id}/quote/approve`,
      {},
      { headers: this.auth(token) }
    );
  }
  reopenQuote(id: string, token: string): Observable<LeadRequest> {
    return this.http.post<LeadRequest>(
      `${this.base}/commercial/requests/${id}/quote/reopen`,
      {},
      { headers: this.auth(token) }
    );
  }
  savePhotos(id: string, token: string, views: Record<string, string>): Observable<{ saved: string[] }> {
    return this.http.put<{ saved: string[] }>(
      `${this.base}/commercial/requests/${id}/photos`,
      { views },
      { headers: this.auth(token) }
    );
  }
  getPhotos(id: string, token: string): Observable<QuotePhoto[]> {
    return this.http.get<QuotePhoto[]>(`${this.base}/commercial/requests/${id}/photos`, {
      headers: this.auth(token)
    });
  }
  quoteFile(id: string, token: string, kind: 'pdf' | 'xlsx'): Observable<Blob> {
    return this.http.get(`${this.base}/commercial/requests/${id}/quote.${kind}`, {
      headers: this.auth(token),
      responseType: 'blob'
    });
  }

  private auth(token: string) {
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }
}
