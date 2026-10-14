import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  CatalogResponse,
  CommercialUser,
  ConfigurationSnapshot,
  Customer,
  CustomerDetail,
  CustomerPayload,
  HistoryRow,
  IndicatorResult,
  IndicatorsResponse,
  LeadRequest,
  Notice,
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
  /** Respuesta del cliente a su cotización desde el enlace. */
  answerPublicQuote(
    token: string,
    decision: 'aprobar' | 'rechazar',
    reason = ''
  ): Observable<PublicLeadView> {
    return this.http.post<PublicLeadView>(`${this.base}/public/requests/${token}/respuesta`, {
      decision,
      reason
    });
  }
  publicQuotePdfUrl(token: string) {
    return `${this.base}/public/requests/${token}/quote.pdf`;
  }

  // Área Comercial
  login(email: string, password: string): Observable<{ token: string; user: CommercialUser }> {
    return this.http.post<{ token: string; user: CommercialUser }>(`${this.base}/auth/login`, {
      email,
      password
    });
  }
  system(token: string): Observable<{
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
  emitQuote(id: string, token: string): Observable<LeadRequest> {
    return this.http.post<LeadRequest>(
      `${this.base}/commercial/requests/${id}/quote/emit`,
      {},
      { headers: this.auth(token) }
    );
  }
  /** Comercial registra la respuesta que el cliente dio por correo o teléfono. */
  registerResponse(
    id: string,
    token: string,
    body: { decision: 'aprobar' | 'rechazar'; date: string; channel: string; reason?: string }
  ): Observable<LeadRequest> {
    return this.http.post<LeadRequest>(`${this.base}/commercial/requests/${id}/quote/response`, body, {
      headers: this.auth(token)
    });
  }
  undoResponse(id: string, token: string, reason: string): Observable<LeadRequest> {
    return this.http.post<LeadRequest>(
      `${this.base}/commercial/requests/${id}/quote/undo-response`,
      { reason },
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

  // Clientes
  customers(token: string): Observable<Customer[]> {
    return this.http.get<Customer[]>(`${this.base}/commercial/clientes`, { headers: this.auth(token) });
  }
  customer(key: string, token: string): Observable<CustomerDetail> {
    return this.http.get<CustomerDetail>(`${this.base}/commercial/clientes/${encodeURIComponent(key)}`, {
      headers: this.auth(token)
    });
  }

  // Indicadores
  indicators(token: string, desde = '', hasta = ''): Observable<IndicatorsResponse> {
    return this.http.get<IndicatorsResponse>(`${this.base}/commercial/indicadores`, {
      headers: this.auth(token),
      params: { desde, hasta }
    });
  }
  observationSheets(token: string, fuente: 'pre' | 'post', desde = '', hasta = ''): Observable<Blob> {
    return this.http.get(`${this.base}/commercial/indicadores/fichas.xlsx`, {
      headers: this.auth(token),
      params: { fuente, desde, hasta },
      responseType: 'blob'
    });
  }

  // Registro histórico (pre-prueba)
  history(token: string): Observable<{ rows: HistoryRow[]; resumen: IndicatorResult }> {
    return this.http.get<{ rows: HistoryRow[]; resumen: IndicatorResult }>(
      `${this.base}/commercial/historico`,
      {
        headers: this.auth(token)
      }
    );
  }
  importHistory(
    token: string,
    file: File
  ): Observable<{
    added: number;
    updated: number;
    total: number;
    errors: { fila: number; motivo: string }[];
  }> {
    return this.http.post<any>(`${this.base}/commercial/historico`, file, {
      headers: this.auth(token).set('Content-Type', 'application/octet-stream')
    });
  }
  clearHistory(token: string): Observable<{ removed: number }> {
    return this.http.delete<{ removed: number }>(`${this.base}/commercial/historico`, {
      headers: this.auth(token)
    });
  }
  historyTemplate(token: string): Observable<Blob> {
    return this.http.get(`${this.base}/commercial/historico/plantilla.xlsx`, {
      headers: this.auth(token),
      responseType: 'blob'
    });
  }

  // Avisos
  notices(token: string): Observable<Notice[]> {
    return this.http.get<Notice[]>(`${this.base}/commercial/avisos`, { headers: this.auth(token) });
  }
  dismissNotices(token: string, keys: string[]): Observable<Notice[]> {
    return this.http.post<Notice[]>(
      `${this.base}/commercial/avisos/descartar`,
      { keys },
      { headers: this.auth(token) }
    );
  }

  // Usuarios
  me(token: string): Observable<CommercialUser> {
    return this.http.get<CommercialUser>(`${this.base}/commercial/me`, { headers: this.auth(token) });
  }
  users(token: string): Observable<CommercialUser[]> {
    return this.http.get<CommercialUser[]>(`${this.base}/commercial/usuarios`, { headers: this.auth(token) });
  }
  createUser(
    token: string,
    body: { name: string; email: string; password: string; role: string }
  ): Observable<CommercialUser> {
    return this.http.post<CommercialUser>(`${this.base}/commercial/usuarios`, body, {
      headers: this.auth(token)
    });
  }
  updateUser(
    token: string,
    id: string,
    body: Partial<{ name: string; role: string; active: boolean; password: string }>
  ): Observable<CommercialUser> {
    return this.http.patch<CommercialUser>(`${this.base}/commercial/usuarios/${id}`, body, {
      headers: this.auth(token)
    });
  }

  private auth(token: string) {
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }
}
