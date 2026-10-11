import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { PublicLeadView } from '../../models/domain';
import { ThreeViewerComponent } from '../../components/three-viewer/three-viewer.component';
import { EMBEDDED } from '../../app.variant';
import { FEATURES } from '../../features';
@Component({
  selector: 'app-public-request',
  standalone: true,
  imports: [CommonModule, RouterLink, ThreeViewerComponent],
  templateUrl: './public-request.component.html',
  styleUrl: './public-request.component.css'
})
export class PublicRequestComponent implements OnInit {
  readonly embedded = EMBEDDED;
  readonly features = FEATURES;
  lead = signal<PublicLeadView | null>(null);
  error = signal('');
  viewMode = signal<'exterior' | 'interior'>('exterior');
  constructor(
    private route: ActivatedRoute,
    private api: ApiService
  ) {}
  ngOnInit() {
    const token = this.route.snapshot.paramMap.get('token') || '';
    this.api
      .getPublicLead(token)
      .subscribe({
        next: r => this.lead.set(r),
        error: () => this.error.set('No encontramos esta configuración o el enlace ya no es válido.')
      });
  }
}
